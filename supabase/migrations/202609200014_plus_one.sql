-- Tu +1. Apply after the existing migrations. No client metadata grants access.
-- Keep consumed slots even after either auth account is deleted (no cascading FK).
create table public.universe_plus_one (
 inviter_id uuid primary key,
 token uuid not null unique default gen_random_uuid(),
 recipient_email text not null check (recipient_email = lower(btrim(recipient_email))),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now() + interval '7 days',
 cancelled_at timestamptz,
 claimed_user_id uuid unique,
 claimed_at timestamptz,
 check ((claimed_user_id is null) = (claimed_at is null))
);
alter table public.universe_plus_one enable row level security;
revoke all on public.universe_plus_one from public, anon, authenticated, supabase_auth_admin;

-- Internal helpers have no API grants, including lookup by arbitrary user id.
create function public.universe_account_kind(account_id uuid) returns text
language sql stable security definer set search_path='' as $$
 select case when exists (
  select 1 from public.universe_university_domains d
  where d.domain=split_part(lower(u.email),'@',2) and d.enabled and d.launch_region='valencia'
 ) then 'university' when exists (
  select 1 from public.universe_plus_one i where i.claimed_user_id=u.id
 ) then 'guest' end
 from auth.users u where u.id=account_id and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false);
$$;
revoke all on function public.universe_account_kind(uuid) from public, anon, authenticated;

create function public.universe_plus_one_eligible(account_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(public.universe_account_kind(account_id)='university',false)
 and exists(select 1 from public.universe_profiles p where p.user_id=account_id and length(btrim(p.bio))>0 and cardinality(p.interests)>0)
 and (exists(select 1 from public.universe_posts p where p.author_id=account_id)
   or exists(select 1 from public.universe_comments c where c.author_id=account_id)
   or exists(select 1 from public.universe_plan_members m where m.user_id=account_id));
$$;
revoke all on function public.universe_plus_one_eligible(uuid) from public, anon, authenticated;

create function public.universe_plus_one_status() returns jsonb
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); kind text:=public.universe_account_kind(caller); invitation public.universe_plus_one;
begin
 if kind is null then raise exception 'INVITE_ACCESS_REQUIRED'; end if;
 if kind='guest' then return jsonb_build_object('state','guest'); end if;
 select * into invitation from public.universe_plus_one where inviter_id=caller;
 if invitation.claimed_at is not null then return jsonb_build_object('state','used'); end if;
 if not public.universe_plus_one_eligible(caller) then return jsonb_build_object('state','locked'); end if;
 if invitation.inviter_id is null or invitation.cancelled_at is not null or invitation.expires_at<=now() then return jsonb_build_object('state','available'); end if;
 return jsonb_build_object('state','pending','token',invitation.token,'email',invitation.recipient_email,'expires_at',invitation.expires_at);
end;
$$;
revoke all on function public.universe_plus_one_status() from public, anon;
grant execute on function public.universe_plus_one_status() to authenticated;

create function public.universe_create_plus_one(recipient text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); target text:=lower(btrim(recipient)); invitation public.universe_plus_one;
begin
 -- Serialize competing issue/cancel requests from the same account.
 perform 1 from auth.users where id=caller for update;
 if not public.universe_plus_one_eligible(caller) then raise exception 'INVITE_NOT_ELIGIBLE'; end if;
 if target is null or length(target)>254 or target !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  or exists(select 1 from auth.users where id=caller and lower(email)=target) then raise exception 'INVITE_EMAIL_INVALID'; end if;
 select * into invitation from public.universe_plus_one where inviter_id=caller for update;
 if invitation.claimed_at is not null then raise exception 'INVITE_ALREADY_USED'; end if;
 if invitation.inviter_id is not null and invitation.cancelled_at is null and invitation.expires_at>now() then
  if invitation.recipient_email<>target then raise exception 'INVITE_PENDING'; end if;
  return public.universe_plus_one_status();
 end if;
 insert into public.universe_plus_one(inviter_id,recipient_email) values(caller,target)
 on conflict(inviter_id) do update set token=gen_random_uuid(),recipient_email=excluded.recipient_email,
  created_at=now(),expires_at=now()+interval '7 days',cancelled_at=null;
 return public.universe_plus_one_status();
end;
$$;
revoke all on function public.universe_create_plus_one(text) from public, anon;
grant execute on function public.universe_create_plus_one(text) to authenticated;

