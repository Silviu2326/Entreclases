-- Apply only to the Supabase project dedicated to Universe.
-- No university domains are enabled implicitly: approve exact domains first.
create table public.universe_university_domains (
  domain text primary key check (domain = lower(domain) and domain !~ '[[:space:]@]' and position('.' in domain) > 0),
  university_name text not null check (length(university_name) between 2 and 160),
  enabled boolean not null default false
);
alter table public.universe_university_domains enable row level security;
revoke all on public.universe_university_domains from public, anon, authenticated;
grant select on public.universe_university_domains to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin, authenticated;
create policy "Auth can inspect approved domains" on public.universe_university_domains
  for select to supabase_auth_admin using (true);

-- Enable as Authentication > Hooks > Before User Created.
create function public.universe_before_user_created(event jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  requested_domain text := split_part(lower(coalesce(event->'user'->>'email', '')), '@', 2);
begin
  if coalesce(event->'user'->>'is_anonymous', 'false') = 'true'
    or coalesce(event->'user'->'app_metadata'->>'provider', 'email') <> 'email'
    or not exists (select 1 from public.universe_university_domains d where d.domain = requested_domain and d.enabled)
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
create function public.universe_guard_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null or new.is_anonymous or not exists (
    select 1 from public.universe_university_domains d
    where d.domain = split_part(lower(new.email), '@', 2) and d.enabled
  ) then
    raise exception 'UNIVERSE_UNIVERSITY_REQUIRED' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.universe_guard_email() from public, anon, authenticated;
create trigger universe_check_email before insert or update of email, is_anonymous on auth.users
  for each row execute function public.universe_guard_email();

-- Authoritative account read. No arguments: a caller cannot choose another user.
-- User-editable metadata is used solely for the display name, never permissions.
create function public.universe_current_member()
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
    and d.enabled;
$$;
revoke all on function public.universe_current_member() from public, anon;
grant execute on function public.universe_current_member() to authenticated;

-- Future protected tables must have RLS policies that check the authenticated
-- user AND current university membership. Never authorize via user_metadata.
