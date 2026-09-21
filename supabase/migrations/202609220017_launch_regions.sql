-- Launch scope is server-owned. This migration does NOT open Madrid.
create table public.universe_launch_regions (
 slug text primary key check(slug ~ '^[a-z][a-z0-9-]{1,40}$'),
 name text not null,
 enabled boolean not null default false
);
alter table public.universe_launch_regions enable row level security;
revoke all on public.universe_launch_regions from public, anon, authenticated;
insert into public.universe_launch_regions values ('valencia','Valencia',true),('madrid','Madrid',false);
update public.universe_university_domains set enabled=false where domain in ('opre.com','xarly.com');

create or replace function public.universe_account_kind(account_id uuid) returns text
language sql stable security definer set search_path='' as $$
 select case when exists (
  select 1 from public.universe_university_domains d
  where d.domain=split_part(lower(u.email),'@',2) and d.enabled and exists(select 1 from public.universe_launch_regions r where r.slug=d.launch_region and r.enabled)
 ) then 'university' when exists (
  select 1 from public.universe_plus_one i where i.claimed_user_id=u.id
 ) then 'guest' end
 from auth.users u where u.id=account_id and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false);
$$;

create or replace function public.universe_before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare email text:=lower(coalesce(event->'user'->>'email','')); invite text:=event->'user'->'user_metadata'->>'plus_one_token';
begin
 if coalesce(event->'user'->>'is_anonymous','false')='true'
  or coalesce(event->'user'->'app_metadata'->>'provider','email')<>'email' then
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','UNIVERSE_UNIVERSITY_REQUIRED'));
 end if;
 if exists(select 1 from public.universe_university_domains d where d.domain=split_part(email,'@',2) and d.enabled and exists(select 1 from public.universe_launch_regions r where r.slug=d.launch_region and r.enabled))
 or exists(select 1 from public.universe_plus_one i where i.token::text=invite and i.recipient_email=email
  and i.claimed_at is null and i.cancelled_at is null and i.expires_at>now() and public.universe_account_kind(i.inviter_id)='university') then return '{}'::jsonb; end if;
 return jsonb_build_object('error',jsonb_build_object('http_code',403,'message',case when invite is not null then 'INVITE_INVALID' else 'UNIVERSE_UNIVERSITY_REQUIRED' end));
end;
$$;

create or replace function public.universe_guard_email() returns trigger
language plpgsql security definer set search_path='' as $$
declare allowed boolean; claimed uuid;
begin
 if new.email is null or coalesce(new.is_anonymous,false) then raise exception 'UNIVERSE_UNIVERSITY_REQUIRED' using errcode='23514'; end if;
 allowed:=exists(select 1 from public.universe_university_domains d where d.domain=split_part(lower(new.email),'@',2) and d.enabled and exists(select 1 from public.universe_launch_regions r where r.slug=d.launch_region and r.enabled));
 if tg_op='UPDATE' then
  if allowed or exists(select 1 from public.universe_plus_one i where i.claimed_user_id=new.id) then return new; end if;
 elsif new.raw_user_meta_data->>'plus_one_token' is not null then
  -- Atomic claim: double use cannot pass even when two signups race or the hook is disabled.
  update public.universe_plus_one i set claimed_user_id=new.id,claimed_at=now()
  where i.token::text=new.raw_user_meta_data->>'plus_one_token' and i.recipient_email=lower(new.email)
   and i.claimed_at is null and i.cancelled_at is null and i.expires_at>now()
   and public.universe_account_kind(i.inviter_id)='university' returning i.inviter_id into claimed;
  if claimed is null then raise exception 'INVITE_INVALID' using errcode='23514'; end if;
  new.raw_user_meta_data:=new.raw_user_meta_data-'plus_one_token';
  return new;
 elsif allowed then return new;
 end if;
 raise exception 'UNIVERSE_UNIVERSITY_REQUIRED' using errcode='23514';
end;
$$;

create or replace function public.universe_current_member() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',u.id,'email',u.email,'name',left(coalesce(u.raw_user_meta_data->>'full_name',''),60),
  'university',case when public.universe_account_kind(u.id)='university' then d.university_name else 'Acceso por invitación' end,
  'account_kind',public.universe_account_kind(u.id))
 from auth.users u left join public.universe_university_domains d on d.domain=split_part(lower(u.email),'@',2) and d.enabled and exists(select 1 from public.universe_launch_regions r where r.slug=d.launch_region and r.enabled)
 where u.id=auth.uid() and public.universe_account_kind(u.id) is not null;
$$;
