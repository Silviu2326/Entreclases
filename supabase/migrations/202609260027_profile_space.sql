-- The personal space: which blocks a profile shows and in what order, one of a
-- fixed set of backgrounds, and stickers pinned on the cover. The blocks and
-- background are one JSON whose shape the app checks; the column only bounds it.
alter table public.universe_profiles
  add column space jsonb not null default '{}'::jsonb
    check (jsonb_typeof(space) = 'object' and length(space::text) <= 2000);
grant update(space) on public.universe_profiles to authenticated;

-- A sticker is either one that ships with the app or a small transparent webp
-- the owner uploaded, placed on the cover in percentages so it lands in the
-- same spot on every screen.
create table public.universe_stickers (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.universe_profiles(user_id) on delete cascade,
 path text not null check (path ~ '^builtin:[a-z]{2,20}$' or path ~ '^[a-f0-9-]{36}/sticker-[a-f0-9-]{36}\.webp$'),
 x real not null default 50 check (x between 0 and 100),
 y real not null default 50 check (y between 0 and 100),
 scale real not null default 1 check (scale between 0.25 and 3),
 rotation smallint not null default 0 check (rotation between -180 and 180),
 z smallint not null default 0 check (z between 0 and 99),
 created_at timestamptz not null default now(),
 check (path like 'builtin:%' or split_part(path, '/', 1) = owner_id::text)
);
create index universe_stickers_owner on public.universe_stickers(owner_id, z);
revoke all on public.universe_stickers from public, anon, authenticated;
alter table public.universe_stickers enable row level security;
-- Stickers are as public as the avatar they sit next to: every member reads them.
create policy stickers_read on public.universe_stickers for select to authenticated using ((select public.universe_is_member()));
create policy stickers_insert on public.universe_stickers for insert to authenticated with check ((select public.universe_is_member()) and owner_id = (select auth.uid()));
create policy stickers_update on public.universe_stickers for update to authenticated using ((select public.universe_is_member()) and owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy stickers_delete on public.universe_stickers for delete to authenticated using ((select public.universe_is_member()) and owner_id = (select auth.uid()));
grant select, insert, update, delete on public.universe_stickers to authenticated;

-- Twelve is plenty for a cover and keeps a profile from becoming a wall of them.
create function public.universe_sticker_limit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if (select count(*) from public.universe_stickers where owner_id = new.owner_id) >= 12 then
  raise exception 'STICKER_LIMIT' using errcode = '23514';
 end if;
 return new;
end;
$$;
revoke all on function public.universe_sticker_limit() from public, anon, authenticated;
create trigger universe_sticker_limit before insert on public.universe_stickers
for each row execute function public.universe_sticker_limit();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('universe-stickers','universe-stickers',false,524288,array['image/webp'])
on conflict(id) do update set public=false,file_size_limit=524288,allowed_mime_types=array['image/webp'];
create policy universe_stickers_write on storage.objects for insert to authenticated
 with check (bucket_id='universe-stickers' and (select public.universe_is_member())
  and name ~ '^[a-f0-9-]{36}/sticker-[a-f0-9-]{36}\.webp$' and split_part(name,'/',1)=(select auth.uid())::text);
create policy universe_stickers_read on storage.objects for select to authenticated
 using (bucket_id='universe-stickers' and (select public.universe_is_member()));
create policy universe_stickers_remove on storage.objects for delete to authenticated
 using (bucket_id='universe-stickers' and (select public.universe_is_member()) and split_part(name,'/',1)=(select auth.uid())::text);
