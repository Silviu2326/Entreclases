-- Entreclases: analítica propia, mínima y protegida.
-- Solo guarda sesiones de cuentas autenticadas, rutas seguras y tiempo activo.
create table public.universe_analytics_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_path text not null default '/app',
  last_path text not null default '/app',
  locale text not null default 'es' check (locale in ('es','va')),
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  active_seconds integer not null default 0 check (active_seconds between 0 and 86400),
  created_at timestamptz not null default now()
);

create table public.universe_analytics_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.universe_analytics_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (event_name ~ '^[a-z][a-z0-9_]{1,47}$'),
  path text not null default '/app',
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now()
);

create index universe_analytics_sessions_user_started_idx on public.universe_analytics_sessions(user_id, started_at desc);
create index universe_analytics_sessions_seen_idx on public.universe_analytics_sessions(last_seen_at desc);
create index universe_analytics_events_name_occurred_idx on public.universe_analytics_events(event_name, occurred_at desc);
create index universe_analytics_events_session_idx on public.universe_analytics_events(session_id, occurred_at desc);

alter table public.universe_analytics_sessions enable row level security;
alter table public.universe_analytics_events enable row level security;
revoke all on public.universe_analytics_sessions, public.universe_analytics_events from public, anon, authenticated;

create or replace function public.universe_analytics_start(
  p_session_id uuid, p_path text default '/app', p_locale text default 'es'
) returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.universe_is_member() then
    raise exception 'UNIVERSE_MEMBER_REQUIRED' using errcode='42501';
  end if;
  if p_session_id is null or p_locale not in ('es','va') then raise exception 'ANALYTICS_INPUT_INVALID'; end if;
  insert into public.universe_analytics_sessions(id,user_id,entry_path,last_path,locale)
  values(p_session_id,auth.uid(),left(coalesce(nullif(p_path,''),'/app'),120),left(coalesce(nullif(p_path,''),'/app'),120),p_locale)
  on conflict (id) do update set last_seen_at=now(), last_path=excluded.last_path, locale=excluded.locale
  where public.universe_analytics_sessions.user_id=auth.uid();
  if not found then raise exception 'ANALYTICS_SESSION_CONFLICT'; end if;
end;
$$;
revoke all on function public.universe_analytics_start(uuid,text,text) from public, anon;
grant execute on function public.universe_analytics_start(uuid,text,text) to authenticated;

create or replace function public.universe_analytics_heartbeat(
  p_session_id uuid, p_path text default '/app', p_active_seconds integer default 0
) returns void language sql security definer set search_path='' as $$
  update public.universe_analytics_sessions
  set last_seen_at=now(), last_path=left(coalesce(nullif(p_path,''),last_path),120), ended_at=null,
      active_seconds=least(86400,active_seconds+greatest(0,least(coalesce(p_active_seconds,0),90)))
  where id=p_session_id and user_id=auth.uid();
$$;
revoke all on function public.universe_analytics_heartbeat(uuid,text,integer) from public, anon;
grant execute on function public.universe_analytics_heartbeat(uuid,text,integer) to authenticated;

create or replace function public.universe_analytics_event(
  p_session_id uuid, p_name text, p_path text default '/app', p_metadata jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or p_session_id is null or p_name is null or p_name !~ '^[a-z][a-z0-9_]{1,47}$' then raise exception 'ANALYTICS_INPUT_INVALID'; end if;
  if jsonb_typeof(coalesce(p_metadata,'{}'::jsonb)) <> 'object' then raise exception 'ANALYTICS_METADATA_INVALID'; end if;
  insert into public.universe_analytics_events(session_id,user_id,event_name,path,metadata)
  select s.id,auth.uid(),p_name,left(coalesce(nullif(p_path,''),s.last_path),120),coalesce(p_metadata,'{}'::jsonb)
  from public.universe_analytics_sessions s
  where s.id=p_session_id and s.user_id=auth.uid();
  if not found then raise exception 'ANALYTICS_SESSION_NOT_FOUND'; end if;
end;
$$;
revoke all on function public.universe_analytics_event(uuid,text,text,jsonb) from public, anon;
grant execute on function public.universe_analytics_event(uuid,text,text,jsonb) to authenticated;

create or replace function public.universe_analytics_end(p_session_id uuid) returns void
language sql security definer set search_path='' as $$
  update public.universe_analytics_sessions set last_seen_at=now(), ended_at=now()
  where id=p_session_id and user_id=auth.uid();
$$;
revoke all on function public.universe_analytics_end(uuid) from public, anon;
grant execute on function public.universe_analytics_end(uuid) to authenticated;

create or replace function public.universe_analytics_snapshot(p_days integer default 30)
returns jsonb language plpgsql security definer set search_path='' as $$
declare days integer := least(greatest(coalesce(p_days,30),1),90); cutoff timestamptz := now() - make_interval(days => days);
begin
  if not public.universe_backoffice_can('support') then raise exception 'BACKOFFICE_ACCESS_REQUIRED' using errcode='42501'; end if;
  return jsonb_build_object(
    'period_days',days,
    'sessions',(select count(*) from public.universe_analytics_sessions where started_at>=cutoff),
    'members',(select count(distinct user_id) from public.universe_analytics_sessions where started_at>=cutoff),
    'active_now',(select count(*) from public.universe_analytics_sessions where last_seen_at>=now()-interval '5 minutes' and ended_at is null),
    'avg_active_seconds',coalesce((select round(avg(active_seconds))::integer from public.universe_analytics_sessions where started_at>=cutoff),0),
    'top_pages',coalesce((select jsonb_agg(jsonb_build_object('path',path,'sessions',sessions) order by sessions desc) from (select entry_path path,count(*) sessions from public.universe_analytics_sessions where started_at>=cutoff group by entry_path order by sessions desc limit 8) pages),'[]'::jsonb),
    'top_events',coalesce((select jsonb_agg(jsonb_build_object('event_name',event_name,'events',events) order by events desc) from (select event_name,count(*) events from public.universe_analytics_events where occurred_at>=cutoff group by event_name order by events desc limit 8) events),'[]'::jsonb),
    'daily',coalesce((select jsonb_agg(jsonb_build_object('day',day,'sessions',sessions,'members',members,'active_seconds',active_seconds) order by day) from (select started_at::date day,count(*) sessions,count(distinct user_id) members,coalesce(sum(active_seconds),0)::integer active_seconds from public.universe_analytics_sessions where started_at>=cutoff group by started_at::date order by day) daily),'[]'::jsonb)
  );
end;
$$;
revoke all on function public.universe_analytics_snapshot(integer) from public, anon;
grant execute on function public.universe_analytics_snapshot(integer) to authenticated;

