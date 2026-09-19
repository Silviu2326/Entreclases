-- Launch scope is reviewed in the database, never supplied by a profile.
-- Existing enabled domains remain closed until their launch region is reviewed.
alter table public.universe_university_domains add column launch_region text
  check (launch_region ~ '^[a-z][a-z0-9-]{1,40}$');

-- Verified student domain: Universitat de València.
-- https://www.uv.es/uvweb/filologia-traduccion-comunicacion/es/facultad/secretaria/tramites-procedimientos/consultas-1285960482280.html
-- Prepared but disabled: the project owner enables reviewed institutions on opening.
insert into public.universe_university_domains (domain, university_name, enabled, launch_region)
values ('alumni.uv.es', 'Universitat de València', false, 'valencia')
on conflict (domain) do nothing;

create or replace function public.universe_before_user_created(event jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  requested_domain text := split_part(lower(coalesce(event->'user'->>'email', '')), '@', 2);
begin
  if coalesce(event->'user'->>'is_anonymous', 'false') = 'true'
    or coalesce(event->'user'->'app_metadata'->>'provider', 'email') <> 'email'
    or not exists (select 1 from public.universe_university_domains d where d.domain = requested_domain and d.enabled and d.launch_region = 'valencia')
  then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'UNIVERSE_UNIVERSITY_REQUIRED'));
  end if;
  return '{}'::jsonb;
end;
$$;
revoke all on function public.universe_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.universe_before_user_created(jsonb) to supabase_auth_admin;

-- Also enforce the exact domain at the database boundary, including email changes.
-- This guard remains effective if the dashboard hook is accidentally disabled.
create or replace function public.universe_guard_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null or new.is_anonymous or not exists (
    select 1 from public.universe_university_domains d
    where d.domain = split_part(lower(new.email), '@', 2) and d.enabled and d.launch_region = 'valencia'
  ) then
    raise exception 'UNIVERSE_UNIVERSITY_REQUIRED' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.universe_guard_email() from public, anon, authenticated;
-- The existing trigger uses the replaced function automatically.

-- Authoritative account read. No arguments: a caller cannot choose another user.
-- User-editable metadata is used solely for the display name, never permissions.
create or replace function public.universe_current_member()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'name', left(coalesce(u.raw_user_meta_data->>'full_name', ''), 60),
    'university', d.university_name
  )
  from auth.users u
  join public.universe_university_domains d on d.domain = split_part(lower(u.email), '@', 2)
  where u.id = (select auth.uid())
    and u.email_confirmed_at is not null
    and not coalesce(u.is_anonymous, false)
    and d.enabled and d.launch_region = 'valencia';
$$;
revoke all on function public.universe_current_member() from public, anon;
grant execute on function public.universe_current_member() to authenticated;

