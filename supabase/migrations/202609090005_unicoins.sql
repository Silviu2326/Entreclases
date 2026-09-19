-- Unicoins are internal participation incentives. There are no purchase,
-- transfer, sale, withdrawal, payment-provider or cash-conversion operations.
create function public.universe_coin_rules() returns jsonb
language sql immutable set search_path='' as $$
 select '{"welcome":20,"createEvent":10,"createThread":5,"joinEvent":3,"replyThread":2,"eventRewardsPerDay":2,"threadRewardsPerDay":3}'::jsonb;
$$;
revoke all on function public.universe_coin_rules() from public,anon;
grant execute on function public.universe_coin_rules() to authenticated;

create table public.universe_coin_wallets (
 user_id uuid primary key references public.universe_profiles(user_id) on delete cascade,
 balance integer not null default 0 check(balance>=0),
 created_at timestamptz not null default now()
);
create table public.universe_coin_ledger (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.universe_coin_wallets(user_id) on delete cascade,
 reason text not null check(reason in ('welcome','create_event','create_thread','join_event','reply_thread')),
 delta integer not null check(delta<>0),
 balance_after integer not null check(balance_after>=0),
 -- Intentionally not a FK to content: deleting content must not erase a charge
 -- or permit earning the same reward again.
 resource_id uuid,
 label text not null default '' check(char_length(label)<=160),
 created_at timestamptz not null default now(),
 check((reason='welcome' and resource_id is null) or (reason<>'welcome' and resource_id is not null)),
 check((reason in ('welcome','join_event','reply_thread') and delta>0) or (reason in ('create_event','create_thread') and delta<0)),
 unique(user_id,reason,resource_id)
);
create unique index universe_coin_welcome_once on public.universe_coin_ledger(user_id) where reason='welcome';
create index universe_coin_ledger_recent on public.universe_coin_ledger(user_id,created_at desc,id desc);
create index universe_coin_ledger_daily on public.universe_coin_ledger(user_id,reason,created_at) where delta>0;
create table public.universe_coin_claims (
 user_id uuid not null references public.universe_profiles(user_id) on delete cascade,
 reason text not null check(reason in ('join_event','reply_thread')),
 resource_id uuid not null,
 created_at timestamptz not null default now(),
 primary key(user_id,reason,resource_id)
);
revoke all on public.universe_coin_wallets,public.universe_coin_ledger,public.universe_coin_claims from public,anon,authenticated;
alter table public.universe_coin_wallets enable row level security;
alter table public.universe_coin_ledger enable row level security;
alter table public.universe_coin_claims enable row level security;
create policy coin_wallet_own on public.universe_coin_wallets for select to authenticated using((select public.universe_is_member()) and user_id=(select auth.uid()));
create policy coin_ledger_own on public.universe_coin_ledger for select to authenticated using((select public.universe_is_member()) and user_id=(select auth.uid()));
create policy coin_claims_own on public.universe_coin_claims for select to authenticated using((select public.universe_is_member()) and user_id=(select auth.uid()));
grant select on public.universe_coin_wallets,public.universe_coin_ledger,public.universe_coin_claims to authenticated;

