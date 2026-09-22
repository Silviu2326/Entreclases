-- The showcase: a shop window on every profile. A piece is a link, a note, a
-- story, a picture or clip, or a PDF, and each piece carries its own audience.
-- Who may see a piece is decided here, row by row, so a file behind it can
-- only be opened by somebody the row itself is visible to.
alter table public.universe_profiles
  add column showcase_frame text not null default 'madera'
    check (showcase_frame in ('madera','cristal','neon'));
grant update(showcase_frame) on public.universe_profiles to authenticated;

create table public.universe_showcase (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.universe_profiles(user_id) on delete cascade,
 kind text not null check (kind in ('link','note','story','media','file')),
 title text not null default '' check (char_length(title) <= 120),
 body text not null default '' check (char_length(body) <= 1200),
 url text check (url is null or (url ~ '^https://' and char_length(url) <= 500)),
 media_path text check (media_path is null or media_path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|png|webp|gif|mp4|webm|pdf)$'),
 media_kind text check (media_kind in ('image','video','pdf')),
 audience text not null default 'everyone' check (audience in ('everyone','campus','contacts','chosen','only_me')),
 viewers uuid[] not null default '{}' check (cardinality(viewers) <= 50),
 position integer not null default 0,
 created_at timestamptz not null default now(),
 -- Each kind carries exactly what it needs and nothing of the others.
 check ((kind = 'link') = (url is not null)),
 check ((kind in ('story','media','file')) = (media_path is not null)),
 check ((media_path is null) = (media_kind is null)),
 check (kind <> 'file' or media_kind = 'pdf'),
 check (kind not in ('story','media') or media_kind in ('image','video')),
 check (kind <> 'note' or char_length(btrim(body)) >= 1),
 check (audience <> 'chosen' or cardinality(viewers) >= 1),
 -- The file path names its owner, so storage can trust the path alone.
 check (media_path is null or split_part(media_path, '/', 1) = owner_id::text)
);
create index universe_showcase_owner on public.universe_showcase(owner_id, position, created_at desc);
revoke all on public.universe_showcase from public, anon, authenticated;
alter table public.universe_showcase enable row level security;

-- Who a piece is for. The owner always; then by audience. `campus` reads the
-- two profiles, `contacts` the private threads, `chosen` the list on the row.
create function public.universe_showcase_visible(owner uuid, audience text, viewers uuid[]) returns boolean
language sql stable security definer set search_path='' as $$
 select (select auth.uid()) = owner
  or audience = 'everyone'
  or (audience = 'campus' and exists (
       select 1 from public.universe_profiles a join public.universe_profiles b on a.campus = b.campus
       where a.user_id = owner and b.user_id = (select auth.uid())))
  or (audience = 'contacts' and exists (
       select 1 from public.universe_threads t
       where (t.user_a = owner and t.user_b = (select auth.uid())) or (t.user_b = owner and t.user_a = (select auth.uid()))))
  or (audience = 'chosen' and (select auth.uid()) = any(viewers));
$$;
revoke all on function public.universe_showcase_visible(uuid, text, uuid[]) from public, anon;
grant execute on function public.universe_showcase_visible(uuid, text, uuid[]) to authenticated;

create policy showcase_read on public.universe_showcase for select to authenticated
 using ((select public.universe_is_member()) and public.universe_showcase_visible(owner_id, audience, viewers));
create policy showcase_insert on public.universe_showcase for insert to authenticated
 with check ((select public.universe_is_member()) and owner_id = (select auth.uid()));
create policy showcase_update on public.universe_showcase for update to authenticated
 using ((select public.universe_is_member()) and owner_id = (select auth.uid()))
 with check (owner_id = (select auth.uid()));
create policy showcase_delete on public.universe_showcase for delete to authenticated
 using ((select public.universe_is_member()) and owner_id = (select auth.uid()));
grant select, insert, update, delete on public.universe_showcase to authenticated;

-- Private, like every other bucket here. Reading a file goes through the row
-- that names it: no visible row, no signed link.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('universe-showcase','universe-showcase',false,26214400,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=26214400,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','application/pdf'];
create policy universe_showcase_upload on storage.objects for insert to authenticated
 with check (bucket_id='universe-showcase' and (select public.universe_is_member())
  and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|png|webp|gif|mp4|webm|pdf)$'
  and split_part(name,'/',1)=(select auth.uid())::text);
create policy universe_showcase_view on storage.objects for select to authenticated
 using (bucket_id='universe-showcase' and (select public.universe_is_member())
  and (split_part(name,'/',1)=(select auth.uid())::text
       or exists (select 1 from public.universe_showcase s where s.media_path = name)));
create policy universe_showcase_remove on storage.objects for delete to authenticated
 using (bucket_id='universe-showcase' and (select public.universe_is_member()) and split_part(name,'/',1)=(select auth.uid())::text);
