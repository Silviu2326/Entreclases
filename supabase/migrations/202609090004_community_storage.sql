-- Private PDF uploads. Storage API, not SQL deletion of storage.objects, owns the bytes.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('universe-notes','universe-notes',false,10485760,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf'];
create policy universe_notes_upload on storage.objects for insert to authenticated
with check(bucket_id='universe-notes' and (select public.universe_is_member())
 and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.pdf$' and split_part(name,'/',1)=(select auth.uid())::text);
create policy universe_notes_download on storage.objects for select to authenticated
using(bucket_id='universe-notes' and (select public.universe_is_member())
 and (split_part(name,'/',1)=(select auth.uid())::text or exists(select 1 from public.universe_notes n where n.file_path=name)));
create policy universe_notes_remove on storage.objects for delete to authenticated
using(bucket_id='universe-notes' and (select public.universe_is_member()) and split_part(name,'/',1)=(select auth.uid())::text);