-- A wallet is initialized once, including for pre-existing verified profiles.
-- The unique user row serializes concurrent initialization before awarding 20.
create function public.universe_coin_ensure(member_uuid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare inserted uuid; bonus integer:=(public.universe_coin_rules()->>'welcome')::integer;
begin
 insert into public.universe_coin_wallets(user_id,balance) values(member_uuid,bonus)
 on conflict(user_id) do nothing returning user_id into inserted;
 if inserted is not null then
  insert into public.universe_coin_ledger(user_id,reason,delta,balance_after) values(member_uuid,'welcome',bonus,bonus);
 end if;
end;
$$;
revoke all on function public.universe_coin_ensure(uuid) from public,anon,authenticated;

create function public.universe_coin_spend(member_uuid uuid, amount integer, operation text, resource_uuid uuid, resource_label text) returns void
language plpgsql security definer set search_path='' as $$
declare available integer;
begin
 if operation not in ('create_event','create_thread') or amount<=0 then raise exception 'INVALID_COIN_OPERATION'; end if;
 perform public.universe_coin_ensure(member_uuid);
 select balance into available from public.universe_coin_wallets where user_id=member_uuid for update;
 if exists(select 1 from public.universe_coin_ledger where user_id=member_uuid and reason=operation and resource_id=resource_uuid) then raise exception 'UNICOINS_REQUEST_USED'; end if;
 if available<amount then raise exception 'UNICOINS_INSUFFICIENT' using errcode='P0001'; end if;
 update public.universe_coin_wallets set balance=balance-amount where user_id=member_uuid;
 insert into public.universe_coin_ledger(user_id,reason,delta,balance_after,resource_id,label)
 values(member_uuid,operation,-amount,available-amount,resource_uuid,left(resource_label,160));
end;
$$;
revoke all on function public.universe_coin_spend(uuid,integer,text,uuid,text) from public,anon,authenticated;

create function public.universe_coin_reward(member_uuid uuid, operation text, resource_uuid uuid, resource_label text) returns void
language plpgsql security definer set search_path='' as $$
declare available integer; reward integer; daily_limit integer; claimed uuid;
 rules jsonb:=public.universe_coin_rules();
 day_start timestamptz:=date_trunc('day',now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid';
begin
 if operation='join_event' then reward:=(rules->>'joinEvent')::integer; daily_limit:=(rules->>'eventRewardsPerDay')::integer;
 elsif operation='reply_thread' then reward:=(rules->>'replyThread')::integer; daily_limit:=(rules->>'threadRewardsPerDay')::integer;
 else raise exception 'INVALID_COIN_OPERATION'; end if;
 perform public.universe_coin_ensure(member_uuid);
 -- Rewards and spending lock the same wallet, so parallel actions cannot
 -- overdraw it or race past a daily reward cap.
 select balance into available from public.universe_coin_wallets where user_id=member_uuid for update;
 insert into public.universe_coin_claims(user_id,reason,resource_id) values(member_uuid,operation,resource_uuid)
 on conflict do nothing returning resource_id into claimed;
 if claimed is null then return; end if;
 -- A first participation consumes its claim even after the daily cap. It
 -- cannot be replayed tomorrow by leaving/rejoining or repeating a reply.
 if (select count(*) from public.universe_coin_ledger where user_id=member_uuid and reason=operation and created_at>=day_start)>=daily_limit then return; end if;
 update public.universe_coin_wallets set balance=balance+reward where user_id=member_uuid;
 insert into public.universe_coin_ledger(user_id,reason,delta,balance_after,resource_id,label)
 values(member_uuid,operation,reward,available+reward,resource_uuid,left(resource_label,160));
end;
$$;
revoke all on function public.universe_coin_reward(uuid,text,uuid,text) from public,anon,authenticated;

create function public.universe_coin_profile_created() returns trigger
language plpgsql security definer set search_path='' as $$
begin perform public.universe_coin_ensure(new.user_id); return new; end;
$$;
revoke all on function public.universe_coin_profile_created() from public,anon,authenticated;
create trigger universe_coin_profile_created after insert on public.universe_profiles for each row execute function public.universe_coin_profile_created();

create function public.universe_coin_content_created() returns trigger
language plpgsql security definer set search_path='' as $$
declare rules jsonb:=public.universe_coin_rules();
begin
 if tg_table_name='universe_plans' then
  perform public.universe_coin_spend(new.creator_id,(rules->>'createEvent')::integer,'create_event',new.id,new.title);
 else
  perform public.universe_coin_spend(new.author_id,(rules->>'createThread')::integer,'create_thread',new.id,new.body);
 end if;
 return new;
end;
$$;
revoke all on function public.universe_coin_content_created() from public,anon,authenticated;
-- AFTER INSERT runs after constraints and RLS. Any error rolls back the content,
-- its related rows and its ledger entries in the same PostgreSQL transaction.
create trigger universe_coin_event_created after insert on public.universe_plans for each row execute function public.universe_coin_content_created();
create trigger universe_coin_thread_created after insert on public.universe_posts for each row execute function public.universe_coin_content_created();

create function public.universe_coin_event_joined() returns trigger
language plpgsql security definer set search_path='' as $$
declare event public.universe_plans;
begin
 select * into event from public.universe_plans where id=new.plan_id;
 if new.user_id<>event.creator_id and event.starts_at>now() then
  perform public.universe_coin_reward(new.user_id,'join_event',new.plan_id,event.title);
 end if;
 return new;
end;
$$;
revoke all on function public.universe_coin_event_joined() from public,anon,authenticated;
create trigger universe_coin_event_joined after insert on public.universe_plan_members for each row execute function public.universe_coin_event_joined();

create function public.universe_coin_thread_replied() returns trigger
language plpgsql security definer set search_path='' as $$
declare post public.universe_posts;
begin
 select * into post from public.universe_posts where id=new.post_id;
 if new.author_id<>post.author_id then
  perform public.universe_coin_reward(new.author_id,'reply_thread',new.post_id,post.body);
 end if;
 return new;
end;
$$;
revoke all on function public.universe_coin_thread_replied() from public,anon,authenticated;
create trigger universe_coin_thread_replied after insert on public.universe_comments for each row execute function public.universe_coin_thread_replied();

-- Earlier participation gets no retroactive reward and cannot be farmed by
-- replaying it after this release. No previous creations are charged.
insert into public.universe_coin_claims(user_id,reason,resource_id)
 select m.user_id,'join_event',m.plan_id from public.universe_plan_members m join public.universe_plans p on p.id=m.plan_id where m.user_id<>p.creator_id
 on conflict do nothing;
insert into public.universe_coin_claims(user_id,reason,resource_id)
 select distinct c.author_id,'reply_thread',c.post_id from public.universe_comments c join public.universe_posts p on p.id=c.post_id where c.author_id<>p.author_id
 on conflict do nothing;

create function public.universe_coin_wallet() returns jsonb
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
  'transactions',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id desc) from (select id,reason,delta,balance_after,resource_id,label,created_at from public.universe_coin_ledger where user_id=caller order by created_at desc,id desc limit 50) t),'[]'::jsonb),
  'claimed_events',coalesce((select jsonb_agg(resource_id) from public.universe_coin_claims where user_id=caller and reason='join_event'),'[]'::jsonb),
  'claimed_threads',coalesce((select jsonb_agg(resource_id) from public.universe_coin_claims where user_id=caller and reason='reply_thread'),'[]'::jsonb),
  'day',local_day,
  'today',jsonb_build_object('events',(select count(*) from public.universe_coin_ledger where user_id=caller and reason='join_event' and created_at>=day_start),'replies',(select count(*) from public.universe_coin_ledger where user_id=caller and reason='reply_thread' and created_at>=day_start))
 );
end;
$$;
revoke all on function public.universe_coin_wallet() from public,anon;
grant execute on function public.universe_coin_wallet() to authenticated;
