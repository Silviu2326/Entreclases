-- Server-side gate for NEW accounts only. Existing sign-in remains available.
create table public.universe_signup_launch (
 id boolean primary key default true check(id),
 opens_at timestamptz not null,
 enabled boolean not null default false
);
alter table public.universe_signup_launch enable row level security;
revoke all on public.universe_signup_launch from public, anon, authenticated;
insert into public.universe_signup_launch(id,opens_at,enabled)
values(true,'2026-09-28T00:00:00+02:00',false);

create function public.universe_guard_scheduled_launch() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.universe_signup_launch where id and enabled and now()>=opens_at) then
  raise exception 'UNIVERSE_REGISTRATION_NOT_OPEN' using errcode='23514';
 end if;
 return new;
end;
$$;
revoke all on function public.universe_guard_scheduled_launch() from public,anon,authenticated;
-- Runs before other signup guards and invitation claims. Never trust client clocks/metadata.
create trigger universe_00_scheduled_launch before insert on auth.users
for each row execute function public.universe_guard_scheduled_launch();
