-- Private groups stay out of discovery. A random invitation token is required
-- to open and join them, while members can keep using the normal group feed.
alter table public.universe_groups
 add column if not exists is_private boolean not null default false,
 add column if not exists share_token uuid not null default gen_random_uuid();

create unique index if not exists universe_groups_share_token on public.universe_groups(share_token);

create or replace function public.universe_can_read_group(group_uuid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(
  select 1 from public.universe_groups g
  where g.id=group_uuid and (
   not g.is_private
   or g.creator_id=(select auth.uid())
   or exists(select 1 from public.universe_group_members m where m.group_id=g.id and m.user_id=(select auth.uid()))
  )
 );
$$;
revoke all on function public.universe_can_read_group(uuid) from public,anon,authenticated;
grant execute on function public.universe_can_read_group(uuid) to authenticated;

drop policy if exists groups_read on public.universe_groups;
create policy groups_read on public.universe_groups for select to authenticated
 using((select public.universe_is_member()) and (not is_private or creator_id=(select auth.uid()) or public.universe_can_read_group(id)));

drop policy if exists group_members_read on public.universe_group_members;
create policy group_members_read on public.universe_group_members for select to authenticated
 using((select public.universe_is_member()) and public.universe_can_read_group(group_id));

drop policy if exists group_members_insert on public.universe_group_members;
create policy group_members_insert on public.universe_group_members for insert to authenticated
 with check(
  (select public.universe_is_member()) and user_id=(select auth.uid())
  and exists(select 1 from public.universe_groups g where g.id=group_id and (not g.is_private or g.creator_id=(select auth.uid())))
 );

drop policy if exists posts_read on public.universe_posts;
create policy posts_read on public.universe_posts for select to authenticated
 using((select public.universe_is_member()) and (group_id is null or public.universe_can_read_group(group_id)));

drop policy if exists comments_read on public.universe_comments;
create policy comments_read on public.universe_comments for select to authenticated
 using((select public.universe_is_member()) and exists(
  select 1 from public.universe_posts p where p.id=post_id and (p.group_id is null or public.universe_can_read_group(p.group_id))
 ));

drop policy if exists likes_read on public.universe_likes;
create policy likes_read on public.universe_likes for select to authenticated
 using((select public.universe_is_member()) and exists(
  select 1 from public.universe_posts p where p.id=post_id and (p.group_id is null or public.universe_can_read_group(p.group_id))
 ));

create or replace function public.universe_shared_group(share_uuid uuid)
returns setof public.universe_groups
language sql stable security definer set search_path = '' as $$
 select g.* from public.universe_groups g
 where (select public.universe_is_member()) and g.share_token=share_uuid;
$$;
revoke all on function public.universe_shared_group(uuid) from public,anon;
grant execute on function public.universe_shared_group(uuid) to authenticated;

create or replace function public.universe_set_group_membership(group_uuid uuid, attending boolean, share_uuid uuid default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare g public.universe_groups; caller uuid:=(select auth.uid());
begin
 if not public.universe_is_member() or attending is null then raise exception 'UNIVERSE_UNIVERSITY_REQUIRED' using errcode='42501'; end if;
 select * into g from public.universe_groups where id=group_uuid for update;
 if not found then raise exception 'GROUP_UNAVAILABLE'; end if;
 if attending then
  if g.is_private and g.creator_id<>caller and not exists(select 1 from public.universe_group_members m where m.group_id=g.id and m.user_id=caller) and g.share_token is distinct from share_uuid then
   raise exception 'PRIVATE_GROUP_INVITE_REQUIRED';
  end if;
  insert into public.universe_group_members(group_id,user_id) values(g.id,caller) on conflict(group_id,user_id) do nothing;
 else
  if g.creator_id=caller then raise exception 'GROUP_OWNER_CANNOT_LEAVE'; end if;
  delete from public.universe_group_members where group_id=g.id and user_id=caller;
 end if;
end;
$$;
revoke all on function public.universe_set_group_membership(uuid,boolean,uuid) from public,anon;
grant execute on function public.universe_set_group_membership(uuid,boolean,uuid) to authenticated;
