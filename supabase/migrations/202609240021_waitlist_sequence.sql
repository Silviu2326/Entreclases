-- The prelaunch sequence: a welcome the moment somebody joins, then seven
-- mornings at 09:00 Europe/Madrid. Nothing here sends anything; it only decides
-- what is owed to whom and when. The sender is the waitlist-mailer function.

alter table public.universe_waitlist
 add column unsubscribe_token uuid not null default gen_random_uuid(),
 add column unsubscribed_at timestamptz;
create unique index universe_waitlist_token on public.universe_waitlist(unsubscribe_token);

create table public.universe_waitlist_emails (
 id bigint generated always as identity primary key,
 waitlist_id uuid not null references public.universe_waitlist(id) on delete cascade,
 step smallint not null check (step between 0 and 7),
 send_after timestamptz not null,
 sent_at timestamptz,
 -- Taken by a sender and not yet reported. Row locks die with the transaction,
 -- so without this a second run a second later would write to the same person.
 claimed_at timestamptz,
 attempts smallint not null default 0,
 last_error text,
 unique (waitlist_id, step)
);
create index universe_waitlist_emails_due on public.universe_waitlist_emails(send_after) where sent_at is null;
alter table public.universe_waitlist_emails enable row level security;
-- No policy and no grant: the queue is readable only with a server key.
revoke all on public.universe_waitlist_emails from public, anon, authenticated;

-- Step 0 goes out now. Steps 1..7 land at 09:00 Madrid on each following day,
-- and stop at the opening: nobody should read «faltan días para el 28» in October.
create function public.universe_waitlist_schedule() returns trigger
language plpgsql security definer set search_path='' as $$
declare
 joined date := (new.created_at at time zone 'Europe/Madrid')::date;
 deadline timestamptz := (select opens_at + interval '12 hours' from public.universe_signup_launch where id);
 morning timestamptz;
 day smallint;
begin
 insert into public.universe_waitlist_emails(waitlist_id, step, send_after) values (new.id, 0, new.created_at);
 for day in 1..7 loop
  morning := ((joined + day) + time '09:00') at time zone 'Europe/Madrid';
  exit when deadline is not null and morning > deadline;
  insert into public.universe_waitlist_emails(waitlist_id, step, send_after) values (new.id, day, morning);
 end loop;
 return new;
end;
$$;
revoke all on function public.universe_waitlist_schedule() from public, anon, authenticated;
create trigger universe_waitlist_sequence after insert on public.universe_waitlist
for each row execute function public.universe_waitlist_schedule();

-- Claiming and reporting are one round trip each. A claim is a ten minute
-- lease: two senders never take the same row, and a sender that dies mid-flight
-- does not strand the morning it was holding.
create function public.universe_waitlist_due(batch integer default 50)
returns table (queue_id bigint, address text, language text, step smallint, token uuid, alone boolean)
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
 select t.id, w.email, w.locale, t.step, w.unsubscribe_token,
  -- A late joiner gets the welcome and nothing else: the copy has to know.
  not exists (select 1 from public.universe_waitlist_emails p where p.waitlist_id = t.waitlist_id and p.step > 0)
 from taken t join public.universe_waitlist w on w.id = t.waitlist_id;
end;
$$;

create function public.universe_waitlist_sent(queue_id bigint, failure text default null)
returns void language sql security definer set search_path='' as $$
 update public.universe_waitlist_emails
 set sent_at = case when failure is null then now() end, last_error = failure,
     -- A reported failure is free to retry at once; it does not hold the lease.
     claimed_at = case when failure is null then claimed_at end
 where id = queue_id;
$$;

create function public.universe_waitlist_unsubscribe(token uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare found boolean;
begin
 update public.universe_waitlist set unsubscribed_at = coalesce(unsubscribed_at, now())
 where unsubscribe_token = token returning true into found;
 return coalesce(found, false);
end;
$$;

revoke all on function public.universe_waitlist_due(integer) from public, anon, authenticated;
revoke all on function public.universe_waitlist_sent(bigint, text) from public, anon, authenticated;
revoke all on function public.universe_waitlist_unsubscribe(uuid) from public, anon, authenticated;
