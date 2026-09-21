-- Prelaunch list. A visitor may add one address and read nothing back: there is
-- no select policy, so the list is only readable with a server key.
create table public.universe_waitlist (
 id uuid primary key default gen_random_uuid(),
 email text not null unique
  check (length(email) between 6 and 254 and email = lower(email)
   and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
 locale text not null default 'es' check (locale in ('es','va')),
 source text not null default 'landing' check (source in ('landing','roadmap')),
 created_at timestamptz not null default now()
);
alter table public.universe_waitlist enable row level security;
revoke all on public.universe_waitlist from public, anon, authenticated;
-- Only the three columns a visitor fills. id, created_at and the checks stay server side.
grant insert (email, locale, source) on public.universe_waitlist to anon, authenticated;
create policy universe_waitlist_join on public.universe_waitlist
 for insert to anon, authenticated with check (true);
