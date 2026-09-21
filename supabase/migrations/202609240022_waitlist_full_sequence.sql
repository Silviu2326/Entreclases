-- The seven mornings introduce the platform; they are not a countdown. Whoever
-- joins gets all seven, today or in three weeks, opening day or long after it.
-- Replaces the version that stopped scheduling at the opening.
create or replace function public.universe_waitlist_schedule() returns trigger
language plpgsql security definer set search_path='' as $$
declare
 joined date := (new.created_at at time zone 'Europe/Madrid')::date;
 day smallint;
begin
 insert into public.universe_waitlist_emails(waitlist_id, step, send_after) values (new.id, 0, new.created_at);
 for day in 1..7 loop
  insert into public.universe_waitlist_emails(waitlist_id, step, send_after)
  values (new.id, day, ((joined + day) + time '09:00') at time zone 'Europe/Madrid');
 end loop;
 return new;
end;
$$;

-- Every welcome now opens the same sequence, so the sender no longer needs to
-- be told whether one follows.
drop function public.universe_waitlist_due(integer);
create function public.universe_waitlist_due(batch integer default 50)
returns table (queue_id bigint, address text, language text, step smallint, token uuid)
language plpgsql security definer set search_path='' as $$
begin
 return query
 with ready as (
  select q.id from public.universe_waitlist_emails q
  join public.universe_waitlist w on w.id = q.waitlist_id
  where q.sent_at is null and q.send_after <= now() and q.attempts < 5
   and (q.claimed_at is null or q.claimed_at < now() - interval '10 minutes')
   and w.unsubscribed_at is null
  order by q.send_after
  limit batch
  for update of q skip locked
 ), taken as (
  update public.universe_waitlist_emails q set attempts = q.attempts + 1, claimed_at = now()
  where q.id in (select id from ready)
  returning q.id, q.waitlist_id, q.step
 )
 select t.id, w.email, w.locale, t.step, w.unsubscribe_token
 from taken t join public.universe_waitlist w on w.id = t.waitlist_id;
end;
$$;
revoke all on function public.universe_waitlist_due(integer) from public, anon, authenticated;

-- Anybody already on the list who was cut short gets the rest of their
-- mornings, one a day from tomorrow, with no gap where the cut used to be.
insert into public.universe_waitlist_emails(waitlist_id, step, send_after)
select id, step, (((now() at time zone 'Europe/Madrid')::date + place::integer) + time '09:00') at time zone 'Europe/Madrid'
from (
 select w.id, s.step, row_number() over (partition by w.id order by s.step) as place
 from public.universe_waitlist w
 cross join generate_series(1, 7) as s(step)
 where w.unsubscribed_at is null
   and not exists (select 1 from public.universe_waitlist_emails q where q.waitlist_id = w.id and q.step = s.step)
) owed;
