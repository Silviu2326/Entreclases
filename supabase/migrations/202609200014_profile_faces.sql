-- Profile photo and banner. The browser crops and shrinks the picture to a small
-- webp before uploading, so the bucket only ever holds known, bounded files.
alter table public.universe_profiles
  add column avatar_url text
    check (avatar_url is null or avatar_url ~ '^[a-f0-9-]{36}/avatar-[0-9]{1,14}\.webp$'),
  add column banner_url text
    check (banner_url is null or banner_url ~ '^[a-f0-9-]{36}/banner-[0-9]{1,14}\.webp$');

grant update(avatar_url, banner_url) on public.universe_profiles to authenticated;

-- Private, like the notes bucket: a face is visible to verified members through a
-- short-lived signed link, never to the open internet.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('universe-faces','universe-faces',false,1048576,array['image/webp'])
on conflict(id) do update set public=false,file_size_limit=1048576,allowed_mime_types=array['image/webp'];

create policy universe_faces_write on storage.objects for insert to authenticated
with check(bucket_id='universe-faces' and (select public.universe_is_member())
 and name ~ '^[a-f0-9-]{36}/(avatar|banner)-[0-9]{1,14}\.webp$' and split_part(name,'/',1)=(select auth.uid())::text);
create policy universe_faces_replace on storage.objects for update to authenticated
using(bucket_id='universe-faces' and (select public.universe_is_member()) and split_part(name,'/',1)=(select auth.uid())::text)
with check(bucket_id='universe-faces' and name ~ '^[a-f0-9-]{36}/(avatar|banner)-[0-9]{1,14}\.webp$' and split_part(name,'/',1)=(select auth.uid())::text);
create policy universe_faces_read on storage.objects for select to authenticated
using(bucket_id='universe-faces' and (select public.universe_is_member()));
create policy universe_faces_remove on storage.objects for delete to authenticated
using(bucket_id='universe-faces' and (select public.universe_is_member()) and split_part(name,'/',1)=(select auth.uid())::text);
