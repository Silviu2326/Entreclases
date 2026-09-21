-- Report the current reward policy while preserving the paid action costs.
create or replace function public.universe_coin_rules() returns jsonb
language sql immutable set search_path='' as $$
 select '{"welcome":20,"createEvent":10,"createThread":5,"joinEvent":0,"replyThread":2,"eventRewardsPerDay":0,"threadRewardsPerDay":3}'::jsonb;
$$;

-- Preserve all historical balances and ledger entries.
create table public.universe_free_threads (
 user_id uuid primary key references auth.users(id) on delete cascade,
 resource_id uuid not null,
 created_at timestamptz not null default now()
);
alter table public.universe_free_threads enable row level security;
revoke all on public.universe_free_threads from public, anon, authenticated;

create or replace function public.universe_coin_content_created() returns trigger
language plpgsql security definer set search_path='' as $$
declare rules jsonb:=public.universe_coin_rules(); free_claim uuid;
begin
 if tg_table_name='universe_plans' then
  perform public.universe_coin_spend(new.creator_id,(rules->>'createEvent')::integer,'create_event',new.id,new.title);
 else
  perform public.universe_coin_ensure(new.author_id);
  perform 1 from public.universe_coin_wallets where user_id=new.author_id for update;
  if exists(select 1 from public.universe_free_threads where user_id=new.author_id and resource_id=new.id) then raise exception 'UNICOINS_REQUEST_USED'; end if;
  if not exists(select 1 from public.universe_coin_ledger where user_id=new.author_id and reason='create_thread') then
   insert into public.universe_free_threads(user_id,resource_id) values(new.author_id,new.id)
   on conflict(user_id) do nothing returning user_id into free_claim;
  end if;
  if free_claim is null then perform public.universe_coin_spend(new.author_id,(rules->>'createThread')::integer,'create_thread',new.id,new.body); end if;
 end if;
 return new;
end;
$$;

-- A signup is not attendance. No new rewards are issued for joining events.
create or replace function public.universe_coin_event_joined() returns trigger
language plpgsql security definer set search_path='' as $$
begin return new; end;
$$;

create or replace function public.universe_coin_wallet() returns jsonb
language plpgsql security definer set search_path='' as $$
declare caller uuid:=(select auth.uid()); available integer;
 day_start timestamptz:=date_trunc('day',now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid';
 local_day text:=to_char(now() at time zone 'Europe/Madrid','YYYY-MM-DD');
begin
 if not public.universe_is_member() then raise exception 'UNIVERSE_UNIVERSITY_REQUIRED' using errcode='42501'; end if;
 if not exists(select 1 from public.universe_profiles where user_id=caller) then
  return jsonb_build_object('balance',0,'transactions','[]'::jsonb,'claimed_events','[]'::jsonb,'claimed_threads','[]'::jsonb,'day',local_day,'today',jsonb_build_object('events',0,'replies',0));
 end if;
 perform public.universe_coin_ensure(caller);
 select balance into available from public.universe_coin_wallets where user_id=caller for update;
 return jsonb_build_object(
  'balance',available,
  'first_thread_available',not exists(select 1 from public.universe_free_threads where user_id=caller) and not exists(select 1 from public.universe_coin_ledger where user_id=caller and reason='create_thread'),
  'event_rewards_enabled',false,
  'transactions',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id desc) from (select id,reason,delta,balance_after,resource_id,label,created_at from public.universe_coin_ledger where user_id=caller order by created_at desc,id desc limit 50) t),'[]'::jsonb),
  'claimed_events',coalesce((select jsonb_agg(resource_id) from public.universe_coin_claims where user_id=caller and reason='join_event'),'[]'::jsonb),
  'claimed_threads',coalesce((select jsonb_agg(resource_id) from public.universe_coin_claims where user_id=caller and reason='reply_thread'),'[]'::jsonb),
  'day',local_day,
  'today',jsonb_build_object('events',(select count(*) from public.universe_coin_ledger where user_id=caller and reason='join_event' and created_at>=day_start),'replies',(select count(*) from public.universe_coin_ledger where user_id=caller and reason='reply_thread' and created_at>=day_start))
 );
end;
$$;
