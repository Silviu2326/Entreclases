-- Fotos, GIFs y vídeos en el chat privado. Apply after the existing migrations.
-- A message may now carry one file instead of (or along with) text. The file lives
-- in a private bucket under <thread>/<sender>/<uuid>.<ext>, so the path alone says
-- who may touch it: only the two people of that conversation can read it, and only
-- the sender can write or remove it. Nothing here is ever public.
alter table public.universe_messages
 add column media_path text,
 add column media_kind text check (media_kind in ('image','video'));
alter table public.universe_messages drop constraint if exists universe_messages_body_check;
alter table public.universe_messages
 add constraint universe_messages_body_check check (char_length(body)<=2000 and (char_length(btrim(body))>=1 or media_path is not null)),
 add constraint universe_messages_media_pair check ((media_path is null)=(media_kind is null)),
 add constraint universe_messages_media_owner check (media_path is null or media_path like thread_id::text||'/'||sender_id::text||'/%');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('universe-chat','universe-chat',false,26214400,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
on conflict(id) do update set public=false,file_size_limit=26214400,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'];
create policy universe_chat_upload on storage.objects for insert to authenticated
with check(bucket_id='universe-chat' and (select public.universe_is_member())
 and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|png|webp|gif|mp4|webm)$'
 and split_part(name,'/',2)=(select auth.uid())::text
 and exists(select 1 from public.universe_threads t where t.id::text=split_part(name,'/',1) and (t.user_a=(select auth.uid()) or t.user_b=(select auth.uid()))));
create policy universe_chat_view on storage.objects for select to authenticated
using(bucket_id='universe-chat' and (select public.universe_is_member())
 and exists(select 1 from public.universe_threads t where t.id::text=split_part(name,'/',1) and (t.user_a=(select auth.uid()) or t.user_b=(select auth.uid()))));
create policy universe_chat_remove on storage.objects for delete to authenticated
using(bucket_id='universe-chat' and (select public.universe_is_member()) and split_part(name,'/',2)=(select auth.uid())::text);
