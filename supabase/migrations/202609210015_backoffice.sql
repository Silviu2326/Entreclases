-- Private operations layer for the Entreclase backoffice.
-- All records below are hidden behind a security-definer RPC. The public client
-- never receives direct table grants, and every mutation is audited.

create table public.universe_backoffice_roles (
  user_id uuid primary key references public.universe_profiles(user_id) on delete cascade,
  role text not null check (role in ('admin','moderator','editor','support')),
  granted_by uuid references public.universe_profiles(user_id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.universe_backoffice_roles enable row level security;
revoke all on public.universe_backoffice_roles from public, anon, authenticated;

create table public.universe_backoffice_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.universe_profiles(user_id) on delete set null,
  target_type text not null check (target_type in ('profile','post','comment','group','plan','project','game','message')),
  target_id uuid not null,
  reason_code text not null check (length(btrim(reason_code)) between 2 and 40),
  detail text not null default '' check (length(detail) <= 1200),
  content_excerpt text not null default '' check (length(content_excerpt) <= 600),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  status text not null default 'pending' check (status in ('pending','in_review','resolved','dismissed','escalated')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to uuid references public.universe_profiles(user_id) on delete set null,
  resolution text not null default '' check (length(resolution) <= 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.universe_backoffice_reports enable row level security;
revoke all on public.universe_backoffice_reports from public, anon, authenticated;
create index universe_backoffice_reports_queue on public.universe_backoffice_reports(status, priority, created_at desc);
create index universe_backoffice_reports_target on public.universe_backoffice_reports(target_type, target_id);

create table public.universe_backoffice_restrictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.universe_profiles(user_id) on delete cascade,
  kind text not null check (kind in ('warning','suspension','ban')),
  reason text not null check (length(btrim(reason)) between 3 and 1200),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid not null references public.universe_profiles(user_id) on delete restrict,
  revoked_at timestamptz,
  revoked_by uuid references public.universe_profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
alter table public.universe_backoffice_restrictions enable row level security;
revoke all on public.universe_backoffice_restrictions from public, anon, authenticated;
create index universe_backoffice_restrictions_user on public.universe_backoffice_restrictions(user_id, revoked_at, ends_at);

create table public.universe_backoffice_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references public.universe_profiles(user_id) on delete set null,
  action text not null check (length(btrim(action)) between 2 and 80),
  resource_type text not null check (length(btrim(resource_type)) between 2 and 40),
  resource_id uuid,
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object'),
  created_at timestamptz not null default now()
);
alter table public.universe_backoffice_audit enable row level security;
revoke all on public.universe_backoffice_audit from public, anon, authenticated;
create index universe_backoffice_audit_recent on public.universe_backoffice_audit(created_at desc);

create table public.universe_backoffice_feature_flags (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{2,80}$'),
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  updated_by uuid references public.universe_profiles(user_id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.universe_backoffice_feature_flags enable row level security;
revoke all on public.universe_backoffice_feature_flags from public, anon, authenticated;

insert into public.universe_backoffice_feature_flags(key, enabled, config)
values
 ('explore_projects', true, '{"highlighted_limit":6}'),
 ('game_questions', true, '{"anonymous":true}'),
 ('magazine_submissions', true, '{"max_images":4}')
on conflict (key) do nothing;

create or replace function public.universe_backoffice_role()
returns text language sql stable security definer set search_path='' as $$
  select coalesce(
    (select r.role from public.universe_backoffice_roles r where r.user_id = auth.uid() and r.revoked_at is null),
    case when exists (select 1 from public.universe_magazine_editors e where e.user_id = auth.uid()) then 'editor' end
  );
$$;
revoke all on function public.universe_backoffice_role() from public, anon;
grant execute on function public.universe_backoffice_role() to authenticated;

create or replace function public.universe_backoffice_can(required_role text)
returns boolean language sql stable security definer set search_path='' as $$
  select case public.universe_backoffice_role()
    when 'admin' then true
    when 'moderator' then required_role in ('moderator','support')
    when 'editor' then required_role = 'editor'
    when 'support' then required_role = 'support'
    else false
  end;
$$;
revoke all on function public.universe_backoffice_can(text) from public, anon;
grant execute on function public.universe_backoffice_can(text) to authenticated;

create or replace function public.universe_create_report(
  p_target_type text, p_target_id uuid, p_reason_code text, p_detail text default ''
) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if not public.universe_is_member() then raise exception 'UNIVERSE_MEMBER_REQUIRED' using errcode='42501'; end if;
  if p_target_type not in ('profile','post','comment','group','plan','project','game','message') then raise exception 'REPORT_TARGET_INVALID'; end if;
  if p_target_id is null or length(btrim(coalesce(p_reason_code,''))) not between 2 and 40 or length(coalesce(p_detail,'')) > 1200 then raise exception 'REPORT_INVALID'; end if;
  insert into public.universe_backoffice_reports(reporter_id,target_type,target_id,reason_code,detail)
  values(auth.uid(),p_target_type,p_target_id,left(btrim(p_reason_code),40),btrim(coalesce(p_detail,''))) returning id into result;
  return result;
end;
$$;
revoke all on function public.universe_create_report(text,uuid,text,text) from public, anon;
grant execute on function public.universe_create_report(text,uuid,text,text) to authenticated;

create or replace function public.universe_backoffice(p_command text default 'read', p_input jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid(); role_name text := public.universe_backoffice_role();
  report_id uuid; restriction_id uuid; target_user uuid; requested_status text; note text; flag_key text;
  can_manage boolean := public.universe_backoffice_can('moderator');
begin
  if role_name is null then raise exception 'BACKOFFICE_ACCESS_REQUIRED' using errcode='42501'; end if;
  if p_command = 'review_report' then
    if not can_manage then raise exception 'BACKOFFICE_MODERATION_REQUIRED' using errcode='42501'; end if;
    report_id := nullif(p_input->>'report_id','')::uuid;
    requested_status := coalesce(p_input->>'status',''); note := left(btrim(coalesce(p_input->>'note','')),1200);
    if requested_status not in ('in_review','resolved','dismissed','escalated') then raise exception 'REPORT_STATUS_INVALID'; end if;
    update public.universe_backoffice_reports set status=requested_status, priority=coalesce(nullif(p_input->>'priority',''),priority), assigned_to=coalesce(nullif(p_input->>'assigned_to','')::uuid,actor), resolution=note, updated_at=now(), resolved_at=case when requested_status in ('resolved','dismissed') then now() else null end where id=report_id;
    if not found then raise exception 'REPORT_NOT_FOUND'; end if;
    insert into public.universe_backoffice_audit(actor_id,action,resource_type,resource_id,detail) values(actor,'review_report','report',report_id,jsonb_build_object('status',requested_status,'note',note));
  elsif p_command = 'restrict_user' then
    if not can_manage then raise exception 'BACKOFFICE_MODERATION_REQUIRED' using errcode='42501'; end if;
    target_user := nullif(p_input->>'user_id','')::uuid;
    if target_user is null or target_user=actor or not exists(select 1 from public.universe_profiles where user_id=target_user) then raise exception 'USER_NOT_FOUND'; end if;
    note := left(btrim(coalesce(p_input->>'reason','')),1200);
    if p_input->>'kind' not in ('warning','suspension','ban') or length(note)<3 then raise exception 'RESTRICTION_INVALID'; end if;
    insert into public.universe_backoffice_restrictions(user_id,kind,reason,ends_at,created_by) values(target_user,p_input->>'kind',note,nullif(p_input->>'ends_at','')::timestamptz,actor) returning id into restriction_id;
    insert into public.universe_backoffice_audit(actor_id,action,resource_type,resource_id,detail) values(actor,'restrict_user','restriction',restriction_id,jsonb_build_object('user_id',target_user,'kind',p_input->>'kind'));
  elsif p_command = 'revoke_restriction' then
    if not can_manage then raise exception 'BACKOFFICE_MODERATION_REQUIRED' using errcode='42501'; end if;
    restriction_id := nullif(p_input->>'restriction_id','')::uuid;
    update public.universe_backoffice_restrictions set revoked_at=now(),revoked_by=actor where id=restriction_id and revoked_at is null;
    if not found then raise exception 'RESTRICTION_NOT_FOUND'; end if;
    insert into public.universe_backoffice_audit(actor_id,action,resource_type,resource_id,detail) values(actor,'revoke_restriction','restriction',restriction_id,jsonb_build_object('reason',left(coalesce(p_input->>'reason',''),500)));
  elsif p_command = 'review_submission' then
    if not public.universe_backoffice_can('editor') then raise exception 'BACKOFFICE_EDITOR_REQUIRED' using errcode='42501'; end if;
    report_id := nullif(p_input->>'id','')::uuid; requested_status := coalesce(p_input->>'status',''); note := left(btrim(coalesce(p_input->>'note','')),1000);
    if requested_status not in ('accepted','rejected','changes_requested') or (requested_status <> 'accepted' and length(note)<5) then raise exception 'EDITORIAL_DECISION_INVALID'; end if;
    update public.universe_magazine_submissions set status=requested_status, editorial_note=note, revision=revision+1, updated_at=now(), history=history||jsonb_build_array(jsonb_build_object('status',requested_status,'at',now(),'note',note)) where id=report_id and consent and status='pending';
    if not found then raise exception 'SUBMISSION_NOT_FOUND'; end if;
    insert into public.universe_backoffice_audit(actor_id,action,resource_type,resource_id,detail) values(actor,'review_submission','magazine_submission',report_id,jsonb_build_object('status',requested_status));
  elsif p_command = 'set_feature_flag' then
    if not public.universe_backoffice_can('admin') then raise exception 'BACKOFFICE_ADMIN_REQUIRED' using errcode='42501'; end if;
    flag_key := p_input->>'key';
    if flag_key is null or flag_key !~ '^[a-z][a-z0-9_]{2,80}$' then raise exception 'FEATURE_FLAG_INVALID'; end if;
    insert into public.universe_backoffice_feature_flags(key,enabled,config,updated_by,updated_at) values(flag_key,coalesce((p_input->>'enabled')::boolean,false),coalesce(p_input->'config','{}'::jsonb),actor,now()) on conflict(key) do update set enabled=excluded.enabled,config=excluded.config,updated_by=excluded.updated_by,updated_at=now();
    insert into public.universe_backoffice_audit(actor_id,action,resource_type,resource_id,detail) values(actor,'set_feature_flag','feature_flag',null,jsonb_build_object('key',flag_key,'enabled',(p_input->>'enabled')::boolean));
  elsif p_command <> 'read' then
    raise exception 'BACKOFFICE_COMMAND_INVALID';
  end if;
  return jsonb_build_object(
    'role', role_name,
    'metrics', jsonb_build_object(
      'pending_reports',(select count(*) from public.universe_backoffice_reports where status in ('pending','in_review')),
      'urgent_reports',(select count(*) from public.universe_backoffice_reports where status in ('pending','in_review') and priority in ('high','urgent')),
      'pending_account_requests',0,
      'pending_magazine_submissions',(select count(*) from public.universe_magazine_submissions where consent and status='pending'),
      'active_restrictions',(select count(*) from public.universe_backoffice_restrictions where revoked_at is null and (ends_at is null or ends_at>now())),
      'active_members',(select count(*) from public.universe_profiles),
      'projects_with_open_roles',(select count(*) from public.universe_projects where stage<>'completed'),
      'upcoming_plans',(select count(*) from public.universe_plans where starts_at>=now())
    ),
    'reports',case when can_manage then coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.universe_backoffice_reports r),'[]'::jsonb) else '[]'::jsonb end,
    'restrictions',case when can_manage then coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.universe_backoffice_restrictions r where r.revoked_at is null),'[]'::jsonb) else '[]'::jsonb end,
    'submissions',case when public.universe_backoffice_can('editor') then coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc) from public.universe_magazine_submissions s where s.consent),'[]'::jsonb) else '[]'::jsonb end,
    'people',case when role_name in ('admin','moderator','support') then coalesce((select jsonb_agg(jsonb_build_object('user_id',p.user_id,'name',p.name,'university',p.university,'campus',p.campus,'degree',p.degree,'year',p.year,'created_at',p.created_at) order by p.created_at desc) from public.universe_profiles p),'[]'::jsonb) else '[]'::jsonb end,
    'audit',case when role_name in ('admin','moderator','editor') then coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.universe_backoffice_audit a limit 100),'[]'::jsonb) else '[]'::jsonb end,
    'feature_flags',case when role_name='admin' then coalesce((select jsonb_agg(to_jsonb(f) order by f.key) from public.universe_backoffice_feature_flags f),'[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;
revoke all on function public.universe_backoffice(text,jsonb) from public, anon;
grant execute on function public.universe_backoffice(text,jsonb) to authenticated;
