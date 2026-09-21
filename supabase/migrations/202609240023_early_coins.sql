-- Joining the list before the doors open is worth something on the first day.
-- The bonus rides inside the welcome entry instead of inventing a new ledger
-- reason: the balance is right, the ledger stays legible and no check on the
-- live table has to be rewritten.
create function public.universe_coin_early_bonus() returns integer
language sql immutable set search_path='' as $$ select 30; $$;
revoke all on function public.universe_coin_early_bonus() from public, anon;
grant execute on function public.universe_coin_early_bonus() to authenticated;

create or replace function public.universe_coin_ensure(member_uuid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare
 inserted uuid;
 bonus integer := (public.universe_coin_rules()->>'welcome')::integer;
 early integer := 0;
 note text := '';
begin
 -- The address is the proof: it had to be on the list, and on it before the
 -- opening. Somebody who joins the list afterwards is not an early signup.
 if exists (
  select 1 from public.universe_waitlist w
  join auth.users u on lower(u.email) = w.email
  where u.id = member_uuid
    and w.created_at < (select opens_at from public.universe_signup_launch where id)
 ) then
  early := public.universe_coin_early_bonus();
  note := 'Incluye el saldo de quien estaba en la lista antes de la apertura.';
 end if;

 insert into public.universe_coin_wallets(user_id, balance) values (member_uuid, bonus + early)
 on conflict(user_id) do nothing returning user_id into inserted;
 if inserted is not null then
  insert into public.universe_coin_ledger(user_id, reason, delta, balance_after, label)
  values (member_uuid, 'welcome', bonus + early, bonus + early, note);
 end if;
end;
$$;
revoke all on function public.universe_coin_ensure(uuid) from public, anon, authenticated;
