-- Señales de hilo. Apply after the existing migrations.
-- A like says "I saw this". A signal says what you are going to do about it:
--   in   → "Me apunto": count me in for what this thread proposes
--   same → "Yo también": I have the same question
--   help → "Te ayudo": I can answer this, talk to me
-- One row per person, thread and kind. Rules mirror universe_likes.
create table public.universe_post_signals (
 post_id uuid references public.universe_posts(id) on delete cascade,
 user_id uuid references public.universe_profiles(user_id) on delete cascade,
 kind text not null check (kind in ('in','same','help')),
 created_at timestamptz not null default now(),
 primary key(post_id,user_id,kind)
);
revoke all on public.universe_post_signals from public,anon,authenticated;
alter table public.universe_post_signals enable row level security;
create policy signals_read on public.universe_post_signals for select to authenticated using((select public.universe_is_member()));
create policy signals_insert on public.universe_post_signals for insert to authenticated with check((select public.universe_is_member()) and user_id=(select auth.uid()));
create policy signals_delete on public.universe_post_signals for delete to authenticated using((select public.universe_is_member()) and user_id=(select auth.uid()));
grant select,insert,delete on public.universe_post_signals to authenticated;
create index universe_post_signals_user on public.universe_post_signals(user_id);