create function public.universe_cancel_plus_one() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from auth.users where id=auth.uid() for update;
 if public.universe_account_kind(auth.uid()) is distinct from 'university' then raise exception 'INVITE_NOT_ELIGIBLE'; end if;
 -- A used invitation cannot be revoked by the inviter, even before confirmation.
 update public.universe_plus_one set cancelled_at=now() where inviter_id=auth.uid() and claimed_at is null;
 return public.universe_plus_one_status();
end;
$$;
revoke all on function public.universe_cancel_plus_one() from public, anon;
grant execute on function public.universe_cancel_plus_one() to authenticated;

-- The auth hook provides early feedback; the trigger below is the authority.
create or replace function public.universe_before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare email text:=lower(coalesce(event->'user'->>'email','')); invite text:=event->'user'->'user_metadata'->>'plus_one_token';
begin
 if coalesce(event->'user'->>'is_anonymous','false')='true'
  or coalesce(event->'user'->'app_metadata'->>'provider','email')<>'email' then
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','UNIVERSE_UNIVERSITY_REQUIRED'));
 end if;
 if exists(select 1 from public.universe_university_domains d where d.domain=split_part(email,'@',2) and d.enabled and d.launch_region='valencia')
 or exists(select 1 from public.universe_plus_one i where i.token::text=invite and i.recipient_email=email
  and i.claimed_at is null and i.cancelled_at is null and i.expires_at>now() and public.universe_account_kind(i.inviter_id)='university') then return '{}'::jsonb; end if;
 return jsonb_build_object('error',jsonb_build_object('http_code',403,'message',case when invite is not null then 'INVITE_INVALID' else 'UNIVERSE_UNIVERSITY_REQUIRED' end));
end;
$$;
revoke all on function public.universe_before_user_created(jsonb) from public,anon,authenticated;
grant execute on function public.universe_before_user_created(jsonb) to supabase_auth_admin;

create or replace function public.universe_guard_email() returns trigger
language plpgsql security definer set search_path='' as $$
declare allowed boolean; claimed uuid;
begin
 if new.email is null or coalesce(new.is_anonymous,false) then raise exception 'UNIVERSE_UNIVERSITY_REQUIRED' using errcode='23514'; end if;
 allowed:=exists(select 1 from public.universe_university_domains d where d.domain=split_part(lower(new.email),'@',2) and d.enabled and d.launch_region='valencia');
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
 from auth.users u left join public.universe_university_domains d on d.domain=split_part(lower(u.email),'@',2) and d.enabled and d.launch_region='valencia'
 where u.id=auth.uid() and public.universe_account_kind(u.id) is not null;
$$;

alter table public.universe_profiles add column account_kind text not null default 'university' check(account_kind in ('university','guest'));
alter table public.universe_profiles drop constraint universe_profiles_year_check;
alter table public.universe_profiles add constraint universe_profiles_year_check check(year between 0 and 6);
alter table public.universe_profiles drop constraint universe_profiles_campus_check;
alter table public.universe_profiles add constraint universe_profiles_campus_check check(campus in ('Tarongers','Blasco Ibáñez','Vera','Burjassot-Paterna','Otra sede en Valencia','Valencia'));
create or replace function public.universe_profile_identity() returns trigger
language plpgsql security definer set search_path='' as $$
declare member jsonb:=public.universe_current_member();
begin
 if member is null or new.user_id<>(member->>'id')::uuid then raise exception 'UNIVERSE_UNIVERSITY_REQUIRED' using errcode='42501'; end if;
 if tg_op='UPDATE' and new.user_id<>old.user_id then raise exception 'IMMUTABLE_ID' using errcode='42501'; end if;
 new.university:=member->>'university'; new.account_kind:=member->>'account_kind';
 if new.account_kind='guest' then new.year:=0;
 elsif new.year<1 then raise exception 'PROFILE_YEAR_REQUIRED'; end if;
 return new;
end;
$$;

create or replace function public.universe_open_thread(peer_uuid uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); a uuid; b uuid; result uuid;
begin
 if not public.universe_is_member() then raise exception 'UNIVERSE_UNIVERSITY_REQUIRED' using errcode='42501'; end if;
 if peer_uuid is null or peer_uuid=caller or public.universe_account_kind(peer_uuid) is null
  or not exists(select 1 from public.universe_profiles p where p.user_id=peer_uuid) then raise exception 'PEER_UNAVAILABLE'; end if;
 a:=least(caller,peer_uuid); b:=greatest(caller,peer_uuid);
 insert into public.universe_threads(user_a,user_b) values(a,b) on conflict(user_a,user_b) do update set user_a=excluded.user_a returning id into result;
 return result;
end;
$$;
