-- Entreclases: instalación inicial en un proyecto Supabase dedicado.
-- Generado desde supabase/migrations; no editar ni ejecutar sobre una instalación existente.
-- Instala tablas, funciones y permisos. No crea usuarios ni activa dominios.
begin;
do $$ begin
  if to_regclass('public.universe_university_domains') is not null then
    raise exception 'Entreclases ya tiene migraciones aplicadas. Ejecuta solo las pendientes, en orden.';
  end if;
end $$;

-- 202609090001_university_auth.sql
-- Apply only to the Supabase project dedicated to Universe.
-- No university domains are enabled implicitly: approve exact domains first.
create table public.universe_university_domains (
  domain text primary key check (domain = lower(domain) and domain !~ '[[:space:]@]' and position('.' in domain) > 0),
  university_name text not null check (length(university_name) between 2 and 160),
  enabled boolean not null default false
);
alter table public.universe_university_domains enable row level security;
revoke all on public.universe_university_domains from public, anon, authenticated;
grant select on public.universe_university_domains to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin, authenticated;
create policy "Auth can inspect approved domains" on public.universe_university_domains
  for select to supabase_auth_admin using (true);

-- Enable as Authentication > Hooks > Before User Created.
create function public.universe_before_user_created(event jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  requested_domain text := split_part(lower(coalesce(event->'user'->>'email', '')), '@', 2);
begin
  if coalesce(event->'user'->>'is_anonymous', 'false') = 'true'
    or coalesce(event->'user'->'app_metadata'->>'provider', 'email') <> 'email'
    or not exists (select 1 from public.universe_university_domains d where d.domain = requested_domain and d.enabled)
  then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'UNIVERSE_UNIVERSITY_REQUIRED'));
  end if;
  return '{}'::jsonb;
end;
$$;
revoke all on function public.universe_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.universe_before_user_created(jsonb) to supabase_auth_admin;

-- Also enforce the exact domain at the database boundary, including email changes.
-- This guard remains effective if the dashboard hook is accidentally disabled.
create function public.universe_guard_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null or new.is_anonymous or not exists (
    select 1 from public.universe_university_domains d
    where d.domain = split_part(lower(new.email), '@', 2) and d.enabled
  ) then
    raise exception 'UNIVERSE_UNIVERSITY_REQUIRED' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.universe_guard_email() from public, anon, authenticated;
create trigger universe_check_email before insert or update of email, is_anonymous on auth.users
  for each row execute function public.universe_guard_email();

-- Authoritative account read. No arguments: a caller cannot choose another user.
-- User-editable metadata is used solely for the display name, never permissions.
create function public.universe_current_member()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'name', left(coalesce(u.raw_user_meta_data->>'full_name', ''), 60),
    'university', d.university_name
  )
  from auth.users u
  join public.universe_university_domains d on d.domain = split_part(lower(u.email), '@', 2)
  where u.id = (select auth.uid())
    and u.email_confirmed_at is not null
    and not coalesce(u.is_anonymous, false)
    and d.enabled;
$$;
revoke all on function public.universe_current_member() from public, anon;
grant execute on function public.universe_current_member() to authenticated;

-- Future protected tables must have RLS policies that check the authenticated
-- user AND current university membership. Never authorize via user_metadata.


-- 202609090002_valencia_launch.sql
-- Launch scope is reviewed in the database, never supplied by a profile.
-- Existing enabled domains remain closed until their launch region is reviewed.
alter table public.universe_university_domains add column launch_region text
  check (launch_region ~ '^[a-z][a-z0-9-]{1,40}$');

-- Verified student domain: Universitat de València.
-- https://www.uv.es/uvweb/filologia-traduccion-comunicacion/es/facultad/secretaria/tramites-procedimientos/consultas-1285960482280.html
-- Prepared but disabled: the project owner enables reviewed institutions on opening.
insert into public.universe_university_domains (domain, university_name, enabled, launch_region)
values ('alumni.uv.es', 'Universitat de València', false, 'valencia')
on conflict (domain) do nothing;

create or replace function public.universe_before_user_created(event jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  requested_domain text := split_part(lower(coalesce(event->'user'->>'email', '')), '@', 2);
begin
  if coalesce(event->'user'->>'is_anonymous', 'false') = 'true'
    or coalesce(event->'user'->'app_metadata'->>'provider', 'email') <> 'email'
    or not exists (select 1 from public.universe_university_domains d where d.domain = requested_domain and d.enabled and d.launch_region = 'valencia')
  then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'UNIVERSE_UNIVERSITY_REQUIRED'));
  end if;
  return '{}'::jsonb;
end;
$$;
revoke all on function public.universe_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.universe_before_user_created(jsonb) to supabase_auth_admin;

-- Also enforce the exact domain at the database boundary, including email changes.
-- This guard remains effective if the dashboard hook is accidentally disabled.
create or replace function public.universe_guard_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null or new.is_anonymous or not exists (
    select 1 from public.universe_university_domains d
    where d.domain = split_part(lower(new.email), '@', 2) and d.enabled and d.launch_region = 'valencia'
  ) then
    raise exception 'UNIVERSE_UNIVERSITY_REQUIRED' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.universe_guard_email() from public, anon, authenticated;
-- The existing trigger uses the replaced function automatically.

-- Authoritative account read. No arguments: a caller cannot choose another user.
-- User-editable metadata is used solely for the display name, never permissions.
create or replace function public.universe_current_member()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'name', left(coalesce(u.raw_user_meta_data->>'full_name', ''), 60),
    'university', d.university_name
  )
  from auth.users u
  join public.universe_university_domains d on d.domain = split_part(lower(u.email), '@', 2)
  where u.id = (select auth.uid())
    and u.email_confirmed_at is not null
    and not coalesce(u.is_anonymous, false)
    and d.enabled and d.launch_region = 'valencia';
$$;
revoke all on function public.universe_current_member() from public, anon;
grant execute on function public.universe_current_member() to authenticated;



-- 202609090003_community.sql
-- The community has no demonstration data. Membership is always checked against
-- confirmed auth.users emails and the reviewed Valencia domain allowlist.
create function public.universe_is_member() returns boolean
language sql stable security definer set search_path = '' as $$
 select public.universe_current_member() is not null;
$$;
revoke all on function public.universe_is_member() from public, anon;
grant execute on function public.universe_is_member() to authenticated;

create table public.universe_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 name text not null check (char_length(btrim(name)) between 2 and 60),
 university text not null,
 campus text not null check(campus in ('Tarongers','Blasco Ibáñez','Vera','Burjassot-Paterna','Otra sede en Valencia')),
 degree text not null check(char_length(btrim(degree)) between 2 and 100),
 year smallint not null check(year between 1 and 6),
 bio text not null default '' check(char_length(bio)<=400),
 interests text[] not null default '{}' check(cardinality(interests)<=5 and interests <@ array['Café','Música','Deporte','Cine','Tecnología','Arte','Naturaleza','Proyectos']::text[]),
 color smallint not null default 0 check(color between 0 and 5),
 created_at timestamptz not null default now()
);
revoke all on public.universe_profiles from public,anon,authenticated;
create function public.universe_profile_identity() returns trigger
language plpgsql security definer set search_path='' as $$
declare member jsonb := public.universe_current_member();
begin
 if member is null or new.user_id <> (member->>'id')::uuid then raise exception 'UNIVERSE_UNIVERSITY_REQUIRED' using errcode='42501'; end if;
 if tg_op='UPDATE' and new.user_id<>old.user_id then raise exception 'IMMUTABLE_ID' using errcode='42501'; end if;
 new.university := member->>'university';
 return new;
end;
$$;
revoke all on function public.universe_profile_identity() from public, anon, authenticated;
create trigger universe_profile_identity before insert or update on public.universe_profiles for each row execute function public.universe_profile_identity();
alter table public.universe_profiles enable row level security;
create policy profiles_read on public.universe_profiles for select to authenticated using ((select public.universe_is_member()));
create policy profiles_insert on public.universe_profiles for insert to authenticated with check ((select public.universe_is_member()) and user_id=(select auth.uid()));
create policy profiles_update on public.universe_profiles for update to authenticated using ((select public.universe_is_member()) and user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
grant select, insert on public.universe_profiles to authenticated;
grant update(user_id,name,campus,degree,year,bio,interests,color) on public.universe_profiles to authenticated;
create index universe_profiles_campus on public.universe_profiles(campus);

create table public.universe_groups (
 id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.universe_profiles(user_id) on delete cascade,
 name text not null check(char_length(btrim(name)) between 3 and 80),
 description text not null check(char_length(btrim(description)) between 3 and 600),
 category text not null check(category in ('study','leisure','projects')),
 campus text not null check(campus in ('Tarongers','Blasco Ibáñez','Vera','Burjassot-Paterna','Otra sede en Valencia')),
 created_at timestamptz not null default now()
);
revoke all on public.universe_groups from public,anon,authenticated;
create table public.universe_group_members (
 group_id uuid references public.universe_groups(id) on delete cascade,
 user_id uuid references public.universe_profiles(user_id) on delete cascade,
 primary key(group_id,user_id)
);
revoke all on public.universe_group_members from public,anon,authenticated;
alter table public.universe_groups enable row level security;
alter table public.universe_group_members enable row level security;
create policy groups_read on public.universe_groups for select to authenticated using((select public.universe_is_member()));
create policy groups_insert on public.universe_groups for insert to authenticated with check((select public.universe_is_member()) and creator_id=(select auth.uid()));
create policy group_members_read on public.universe_group_members for select to authenticated using((select public.universe_is_member()));
create policy group_members_insert on public.universe_group_members for insert to authenticated with check((select public.universe_is_member()) and user_id=(select auth.uid()));
create policy group_members_delete on public.universe_group_members for delete to authenticated using((select public.universe_is_member()) and user_id=(select auth.uid()) and not exists(select 1 from public.universe_groups g where g.id=group_id and g.creator_id=(select auth.uid())));
grant select,insert on public.universe_groups to authenticated;
grant select,insert,delete on public.universe_group_members to authenticated;
create index universe_groups_creator on public.universe_groups(creator_id);
create index universe_group_members_user on public.universe_group_members(user_id,group_id);
create function public.universe_enrol_group_creator() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.universe_group_members(group_id,user_id) values(new.id,new.creator_id); return new; end;
$$;
revoke all on function public.universe_enrol_group_creator() from public,anon,authenticated;
create trigger universe_enrol_group_creator after insert on public.universe_groups for each row execute function public.universe_enrol_group_creator();

create table public.universe_posts (
 id uuid primary key default gen_random_uuid(), author_id uuid not null references public.universe_profiles(user_id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 1 and 2000), kind text not null check(kind in ('post','question')),
 group_id uuid references public.universe_groups(id) on delete cascade, created_at timestamptz not null default now()
);
revoke all on public.universe_posts from public,anon,authenticated;
create table public.universe_comments (
 id uuid primary key default gen_random_uuid(), post_id uuid not null references public.universe_posts(id) on delete cascade,
 author_id uuid not null references public.universe_profiles(user_id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 1 and 600), created_at timestamptz not null default now()
);
revoke all on public.universe_comments from public,anon,authenticated;
create table public.universe_likes (
 post_id uuid references public.universe_posts(id) on delete cascade,
 user_id uuid references public.universe_profiles(user_id) on delete cascade, primary key(post_id,user_id)
);
revoke all on public.universe_likes from public,anon,authenticated;
alter table public.universe_posts enable row level security;
alter table public.universe_comments enable row level security;
alter table public.universe_likes enable row level security;
create policy posts_read on public.universe_posts for select to authenticated using((select public.universe_is_member()));
create policy posts_insert on public.universe_posts for insert to authenticated with check((select public.universe_is_member()) and author_id=(select auth.uid()) and (group_id is null or exists(select 1 from public.universe_group_members m where m.group_id=universe_posts.group_id and m.user_id=(select auth.uid()))));
create policy posts_delete on public.universe_posts for delete to authenticated using((select public.universe_is_member()) and author_id=(select auth.uid()));
create policy comments_read on public.universe_comments for select to authenticated using((select public.universe_is_member()));
create policy comments_insert on public.universe_comments for insert to authenticated with check((select public.universe_is_member()) and author_id=(select auth.uid()));
create policy likes_read on public.universe_likes for select to authenticated using((select public.universe_is_member()));
create policy likes_insert on public.universe_likes for insert to authenticated with check((select public.universe_is_member()) and user_id=(select auth.uid()));
create policy likes_delete on public.universe_likes for delete to authenticated using((select public.universe_is_member()) and user_id=(select auth.uid()));
grant select,insert,delete on public.universe_posts,public.universe_likes to authenticated;
grant select,insert on public.universe_comments to authenticated;
create index universe_posts_recent on public.universe_posts(created_at desc);
create index universe_posts_author on public.universe_posts(author_id,created_at desc);
create index universe_posts_group on public.universe_posts(group_id,created_at desc);
create index universe_comments_post on public.universe_comments(post_id,created_at);
create index universe_comments_author on public.universe_comments(author_id);
create index universe_likes_user on public.universe_likes(user_id);

create table public.universe_plans (
 id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.universe_profiles(user_id) on delete cascade,
 title text not null check(char_length(btrim(title)) between 3 and 100), description text not null default '' check(char_length(description)<=1200),
 place text not null check(place in ('Benimaclet','Torres de Serranos','La Malvarrosa','L’Albufera · Gola de Pujol','Campus de Vera · Ágora')),
 meeting_point text not null check(char_length(btrim(meeting_point)) between 2 and 160),
 starts_at timestamptz not null, capacity smallint not null check(capacity between 2 and 60), created_at timestamptz not null default now()
);
revoke all on public.universe_plans from public,anon,authenticated;
create table public.universe_plan_members (
 plan_id uuid references public.universe_plans(id) on delete cascade,
 user_id uuid references public.universe_profiles(user_id) on delete cascade, primary key(plan_id,user_id)
);
revoke all on public.universe_plan_members from public,anon,authenticated;
alter table public.universe_plans enable row level security;
alter table public.universe_plan_members enable row level security;
create policy plans_read on public.universe_plans for select to authenticated using((select public.universe_is_member()));
create policy plans_insert on public.universe_plans for insert to authenticated with check((select public.universe_is_member()) and creator_id=(select auth.uid()) and starts_at>now());
create policy plans_delete on public.universe_plans for delete to authenticated using((select public.universe_is_member()) and creator_id=(select auth.uid()));
create policy plan_members_read on public.universe_plan_members for select to authenticated using((select public.universe_is_member()));
grant select,insert,delete on public.universe_plans to authenticated;
grant select on public.universe_plan_members to authenticated;
create index universe_plans_upcoming on public.universe_plans(starts_at);
create index universe_plans_creator on public.universe_plans(creator_id);
create index universe_plan_members_user on public.universe_plan_members(user_id,plan_id);
create function public.universe_enrol_plan_creator() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.universe_plan_members(plan_id,user_id) values(new.id,new.creator_id); return new; end;
$$;
revoke all on function public.universe_enrol_plan_creator() from public,anon,authenticated;
create trigger universe_enrol_plan_creator after insert on public.universe_plans for each row execute function public.universe_enrol_plan_creator();
create function public.universe_set_plan_attendance(plan_uuid uuid, attending boolean) returns void
language plpgsql security definer set search_path='' as $$
declare p public.universe_plans; caller uuid:=(select auth.uid());
begin
 if not public.universe_is_member() or attending is null then raise exception 'UNIVERSE_UNIVERSITY_REQUIRED' using errcode='42501'; end if;
 -- Every attendance change locks the same parent row; parallel joins cannot overbook.
 select * into p from public.universe_plans where id=plan_uuid for update;
 if not found then raise exception 'PLAN_UNAVAILABLE'; end if;
 if p.starts_at<=now() then raise exception 'PLAN_PAST'; end if;
 if attending then
  if exists(select 1 from public.universe_plan_members where plan_id=plan_uuid and user_id=caller) then return; end if;
  if (select count(*) from public.universe_plan_members where plan_id=plan_uuid)>=p.capacity then raise exception 'PLAN_FULL'; end if;
  insert into public.universe_plan_members(plan_id,user_id) values(plan_uuid,caller);
 else
  if p.creator_id=caller then raise exception 'ORGANISER_MUST_CANCEL'; end if;
  delete from public.universe_plan_members where plan_id=plan_uuid and user_id=caller;
 end if;
end;
$$;
revoke all on function public.universe_set_plan_attendance(uuid,boolean) from public,anon;
grant execute on function public.universe_set_plan_attendance(uuid,boolean) to authenticated;

create table public.universe_notes (
 id uuid primary key default gen_random_uuid(), author_id uuid not null references public.universe_profiles(user_id) on delete cascade,
 title text not null check(char_length(btrim(title)) between 3 and 100), subject text not null check(char_length(btrim(subject)) between 2 and 100),
 description text not null default '' check(char_length(description)<=600),
 campus text not null check(campus in ('Tarongers','Blasco Ibáñez','Vera','Burjassot-Paterna','Otra sede en Valencia')),
 file_name text not null check(char_length(file_name) between 5 and 120 and lower(file_name) like '%.pdf' and file_name !~ E'[\\\\/]'),
 file_path text not null unique check(file_path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.pdf$'),
 file_size integer not null check(file_size between 5 and 10485760), created_at timestamptz not null default now()
);
revoke all on public.universe_notes from public,anon,authenticated;
alter table public.universe_notes enable row level security;
create policy notes_read on public.universe_notes for select to authenticated using((select public.universe_is_member()));
create policy notes_insert on public.universe_notes for insert to authenticated with check((select public.universe_is_member()) and author_id=(select auth.uid()) and split_part(file_path,'/',1)=(select auth.uid())::text);
create policy notes_delete on public.universe_notes for delete to authenticated using((select public.universe_is_member()) and author_id=(select auth.uid()));
grant select,insert,delete on public.universe_notes to authenticated;
create index universe_notes_author on public.universe_notes(author_id);
create index universe_notes_campus on public.universe_notes(campus,created_at desc);

create table public.universe_threads (
 id uuid primary key default gen_random_uuid(), user_a uuid not null references public.universe_profiles(user_id) on delete cascade,
 user_b uuid not null references public.universe_profiles(user_id) on delete cascade,
 created_at timestamptz not null default now(), check(user_a<user_b), unique(user_a,user_b)
);
revoke all on public.universe_threads from public,anon,authenticated;
create table public.universe_messages (
 id uuid primary key default gen_random_uuid(), thread_id uuid not null references public.universe_threads(id) on delete cascade,
 sender_id uuid not null references public.universe_profiles(user_id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 1 and 2000), created_at timestamptz not null default now()
);
revoke all on public.universe_messages from public,anon,authenticated;
alter table public.universe_threads enable row level security;
alter table public.universe_messages enable row level security;
create policy threads_read on public.universe_threads for select to authenticated using((select public.universe_is_member()) and (user_a=(select auth.uid()) or user_b=(select auth.uid())));
create policy messages_read on public.universe_messages for select to authenticated using((select public.universe_is_member()) and exists(select 1 from public.universe_threads t where t.id=thread_id and (t.user_a=(select auth.uid()) or t.user_b=(select auth.uid()))));
create policy messages_insert on public.universe_messages for insert to authenticated with check((select public.universe_is_member()) and sender_id=(select auth.uid()) and exists(select 1 from public.universe_threads t where t.id=thread_id and (t.user_a=(select auth.uid()) or t.user_b=(select auth.uid()))));
grant select on public.universe_threads to authenticated;
grant select,insert on public.universe_messages to authenticated;
create index universe_threads_b on public.universe_threads(user_b);
create index universe_messages_thread on public.universe_messages(thread_id,created_at desc);
create index universe_messages_sender on public.universe_messages(sender_id);
create function public.universe_open_thread(peer_uuid uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare caller uuid:=(select auth.uid()); a uuid; b uuid; result uuid;
begin
 if not public.universe_is_member() then raise exception 'UNIVERSE_UNIVERSITY_REQUIRED' using errcode='42501'; end if;
 if peer_uuid is null or peer_uuid=caller or not exists (
  select 1 from auth.users u join public.universe_university_domains d on d.domain=split_part(lower(u.email),'@',2)
  join public.universe_profiles p on p.user_id=u.id
  where u.id=peer_uuid and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and d.enabled and d.launch_region='valencia'
 ) then raise exception 'PEER_UNAVAILABLE'; end if;
 a:=least(caller,peer_uuid); b:=greatest(caller,peer_uuid);
 insert into public.universe_threads(user_a,user_b) values(a,b) on conflict(user_a,user_b) do update set user_a=excluded.user_a returning id into result;
 return result;
end;
$$;
revoke all on function public.universe_open_thread(uuid) from public,anon;
grant execute on function public.universe_open_thread(uuid) to authenticated;

-- Explicitly remove accidental public/anonymous grants, including projects with
-- permissive default privileges. Clients only have the grants above.
revoke all on public.universe_profiles,public.universe_groups,public.universe_group_members,public.universe_posts,public.universe_comments,public.universe_likes,public.universe_plans,public.universe_plan_members,public.universe_notes,public.universe_threads,public.universe_messages from public,anon;


-- 202609090004_community_storage.sql
-- Private PDF uploads. Storage API, not SQL deletion of storage.objects, owns the bytes.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('universe-notes','universe-notes',false,10485760,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf'];
create policy universe_notes_upload on storage.objects for insert to authenticated
with check(bucket_id='universe-notes' and (select public.universe_is_member())
 and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.pdf$' and split_part(name,'/',1)=(select auth.uid())::text);
create policy universe_notes_download on storage.objects for select to authenticated
using(bucket_id='universe-notes' and (select public.universe_is_member())
 and (split_part(name,'/',1)=(select auth.uid())::text or exists(select 1 from public.universe_notes n where n.file_path=name)));
create policy universe_notes_remove on storage.objects for delete to authenticated
using(bucket_id='universe-notes' and (select public.universe_is_member()) and split_part(name,'/',1)=(select auth.uid())::text);


-- 202609090005_unicoins.sql
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


-- 202609140006_profile_relationship.sql
-- Store the relationship status selected in the community profile.
alter table public.universe_profiles
  add column relationship_status text not null default 'prefer_not_to_say'
  check (relationship_status in ('single','in_relationship','seeing_someone','complicated','prefer_not_to_say'));

grant update(relationship_status) on public.universe_profiles to authenticated;


-- 202609190007_social_games.sql
-- Seven optional social experiences. Apply after the existing community migrations.
-- No client can read the underlying rows: secrets are projected only by the RPC.
create table if not exists public.universe_play_rooms (
  id uuid primary key default gen_random_uuid(),
  game text not null check(game in ('crush','questions','debate','truth','hangout','jury','blind')),
  owner uuid not null references public.universe_profiles(user_id) on delete cascade,
  body text not null default '', options jsonb not null default '[]', answer integer,
  place text not null default '', capacity integer not null default 2 check(capacity between 2 and 8),
  expires timestamptz, players uuid[] not null, blocked uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists universe_play_rooms_game on public.universe_play_rooms(game,created_at desc);
create index if not exists universe_play_rooms_owner on public.universe_play_rooms(owner,game);
create table if not exists public.universe_play_moves (
  id uuid primary key default gen_random_uuid(),
  room uuid not null references public.universe_play_rooms(id) on delete cascade,
  sender uuid not null references public.universe_profiles(user_id) on delete cascade,
  kind text not null check(kind in ('say','vote','reveal')), body text not null default '',
  choice integer, reply text not null default '', created_at timestamptz not null default now()
);
create index if not exists universe_play_moves_room on public.universe_play_moves(room,created_at,id);
create index if not exists universe_play_moves_sender on public.universe_play_moves(sender);
create unique index if not exists universe_play_moves_choice on public.universe_play_moves(room,sender,kind) where kind in ('vote','reveal');
create table if not exists public.universe_play_reports (
  id uuid primary key default gen_random_uuid(), reporter uuid not null,
  sender uuid not null, body text not null, room uuid not null,
  created_at timestamptz not null default now()
);
create table if not exists public.universe_play_activity (
  actor uuid not null references public.universe_profiles(user_id) on delete cascade,
  game text not null, command text not null, target uuid, created_at timestamptz not null default now()
);
create index if not exists universe_play_activity_actor on public.universe_play_activity(actor,created_at);
alter table public.universe_play_rooms enable row level security;
alter table public.universe_play_moves enable row level security;
alter table public.universe_play_reports enable row level security;
alter table public.universe_play_activity enable row level security;
revoke all on public.universe_play_rooms,public.universe_play_moves,public.universe_play_reports,public.universe_play_activity from public,anon,authenticated;

create or replace function public.universe_play_window() returns boolean language sql stable set search_path='' as $$
  select extract(isodow from now() at time zone 'Europe/Madrid')=4
    and (now() at time zone 'Europe/Madrid')::time >= time '19:30'
    and (now() at time zone 'Europe/Madrid')::time < time '21:00';
$$;
revoke all on function public.universe_play_window() from public,anon,authenticated;

create or replace function public.universe_play_snapshot(p_game text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  u uuid:=auth.uid(); r public.universe_play_rooms; m record; own_id uuid;
  picked integer; reciprocal integer; matched boolean; revealed boolean; peer uuid;
  output jsonb:='[]'; messages jsonb; counts jsonb; title text; joined boolean;
begin
  if not public.universe_is_member() then raise exception 'Necesitas una cuenta universitaria verificada.'; end if;
  select id into own_id from public.universe_play_rooms where game=p_game and owner=u limit 1;
  for r in select * from public.universe_play_rooms where game=p_game
    and (expires is null or expires>now()) and (p_game<>'blind' or u=any(players))
    order by (owner=u) desc,created_at desc,id limit 100
  loop
    picked:=null; reciprocal:=null; peer:=null; matched:=false; revealed:=false;
    joined:=u=any(r.players);
    select choice into picked from public.universe_play_moves where room=r.id and sender=u and kind='vote';
    if p_game='crush' and own_id is not null and r.owner<>u then
      select choice into reciprocal from public.universe_play_moves where room=own_id and sender=r.owner and kind='vote';
      matched:=picked is not null and reciprocal is not null and picked=reciprocal;
      if matched then peer:=r.owner; end if;
    end if;
    if p_game='blind' and cardinality(r.players)=2 then
      revealed:=(select count(*)=2 from public.universe_play_moves where room=r.id and kind='reveal' and sender=any(r.players));
      if revealed then select p into peer from unnest(r.players) p where p<>u; end if;
    end if;
    select name into title from public.universe_profiles where user_id=coalesce(peer,r.owner);
    if p_game='blind' and not revealed then title:='Alguien del campus'; end if;
    messages:='[]'; counts:='[]';
    if p_game not in ('crush','truth') and (p_game<>'hangout' or joined) and (p_game<>'jury' or picked is not null) then
      for m in select x.*,p.name from public.universe_play_moves x join public.universe_profiles p on p.user_id=x.sender
        where x.room=r.id and ((p_game='questions' and (r.owner=u or x.reply<>''))
          or (p_game<>'questions' and (x.kind='say' or (x.kind='reveal' and x.sender=u))))
        order by x.created_at,x.id
      loop
        messages:=messages || jsonb_build_array(jsonb_build_object('id',m.id,'kind',m.kind,'body',m.body,'reply',m.reply,
          'choice',-1,'mine',p_game<>'questions' and m.sender=u,
          'label',case when p_game='questions' then 'Anónimo' when p_game='blind' and not revealed then case when m.sender=u then 'Tú' else 'Tu compañía' end else m.name end));
      end loop;
    end if;
    if (p_game='jury' and picked is not null) or (p_game='debate' and (select count(*) from public.universe_play_moves where room=r.id and kind='say')=6) then
      select jsonb_agg(n order by i) into counts from (select i,(select count(*) from public.universe_play_moves where room=r.id and kind='vote' and choice=i) n from generate_series(0,1) i) q;
    end if;
    output:=output || jsonb_build_array(jsonb_build_object('id',r.id,'mine',r.owner=u,'owner_name',title,
      'body',r.body,'options',r.options,'place',r.place,'expires',r.expires,'count',cardinality(r.players),
      'capacity',r.capacity,'joined',joined,'my_choice',picked,'answer',case when p_game='truth' and (r.owner=u or picked is not null) then r.answer else null end,
      'matched',matched,'peer_id',peer,'revealed',revealed,'votes',counts,'moves',messages));
  end loop;
  return output;
end; $$;
revoke all on function public.universe_play_snapshot(text) from public,anon,authenticated;

create or replace function public.universe_play(p_game text,p_command text default 'read',p_input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  u uuid:=auth.uid(); r public.universe_play_rooms; m public.universe_play_moves;
  target uuid; content text:=btrim(coalesce(p_input->>'body','')); opts jsonb:=coalesce(p_input->'options','[]');
  pick integer; cap integer:=2; minutes integer:=40; expiry timestamptz; turns integer; own_id uuid;
begin
  if not public.universe_is_member() or not exists(select 1 from public.universe_profiles where user_id=u) then raise exception 'Necesitas una cuenta universitaria verificada.'; end if;
  if p_game is null or p_game not in ('crush','questions','debate','truth','hangout','jury','blind') then raise exception 'Experiencia desconocida.'; end if;
  if p_command='read' then return public.universe_play_snapshot(p_game); end if;
  if p_command is null or p_command not in ('create','delete','join','leave','vote','say','answer','dismiss','block','report','reveal') then raise exception 'Acción no disponible.'; end if;
  if jsonb_typeof(p_input)<>'object' or length(p_input::text)>6000 then raise exception 'Datos no válidos.'; end if;
  -- Serialise writes for each experience, including seats, turns and matching.
  perform pg_advisory_xact_lock(hashtext('universe_play:'||p_game));
  if (select count(*) from public.universe_play_activity where actor=u and created_at>now()-interval '1 minute')>=40 then raise exception 'Demasiadas acciones seguidas. Espera un minuto.'; end if;
  if length(content)>600 then raise exception 'Máximo 600 caracteres.'; end if;
  target:=nullif(p_input->>'id','')::uuid;
  if p_command='create' then
    if (select count(*) from public.universe_play_activity where actor=u and command='create' and created_at>now()-interval '1 day')>=20 then raise exception 'Has llegado al límite de creaciones de hoy.'; end if;
    if p_game in ('crush','questions','blind') and exists(select 1 from public.universe_play_rooms where game=p_game and (owner=u or (p_game='blind' and u=any(players))) and (expires is null or expires>now())) then raise exception 'Ya estás participando.'; end if;
    if p_game in ('crush','blind') and p_input->'adult' is distinct from 'true'::jsonb then raise exception 'Confirma que eres mayor de edad.'; end if;
    if p_game in ('jury','debate','hangout') and (length(content)<1 or length(content)>200) then raise exception 'Escribe una propuesta de hasta 200 caracteres.'; end if;
    if p_game in ('truth','jury') then
      if jsonb_typeof(opts)<>'array' then raise exception 'Escribe las opciones.'; end if;
      if jsonb_array_length(opts)<>(case when p_game='truth' then 3 else 2 end) then raise exception 'Número de opciones incorrecto.'; end if;
      if exists(select 1 from jsonb_array_elements(opts) v where jsonb_typeof(v)<>'string' or length(btrim(v#>>'{}')) not between 1 and 180) then raise exception 'Cada frase debe tener entre 1 y 180 caracteres.'; end if;
      if (select count(distinct lower(btrim(v))) from jsonb_array_elements_text(opts) v)<>jsonb_array_length(opts) then raise exception 'Las opciones deben ser diferentes.'; end if;
    else opts:='[]'; end if;
    if p_game='truth' then pick:=(p_input->>'choice')::integer; if pick is null or pick not between 0 and 2 then raise exception 'Elige la mentira.'; end if; end if;
    if p_game='hangout' then
      cap:=coalesce((p_input->>'capacity')::integer,3); minutes:=coalesce((p_input->>'minutes')::integer,40);
      if cap not between 2 and 8 or minutes not between 15 and 120 or length(btrim(coalesce(p_input->>'place',''))) not between 1 and 120 then raise exception 'Revisa el lugar, las plazas y la duración.'; end if;
      expiry:=now()+make_interval(mins=>minutes);
    end if;
    if p_game='blind' then
      if not public.universe_play_window() then raise exception 'La cita abre los jueves de 19:30 a 21:00, hora de Valencia.'; end if;
      select * into r from public.universe_play_rooms where game='blind' and owner<>u and cardinality(players)=1 and expires>now() order by created_at,id limit 1 for update;
      if r.id is not null then update public.universe_play_rooms set players=array_append(players,u),expires=now()+interval '12 minutes' where id=r.id;
      else
        expiry:=((now() at time zone 'Europe/Madrid')::date+time '21:00') at time zone 'Europe/Madrid';
        insert into public.universe_play_rooms(game,owner,players,expires) values(p_game,u,array[u],expiry);
      end if;
    else
      insert into public.universe_play_rooms(game,owner,body,options,answer,place,capacity,expires,players)
        values(p_game,u,content,opts,pick,case when p_game='hangout' then btrim(p_input->>'place') else '' end,cap,expiry,array[u]);
    end if;
  else
    select * into r from public.universe_play_rooms where id=target and game=p_game for update;
    if r.id is null then raise exception 'Esta experiencia ya no está disponible.'; end if;
    if p_game='blind' and not u=any(r.players) then raise exception 'Esta sala es privada.'; end if;
    if p_command='delete' then
      if r.owner<>u then raise exception 'Solo quien lo creó puede cerrarlo.'; end if;
      -- Leaving attraction also revokes all outgoing choices.
      if p_game='crush' then delete from public.universe_play_moves x using public.universe_play_rooms y where x.room=y.id and y.game='crush' and x.sender=u; end if;
      delete from public.universe_play_rooms where id=r.id;
    else
      if r.expires is not null and r.expires<=now() then raise exception 'Esta experiencia ha terminado.'; end if;
      if p_command='join' then
        if p_game not in ('hangout','debate') then raise exception 'No puedes unirte así.'; end if;
        if not u=any(r.players) then
          if cardinality(r.players)>=r.capacity then raise exception 'No quedan plazas.'; end if;
          update public.universe_play_rooms set players=array_append(players,u) where id=r.id;
        end if;
      elsif p_command='leave' then
        if p_game not in ('hangout','blind') or not u=any(r.players) then raise exception 'No estás en esta sala.'; end if;
        if p_game='blind' or r.owner=u then delete from public.universe_play_rooms where id=r.id;
        else update public.universe_play_rooms set players=array_remove(players,u) where id=r.id; end if;
      elsif p_command='vote' then
        if p_game not in ('crush','truth','debate','jury') then raise exception 'No hay votación aquí.'; end if;
        pick:=(p_input->>'choice')::integer;
        if pick is null or pick<0 or pick>=(case when p_game in ('crush','truth') then 3 else 2 end) then raise exception 'Elige una opción válida.'; end if;
        if p_game in ('crush','truth') and r.owner=u then raise exception 'No puedes elegirte a ti.'; end if;
        if p_game='crush' and not exists(select 1 from public.universe_play_rooms where game='crush' and owner=u) then raise exception 'Activa tu participación primero.'; end if;
        if p_game='debate' and (u=any(r.players) or (select count(*) from public.universe_play_moves where room=r.id and kind='say')<>6) then raise exception 'El jurado vota al terminar los seis turnos.'; end if;
        if exists(select 1 from public.universe_play_moves where room=r.id and sender=u and kind='vote') then raise exception 'Ya has elegido.'; end if;
        insert into public.universe_play_moves(room,sender,kind,choice) values(r.id,u,'vote',pick);
      elsif p_command='say' then
        if p_game not in ('questions','hangout','blind','debate','jury') or content='' then raise exception 'Escribe un mensaje válido.'; end if;
        if p_game in ('hangout','blind','debate') and not u=any(r.players) then raise exception 'Únete primero.'; end if;
        if p_game='blind' and cardinality(r.players)<>2 then raise exception 'Espera a tener compañía.'; end if;
        if p_game='questions' then
          if r.owner=u or u=any(r.blocked) then raise exception 'No puedes enviar preguntas a este buzón.'; end if;
          if (select count(*) from public.universe_play_activity where actor=u and game='questions' and command='say' and created_at>now()-interval '1 day')>=5 then raise exception 'Puedes enviar hasta cinco preguntas al día.'; end if;
        end if;
        if p_game='debate' then
          select count(*) into turns from public.universe_play_moves where room=r.id and kind='say';
          if cardinality(r.players)<>2 or turns>=6 or r.players[1+(turns%2)]<>u then raise exception 'Espera tu turno.'; end if;
        end if;
        if p_game='jury' and not exists(select 1 from public.universe_play_moves where room=r.id and sender=u and kind='vote') then raise exception 'Vota antes de comentar.'; end if;
        insert into public.universe_play_moves(room,sender,kind,body) values(r.id,u,'say',content);
      elsif p_command in ('answer','dismiss','block','report') then
        if p_game<>'questions' or r.owner<>u then raise exception 'Este buzón no es tuyo.'; end if;
        select * into m from public.universe_play_moves where id=(p_input->>'move')::uuid and room=r.id and kind='say';
        if m.id is null then raise exception 'Pregunta no disponible.'; end if;
        if p_command='answer' then
          if content='' then raise exception 'Escribe una respuesta.'; end if;
          update public.universe_play_moves set reply=content where id=m.id;
        else
          if p_command='report' then insert into public.universe_play_reports(reporter,sender,body,room) values(u,m.sender,m.body,r.id); end if;
          if p_command in ('block','report') then update public.universe_play_rooms set blocked=array_append(blocked,m.sender) where id=r.id and not m.sender=any(blocked); end if;
          delete from public.universe_play_moves where room=r.id and (id=m.id or (p_command in ('block','report') and sender=m.sender and reply=''));
        end if;
      elsif p_command='reveal' then
        if p_game<>'blind' or cardinality(r.players)<>2 or not u=any(r.players) then raise exception 'Espera a tener pareja.'; end if;
        insert into public.universe_play_moves(room,sender,kind) values(r.id,u,'reveal') on conflict do nothing;
      end if;
    end if;
  end if;
  insert into public.universe_play_activity(actor,game,command,target) values(u,p_game,p_command,target);
  return public.universe_play_snapshot(p_game);
end; $$;
revoke all on function public.universe_play(text,text,jsonb) from public,anon;
grant execute on function public.universe_play(text,text,jsonb) to authenticated;


-- 202609190008_projects_magazine.sql
-- Projects and a consent-based community magazine. Apply after 003 (community).
-- All access goes through a verified-member RPC. Editorial access is assigned by an administrator.
create table public.universe_projects (
 id uuid primary key default gen_random_uuid(), owner uuid not null references public.universe_profiles(user_id) on delete cascade,
 spec jsonb not null, stage text not null default 'forming' check(stage in ('forming','building','completed')),
 milestones jsonb not null default '[{"title":"Definir la propuesta","done":false},{"title":"Primer prototipo","done":false},{"title":"Probar y presentar","done":false}]',
 result text not null default '', result_url text not null default '', created_at timestamptz not null default now()
);
create table public.universe_project_applications (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.universe_projects on delete cascade,
 applicant uuid not null references public.universe_profiles(user_id) on delete cascade, role text not null,
 body text not null, availability text not null, portfolio text not null default '',
 status text not null default 'pending' check(status in ('pending','accepted','rejected')), unique(project_id,applicant)
);
create unique index universe_project_role_filled on public.universe_project_applications(project_id,role) where status='accepted';
create index universe_project_applicant on public.universe_project_applications(applicant);
create table public.universe_project_follows (
 project_id uuid not null references public.universe_projects on delete cascade, user_id uuid not null references public.universe_profiles(user_id) on delete cascade, primary key(project_id,user_id)
);
create index universe_project_follow_user on public.universe_project_follows(user_id);
create table public.universe_project_credits (
 project_id uuid not null references public.universe_projects on delete cascade, user_id uuid not null references public.universe_profiles(user_id) on delete cascade, primary key(project_id,user_id)
);
create index universe_project_credits_user on public.universe_project_credits(user_id);
alter table public.universe_project_credits enable row level security;
revoke all on public.universe_project_credits from public,anon,authenticated;
create table public.universe_project_messages (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.universe_projects on delete cascade,
 author uuid not null references public.universe_profiles(user_id) on delete cascade, body text not null check(length(body) between 1 and 2000), created_at timestamptz not null default now()
);
create index universe_project_messages_project on public.universe_project_messages(project_id,created_at);
create index universe_projects_owner on public.universe_projects(owner);
create table public.universe_magazine_editors(user_id uuid primary key references public.universe_profiles(user_id) on delete cascade);
create table public.universe_magazine_editions (
 id uuid primary key default gen_random_uuid(), title text not null, date date not null unique, published boolean not null default false
);
create table public.universe_magazine_submissions (
 id uuid primary key default gen_random_uuid(), author uuid not null references public.universe_profiles(user_id) on delete cascade,
 title text not null, body text not null, kind text not null check(kind in ('project','plan','post','initiative')),
 source_id uuid, source_url text not null default '', attribution text not null, consent boolean not null default true,
 edition_id uuid references public.universe_magazine_editions on delete set null, created_at timestamptz not null default now()
);
create index universe_magazine_submission_author on public.universe_magazine_submissions(author);
create index universe_magazine_submission_edition on public.universe_magazine_submissions(edition_id) where consent;
alter table public.universe_projects enable row level security;
alter table public.universe_project_applications enable row level security;
alter table public.universe_project_follows enable row level security;
alter table public.universe_project_messages enable row level security;
alter table public.universe_magazine_editors enable row level security;
alter table public.universe_magazine_editions enable row level security;
alter table public.universe_magazine_submissions enable row level security;
revoke all on public.universe_projects,public.universe_project_applications,public.universe_project_follows,public.universe_project_messages,public.universe_magazine_editors,public.universe_magazine_editions,public.universe_magazine_submissions from public,anon,authenticated;

create or replace function public.universe_studio(p_command text default 'read', p_input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); is_editor boolean; p public.universe_projects; a public.universe_project_applications;
 sid uuid; eid uuid; spec jsonb; roles jsonb; role_name text; field text; val text; in_team boolean; idx integer; m jsonb; ms jsonb;
begin
 if not public.universe_is_member() then raise exception 'Necesitas una cuenta universitaria verificada.'; end if;
 select exists(select 1 from public.universe_magazine_editors where user_id=u) into is_editor;
 -- Serialize each actor's mutations; the project row serializes acceptance and milestones across actors.
 if p_command<>'read' then perform pg_advisory_xact_lock(hashtextextended(u::text,8)); end if;
 if p_command='create_project' then
  spec:='{}';
  foreach field in array array['title','objective','existing','contribution','commitment','offer'] loop
   val:=trim(coalesce(p_input->>field,''));
   if length(val)<3 or length(val)>(case when field='title' then 100 else 1200 end) then raise exception 'Completa los campos del proyecto (máximo 1200 caracteres; título 100).'; end if;
   spec:=spec||jsonb_build_object(field,val);
  end loop;
  if coalesce(p_input->>'mode','') not in ('Presencial','Remoto','Mixto') then raise exception 'Elige una modalidad.'; end if;
  roles:=p_input->'roles';
  if jsonb_typeof(roles) is distinct from 'array' then raise exception 'Indica los puestos.'; end if;
  if jsonb_array_length(roles) not between 1 and 6 then raise exception 'Indica entre uno y seis puestos.'; end if;
  for role_name in select jsonb_array_elements_text(roles) loop
   if length(trim(role_name)) not between 2 and 80 then raise exception 'Revisa los puestos.'; end if;
  end loop;
  if (select count(distinct value) from jsonb_array_elements_text(roles))<>jsonb_array_length(roles) then raise exception 'Cada puesto necesita un nombre distinto.'; end if;
  spec:=spec||jsonb_build_object('roles',roles,'mode',p_input->>'mode','beginners',coalesce((p_input->>'beginners')::boolean,false));
  insert into public.universe_projects(owner,spec) values(u,spec);
 elsif p_command in ('apply','decide','follow','milestone','stage','result','team_message','credit') then
  select * into p from public.universe_projects where id=(p_input->>'id')::uuid for update;
  if not found then raise exception 'El proyecto ya no está disponible.'; end if;
  in_team:=p.owner=u or exists(select 1 from public.universe_project_applications where project_id=p.id and applicant=u and status='accepted');
  if p_command='credit' then
   if not in_team or p.stage<>'completed' then raise exception 'Solo puedes añadir a tu perfil resultados de tu equipo.'; end if;
   if coalesce((p_input->>'on')::boolean,false) then insert into public.universe_project_credits values(p.id,u) on conflict do nothing;
   else delete from public.universe_project_credits where project_id=p.id and user_id=u; end if;
  elsif p_command='follow' then
   if coalesce((p_input->>'on')::boolean,false) then insert into public.universe_project_follows values(p.id,u) on conflict do nothing;
   else delete from public.universe_project_follows where project_id=p.id and user_id=u; end if;
  elsif p_command='apply' then
   if p.owner=u or p.stage='completed' then raise exception 'Este proyecto no admite tu solicitud.'; end if;
   if not (p.spec->'roles' ? coalesce(p_input->>'role','')) then raise exception 'Elige un puesto disponible.'; end if;
   if exists(select 1 from public.universe_project_applications where project_id=p.id and role=p_input->>'role' and status='accepted') then raise exception 'Ese puesto ya está cubierto.'; end if;
   if length(trim(coalesce(p_input->>'body',''))) not between 10 and 1200 or length(trim(coalesce(p_input->>'availability',''))) not between 3 and 300 then raise exception 'Cuéntanos tu aportación y disponibilidad.'; end if;
   val:=coalesce(p_input->>'portfolio','');
   if length(val)>500 or (val<>'' and val !~ '^https?://[^[:space:]]+$') then raise exception 'Usa un enlace http o https válido.'; end if;
   if exists(select 1 from public.universe_project_applications where project_id=p.id and applicant=u) then raise exception 'Ya has enviado una solicitud a este proyecto.'; end if;
   insert into public.universe_project_applications(project_id,applicant,role,body,availability,portfolio) values(p.id,u,p_input->>'role',trim(p_input->>'body'),trim(p_input->>'availability'),val);
  elsif p_command='decide' then
   if p.owner<>u or p.stage='completed' then raise exception 'Solo quien impulsa el proyecto puede gestionar solicitudes abiertas.'; end if;
   select * into a from public.universe_project_applications where id=(p_input->>'application')::uuid and project_id=p.id and status='pending' for update;
   if not found then raise exception 'La solicitud ya se ha resuelto.'; end if;
   if p_input->>'status' not in ('accepted','rejected') or p_input->>'status' is null then raise exception 'Decisión no válida.'; end if;
   if p_input->>'status'='accepted' and exists(select 1 from public.universe_project_applications where project_id=p.id and role=a.role and status='accepted') then raise exception 'Ese puesto ya está cubierto.'; end if;
   update public.universe_project_applications set status=p_input->>'status' where id=a.id;
  elsif p_command='team_message' then
   if not in_team then raise exception 'Solo el equipo puede entrar en esta conversación.'; end if;
   val:=trim(coalesce(p_input->>'body','')); if length(val) not between 1 and 2000 then raise exception 'Escribe entre 1 y 2000 caracteres.'; end if;
   insert into public.universe_project_messages(project_id,author,body) values(p.id,u,val);
  elsif p_command='milestone' then
   if not in_team or p.stage='completed' then raise exception 'Solo el equipo puede actualizar los hitos de un proyecto abierto.'; end if;
   idx:=(p_input->>'index')::integer;
   if idx is null or idx<0 or idx>=jsonb_array_length(p.milestones) then raise exception 'Hito no válido.'; end if;
   ms:=jsonb_set(p.milestones,array[idx::text,'done'],to_jsonb(coalesce((p_input->>'done')::boolean,false)));
   update public.universe_projects set milestones=ms where id=p.id;
  elsif p_command='stage' then
   if p.owner<>u or p.stage='completed' or coalesce(p_input->>'stage','') not in ('forming','building') then raise exception 'No puedes cambiar esta etapa.'; end if;
   update public.universe_projects set stage=p_input->>'stage' where id=p.id;
  elsif p_command='result' then
   if p.owner<>u or p.stage='completed' then raise exception 'Solo quien impulsa el proyecto puede cerrarlo.'; end if;
   val:=trim(coalesce(p_input->>'body',''));
   if length(val) not between 20 and 2000 then raise exception 'Describe el resultado (20–2000 caracteres).'; end if;
   if length(coalesce(p_input->>'url',''))>500 or (coalesce(p_input->>'url','')<>'' and p_input->>'url' !~ '^https?://[^[:space:]]+$') then raise exception 'Revisa el enlace al resultado.'; end if;
   update public.universe_projects set result=val,result_url=coalesce(p_input->>'url',''),stage='completed' where id=p.id;
  end if;
 elsif p_command='submit' then
  if coalesce((p_input->>'consent')::boolean,false) is not true then raise exception 'Debes autorizar esta versión exacta.'; end if;
  if coalesce(p_input->>'kind','') not in ('project','plan','post','initiative') then raise exception 'Tipo de propuesta no válido.'; end if;
  if length(trim(coalesce(p_input->>'title',''))) not between 3 and 120 or length(trim(coalesce(p_input->>'body',''))) not between 20 and 800 then raise exception 'Revisa el título y el texto de la tarjeta.'; end if;
  sid:=nullif(p_input->>'source_id','')::uuid;
  if p_input->>'kind'='project' and not exists(select 1 from public.universe_projects where id=sid and owner=u) then raise exception 'Solo puedes proponer un proyecto propio.'; end if;
  if p_input->>'kind'='plan' and not exists(select 1 from public.universe_plans where id=sid and creator_id=u) then raise exception 'Solo puedes proponer un plan propio.'; end if;
  if p_input->>'kind'='post' and not exists(select 1 from public.universe_posts where id=sid and author_id=u and group_id is null) then raise exception 'Solo puedes proponer un hilo público propio.'; end if;
  val:=coalesce(p_input->>'source_url','');
  if length(val)>500 or (p_input->>'kind'='initiative' and val !~ '^https?://[^[:space:]]+$') then raise exception 'Incluye la fuente de la iniciativa.'; end if;
  insert into public.universe_magazine_submissions(author,title,body,kind,source_id,source_url,attribution)
   select u,trim(p_input->>'title'),trim(p_input->>'body'),p_input->>'kind',case when p_input->>'kind'='initiative' then null else sid end,case when p_input->>'kind'='initiative' then val else '' end,name from public.universe_profiles where user_id=u;
 elsif p_command='withdraw' then
  update public.universe_magazine_submissions set consent=false,edition_id=null where id=(p_input->>'id')::uuid and author=u and consent;
  if not found then raise exception 'La propuesta no está disponible.'; end if;
 elsif p_command='create_edition' then
  if not is_editor then raise exception 'Necesitas acceso editorial.'; end if;
  if length(trim(coalesce(p_input->>'title',''))) not between 3 and 120 then raise exception 'Escribe un título de edición.'; end if;
  insert into public.universe_magazine_editions(title,date) values(trim(p_input->>'title'),(p_input->>'date')::date);
 elsif p_command in ('select','publish_edition') then
  if not is_editor then raise exception 'Necesitas acceso editorial.'; end if;
  eid:=(p_input->>'edition')::uuid;
  perform 1 from public.universe_magazine_editions where id=eid and not published for update;
  if not found then raise exception 'Esta edición ya no es un borrador.'; end if;
  if p_command='select' then
   if coalesce((p_input->>'on')::boolean,false) then
    if (select count(*) from public.universe_magazine_submissions where edition_id=eid and consent)>=6 then raise exception 'Una edición admite hasta seis piezas.'; end if;
    update public.universe_magazine_submissions set edition_id=eid where id=(p_input->>'id')::uuid and consent and edition_id is null;
   else update public.universe_magazine_submissions set edition_id=null where id=(p_input->>'id')::uuid and edition_id=eid and consent; end if;
   if not found then raise exception 'La propuesta ya no está disponible.'; end if;
  else
   if not exists(select 1 from public.universe_magazine_submissions where edition_id=eid and consent) then raise exception 'Selecciona al menos una pieza autorizada.'; end if;
   update public.universe_magazine_editions set published=true where id=eid;
  end if;
 elsif p_command<>'read' then raise exception 'Acción no disponible.';
 end if;
 return jsonb_build_object(
  'editor',is_editor,
  'projects',coalesce((select jsonb_agg((to_jsonb(x)-'spec')||x.spec||jsonb_build_object('credits',coalesce((select jsonb_agg(c.user_id) from public.universe_project_credits c where c.project_id=x.id),'[]'::jsonb),'following',exists(select 1 from public.universe_project_follows f where f.project_id=x.id and f.user_id=u),'team',coalesce((select jsonb_agg(jsonb_build_object('user_id',b.applicant,'role',b.role)) from public.universe_project_applications b where b.project_id=x.id and b.status='accepted'),'[]'::jsonb)) order by x.created_at desc) from public.universe_projects x),'[]'::jsonb),
  'applications',coalesce((select jsonb_agg(to_jsonb(x)) from public.universe_project_applications x join public.universe_projects y on y.id=x.project_id where x.applicant=u or y.owner=u),'[]'::jsonb),
  'messages',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.universe_project_messages x where exists(select 1 from public.universe_projects y where y.id=x.project_id and (y.owner=u or exists(select 1 from public.universe_project_applications b where b.project_id=y.id and b.applicant=u and b.status='accepted')))),'[]'::jsonb),
  'editions',coalesce((select jsonb_agg(to_jsonb(x) order by x.date desc) from public.universe_magazine_editions x where x.published or is_editor),'[]'::jsonb),
  'submissions',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from public.universe_magazine_submissions x where x.author=u or (x.consent and (is_editor or exists(select 1 from public.universe_magazine_editions e where e.id=x.edition_id and e.published)))),'[]'::jsonb)
 );
end $$;
revoke all on function public.universe_studio(text,jsonb) from public,anon;
grant execute on function public.universe_studio(text,jsonb) to authenticated;


-- 202609200010_group_privacy.sql
-- Private groups stay out of discovery. A random invitation token is required
-- to open and join them, while members can keep using the normal group feed.
alter table public.universe_groups
 add column if not exists is_private boolean not null default false,
 add column if not exists share_token uuid not null default gen_random_uuid();

create unique index if not exists universe_groups_share_token on public.universe_groups(share_token);

create or replace function public.universe_can_read_group(group_uuid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(
  select 1 from public.universe_groups g
  where g.id=group_uuid and (
   not g.is_private
   or g.creator_id=(select auth.uid())
   or exists(select 1 from public.universe_group_members m where m.group_id=g.id and m.user_id=(select auth.uid()))
  )
 );
$$;
revoke all on function public.universe_can_read_group(uuid) from public,anon,authenticated;
grant execute on function public.universe_can_read_group(uuid) to authenticated;

drop policy if exists groups_read on public.universe_groups;
create policy groups_read on public.universe_groups for select to authenticated
 using((select public.universe_is_member()) and (not is_private or creator_id=(select auth.uid()) or public.universe_can_read_group(id)));

drop policy if exists group_members_read on public.universe_group_members;
create policy group_members_read on public.universe_group_members for select to authenticated
 using((select public.universe_is_member()) and public.universe_can_read_group(group_id));

drop policy if exists group_members_insert on public.universe_group_members;
create policy group_members_insert on public.universe_group_members for insert to authenticated
 with check(
  (select public.universe_is_member()) and user_id=(select auth.uid())
  and exists(select 1 from public.universe_groups g where g.id=group_id and (not g.is_private or g.creator_id=(select auth.uid())))
 );

drop policy if exists posts_read on public.universe_posts;
create policy posts_read on public.universe_posts for select to authenticated
 using((select public.universe_is_member()) and (group_id is null or public.universe_can_read_group(group_id)));

drop policy if exists comments_read on public.universe_comments;
create policy comments_read on public.universe_comments for select to authenticated
 using((select public.universe_is_member()) and exists(
  select 1 from public.universe_posts p where p.id=post_id and (p.group_id is null or public.universe_can_read_group(p.group_id))
 ));

drop policy if exists likes_read on public.universe_likes;
create policy likes_read on public.universe_likes for select to authenticated
 using((select public.universe_is_member()) and exists(
  select 1 from public.universe_posts p where p.id=post_id and (p.group_id is null or public.universe_can_read_group(p.group_id))
 ));

create or replace function public.universe_shared_group(share_uuid uuid)
returns setof public.universe_groups
language sql stable security definer set search_path = '' as $$
 select g.* from public.universe_groups g
 where (select public.universe_is_member()) and g.share_token=share_uuid;
$$;
revoke all on function public.universe_shared_group(uuid) from public,anon;
grant execute on function public.universe_shared_group(uuid) to authenticated;

create or replace function public.universe_set_group_membership(group_uuid uuid, attending boolean, share_uuid uuid default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare g public.universe_groups; caller uuid:=(select auth.uid());
begin
 if not public.universe_is_member() or attending is null then raise exception 'UNIVERSE_UNIVERSITY_REQUIRED' using errcode='42501'; end if;
 select * into g from public.universe_groups where id=group_uuid for update;
 if not found then raise exception 'GROUP_UNAVAILABLE'; end if;
 if attending then
  if g.is_private and g.creator_id<>caller and not exists(select 1 from public.universe_group_members m where m.group_id=g.id and m.user_id=caller) and g.share_token is distinct from share_uuid then
   raise exception 'PRIVATE_GROUP_INVITE_REQUIRED';
  end if;
  insert into public.universe_group_members(group_id,user_id) values(g.id,caller) on conflict(group_id,user_id) do nothing;
 else
  if g.creator_id=caller then raise exception 'GROUP_OWNER_CANNOT_LEAVE'; end if;
  delete from public.universe_group_members where group_id=g.id and user_id=caller;
 end if;
end;
$$;
revoke all on function public.universe_set_group_membership(uuid,boolean,uuid) from public,anon;
grant execute on function public.universe_set_group_membership(uuid,boolean,uuid) to authenticated;


-- 202609200011_magazine_proposals.sql
-- Entre líneas: private drafts, images, editorial decisions and author history.
-- Apply after 202609190008. Existing proposals and editions are preserved.
alter table public.universe_magazine_submissions drop constraint universe_magazine_submissions_kind_check;
alter table public.universe_magazine_submissions add constraint universe_magazine_submissions_kind_check check(kind in ('story','project','plan','post','initiative'));
alter table public.universe_magazine_submissions
 add column status text not null default 'pending' check(status in ('draft','pending','changes_requested','accepted','rejected','published','withdrawn')),
 add column summary text not null default '', add column section text not null default 'Vida de campus',
 add column layout text not null default 'classic' check(layout in ('classic','photo','split')),
 add column images jsonb not null default '[]' check(jsonb_typeof(images)='array' and jsonb_array_length(images)<=4),
 add column author_note text not null default '', add column editorial_note text not null default '',
 add column revision integer not null default 1, add column updated_at timestamptz not null default now(),
 add column history jsonb not null default '[]';
update public.universe_magazine_submissions s set status=case when not consent then 'withdrawn' when exists(select 1 from public.universe_magazine_editions e where e.id=s.edition_id and e.published) then 'published' when edition_id is not null then 'accepted' else 'pending' end;
update public.universe_magazine_submissions set history=jsonb_build_array(jsonb_build_object('status',status,'at',created_at,'note',''));
create index universe_magazine_review_queue on public.universe_magazine_submissions(status,created_at) where consent;

-- Keep existing project commands behind the same RPC, with no direct legacy access.
alter function public.universe_studio(text,jsonb) rename to universe_studio_legacy;
revoke all on function public.universe_studio_legacy(text,jsonb) from public,anon,authenticated;

create or replace function public.universe_magazine_can_read_image(object_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select public.universe_is_member() and (
 split_part(object_name,'/',1)=auth.uid()::text or exists(
  select 1 from public.universe_magazine_submissions s where s.consent and s.status<>'draft'
  and exists(select 1 from jsonb_array_elements(s.images) i where i->>'path'=object_name)
  and (exists(select 1 from public.universe_magazine_editors where user_id=auth.uid()) or
   (s.status='published' and exists(select 1 from public.universe_magazine_editions e where e.id=s.edition_id and e.published)))
 ));
$$;
create or replace function public.universe_magazine_can_remove_image(object_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select public.universe_is_member() and split_part(object_name,'/',1)=auth.uid()::text
 and not exists(select 1 from public.universe_magazine_submissions s, jsonb_array_elements(s.images) i where i->>'path'=object_name);
$$;
revoke all on function public.universe_magazine_can_read_image(text), public.universe_magazine_can_remove_image(text) from public,anon;
grant execute on function public.universe_magazine_can_read_image(text), public.universe_magazine_can_remove_image(text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('universe-magazine','universe-magazine',false,2097152,array['image/webp'])
on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=array['image/webp'];
create policy magazine_image_upload on storage.objects for insert to authenticated with check(
 bucket_id='universe-magazine' and (select public.universe_is_member())
 and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.webp$' and split_part(name,'/',1)=(select auth.uid())::text);
create policy magazine_image_read on storage.objects for select to authenticated using(bucket_id='universe-magazine' and public.universe_magazine_can_read_image(name));
create policy magazine_image_remove on storage.objects for delete to authenticated using(bucket_id='universe-magazine' and public.universe_magazine_can_remove_image(name));

create or replace function public.universe_studio(p_command text default 'read',p_input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); editor boolean; s public.universe_magazine_submissions; sid uuid; eid uuid;
 sending boolean; k text; st text; v_images jsonb; image jsonb; field text; val text; content jsonb;
begin
 if not public.universe_is_member() then raise exception 'Necesitas una cuenta universitaria verificada.'; end if;
 select exists(select 1 from public.universe_magazine_editors where user_id=u) into editor;
 if p_command<>'read' then perform pg_advisory_xact_lock(hashtextextended(u::text,8)); end if;
 if p_command in ('save_submission','submit') then
  sending:=p_command='submit' or coalesce((p_input->>'send')::boolean,false);
  sid:=nullif(p_input->>'id','')::uuid;
  if sid is not null then
   select * into s from public.universe_magazine_submissions where id=sid and author=u for update;
   if not found or s.status not in ('draft','changes_requested','rejected','withdrawn') then raise exception 'Retira la propuesta antes de editarla.'; end if;
   if s.revision is distinct from (p_input->>'revision')::integer then raise exception 'Esta propuesta ha cambiado. Recarga antes de guardar.'; end if;
  end if;
  k:=coalesce(p_input->>'kind','');
  if k not in ('story','project','plan','post','initiative') then raise exception 'Elige un tipo de historia.'; end if;
  foreach field in array array['title','body','summary','author_note'] loop
   val:=trim(coalesce(p_input->>field,''));
   if length(val)>(case field when 'title' then 120 when 'body' then 8000 when 'summary' then 240 else 1000 end) then raise exception 'Revisa la longitud del texto.'; end if;
  end loop;
  if sending and (length(trim(coalesce(p_input->>'title','')))<3 or length(trim(coalesce(p_input->>'body','')))<40) then raise exception 'Añade un título y al menos 40 caracteres de historia.'; end if;
  if sending and coalesce((p_input->>'consent')::boolean,false) is not true then raise exception 'Debes autorizar esta versión exacta.'; end if;
  if coalesce(p_input->>'section','Vida de campus') not in ('Vida de campus','Proyectos','Planes','Cultura','Opinión') or coalesce(p_input->>'layout','classic') not in ('classic','photo','split') then raise exception 'Elige sección y presentación.'; end if;
  if sending or nullif(p_input->>'source_id','') is not null then
   if k='project' and not exists(select 1 from public.universe_projects where id=nullif(p_input->>'source_id','')::uuid and owner=u) then raise exception 'Solo puedes proponer un proyecto propio.'; end if;
   if k='plan' and not exists(select 1 from public.universe_plans where id=nullif(p_input->>'source_id','')::uuid and creator_id=u) then raise exception 'Solo puedes proponer un plan propio.'; end if;
   if k='post' and not exists(select 1 from public.universe_posts where id=nullif(p_input->>'source_id','')::uuid and author_id=u and group_id is null) then raise exception 'Solo puedes proponer un hilo público propio.'; end if;
  end if;
  val:=coalesce(p_input->>'source_url','');
  if length(val)>500 or (val<>'' and (val !~ '^https?://[^[:space:]]+$' or val ~ '^https?://[^/]*@')) or (sending and k='initiative' and val='') then raise exception 'Incluye un enlace válido a la fuente.'; end if;
  v_images:=coalesce(p_input->'images','[]'::jsonb);
  if jsonb_typeof(v_images) is distinct from 'array' then raise exception 'Revisa las imágenes.'; end if;
  if jsonb_array_length(v_images)>4 then raise exception 'Máximo cuatro imágenes.'; end if;
  if sending and jsonb_array_length(v_images)>0 and coalesce((p_input->>'image_rights')::boolean,false) is not true then raise exception 'Confirma los permisos de las imágenes.'; end if;
  if sending and coalesce(p_input->>'layout','classic')<>'classic' and jsonb_array_length(v_images)=0 then raise exception 'Esta presentación necesita una imagen.'; end if;
  for image in select value from jsonb_array_elements(v_images) loop
   if jsonb_typeof(image) is distinct from 'object' or coalesce(image->>'path','') !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.webp$' or split_part(image->>'path','/',1)<>u::text then raise exception 'Solo puedes adjuntar tus imágenes.'; end if;
   if not exists(select 1 from storage.objects where bucket_id='universe-magazine' and name=image->>'path') then raise exception 'Una imagen no se ha subido. Inténtalo de nuevo.'; end if;
   foreach field in array array['alt','caption','credit'] loop
    if jsonb_typeof(image->field) is distinct from 'string' or length(image->>field)>(case field when 'alt' then 200 when 'caption' then 300 else 120 end) then raise exception 'Revisa los textos de las imágenes.'; end if;
   end loop;
   if sending and (length(trim(image->>'alt'))=0 or length(trim(image->>'credit'))=0) then raise exception 'Añade una descripción y un crédito a cada imagen.'; end if;
  end loop;
  if (select count(distinct i->>'path') from jsonb_array_elements(v_images) i)<>jsonb_array_length(v_images) then raise exception 'No repitas la misma imagen.'; end if;
  st:=case when sending then 'pending' else 'draft' end;
  if sid is null then
   insert into public.universe_magazine_submissions(author,title,body,kind,source_id,source_url,attribution,consent,status)
   select u,'','',k,null,'',name,false,'draft' from public.universe_profiles where user_id=u returning id into sid;
  end if;
  update public.universe_magazine_submissions set title=trim(coalesce(p_input->>'title','')),body=trim(coalesce(p_input->>'body','')),kind=k,
   source_id=case when k in ('project','plan','post') then nullif(p_input->>'source_id','')::uuid else null end,
   source_url=case when k='initiative' then val else '' end,summary=trim(coalesce(p_input->>'summary','')),
   section=coalesce(p_input->>'section','Vida de campus'),layout=coalesce(p_input->>'layout','classic'),images=v_images,
   author_note=trim(coalesce(p_input->>'author_note','')),editorial_note='',consent=sending,status=st,edition_id=null,
   revision=revision+1,updated_at=now(),history=history||jsonb_build_array(jsonb_build_object('status',st,'at',now(),'note',case when sending then 'Versión autorizada y enviada a revisión.' else 'Borrador guardado.' end)) where id=sid;
 elsif p_command='review_submission' then
  if not editor then raise exception 'Necesitas acceso editorial.'; end if;
  select * into s from public.universe_magazine_submissions where id=(p_input->>'id')::uuid for update;
  if not found or not s.consent or s.status<>'pending' then raise exception 'La propuesta ya no está pendiente de revisión.'; end if;
  st:=coalesce(p_input->>'status',''); val:=trim(coalesce(p_input->>'note',''));
  if st not in ('accepted','rejected','changes_requested') or length(val)>1000 or (st<>'accepted' and length(val)<5) then raise exception 'Indica la decisión y explica el motivo (5–1000 caracteres).'; end if;
  update public.universe_magazine_submissions set status=st,editorial_note=val,revision=revision+1,updated_at=now(),history=history||jsonb_build_array(jsonb_build_object('status',st,'at',now(),'note',val)) where id=s.id;
 elsif p_command='withdraw' then
  select * into s from public.universe_magazine_submissions where id=(p_input->>'id')::uuid and author=u and consent for update;
  if not found then raise exception 'La propuesta no está disponible.'; end if;
  update public.universe_magazine_submissions set consent=false,status='withdrawn',edition_id=null,revision=revision+1,updated_at=now(),history=history||jsonb_build_array(jsonb_build_object('status','withdrawn','at',now(),'note','El autor ha retirado el permiso.')) where id=s.id;
 elsif p_command in ('select','publish_edition') then
  if not editor then raise exception 'Necesitas acceso editorial.'; end if;
  eid:=(p_input->>'edition')::uuid;
  perform 1 from public.universe_magazine_editions where id=eid and not published for update;
  if not found then raise exception 'Esta edición ya no es un borrador.'; end if;
  if p_command='select' then
   select * into s from public.universe_magazine_submissions where id=(p_input->>'id')::uuid and consent and status='accepted' for update;
   if not found then raise exception 'Solo puedes seleccionar propuestas aceptadas y autorizadas.'; end if;
   if coalesce((p_input->>'on')::boolean,false) then
    if s.edition_id is not null then raise exception 'La propuesta ya está seleccionada.'; end if;
    if (select count(*) from public.universe_magazine_submissions where edition_id=eid and consent)>=6 then raise exception 'Una edición admite hasta seis piezas.'; end if;
    update public.universe_magazine_submissions set edition_id=eid,updated_at=now() where id=s.id;
   else
    if s.edition_id is distinct from eid then raise exception 'La propuesta no pertenece a esta edición.'; end if;
    update public.universe_magazine_submissions set edition_id=null,updated_at=now() where id=s.id;
   end if;
  else
   perform 1 from public.universe_magazine_submissions where edition_id=eid and consent and status='accepted' for update;
   if not found then raise exception 'Selecciona al menos una pieza aceptada y autorizada.'; end if;
   update public.universe_magazine_editions set published=true where id=eid;
   update public.universe_magazine_submissions set status='published',revision=revision+1,updated_at=now(),history=history||jsonb_build_array(jsonb_build_object('status','published','at',now(),'note','Publicada en una edición.')) where edition_id=eid and consent and status='accepted';
  end if;
 else
  perform public.universe_studio_legacy(p_command,p_input);
 end if;
 content:=public.universe_studio_legacy('read','{}');
 return content||jsonb_build_object('magazine_version',2,'submissions',coalesce((
  select jsonb_agg(case when x.author=u or editor then to_jsonb(x) else to_jsonb(x)-'author_note'-'editorial_note'-'history' end order by x.created_at desc)
  from public.universe_magazine_submissions x where x.author=u or (x.consent and x.status<>'draft' and (editor or (x.status='published' and exists(select 1 from public.universe_magazine_editions e where e.id=x.edition_id and e.published))))
 ),'[]'::jsonb));
end $$;
revoke all on function public.universe_studio(text,jsonb) from public,anon;
grant execute on function public.universe_studio(text,jsonb) to authenticated;


-- 202609200012_thread_signals.sql
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


-- 202609200013_chat_media.sql
-- Fotos, GIFs y vídeos en el chat privado. Apply after the existing migrations.
-- A message may now carry one file instead of (or along with) text. The file lives
-- in a private bucket under <thread>/<sender>/<uuid>.<ext>, so the path alone says
-- who may touch it: only the two people of that conversation can read it, and only
-- the sender can write or remove it. Nothing here is ever public.
alter table public.universe_messages
 add column media_path text,
 add column media_kind text check (media_kind in ('image','video'));
alter table public.universe_messages drop constraint if exists universe_messages_body_check;
alter table public.universe_messages
 add constraint universe_messages_body_check check (char_length(body)<=2000 and (char_length(btrim(body))>=1 or media_path is not null)),
 add constraint universe_messages_media_pair check ((media_path is null)=(media_kind is null)),
 add constraint universe_messages_media_owner check (media_path is null or media_path like thread_id::text||'/'||sender_id::text||'/%');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('universe-chat','universe-chat',false,26214400,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
on conflict(id) do update set public=false,file_size_limit=26214400,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'];
create policy universe_chat_upload on storage.objects for insert to authenticated
with check(bucket_id='universe-chat' and (select public.universe_is_member())
 and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|png|webp|gif|mp4|webm)$'
 and split_part(name,'/',2)=(select auth.uid())::text
 and exists(select 1 from public.universe_threads t where t.id::text=split_part(name,'/',1) and (t.user_a=(select auth.uid()) or t.user_b=(select auth.uid()))));
create policy universe_chat_view on storage.objects for select to authenticated
using(bucket_id='universe-chat' and (select public.universe_is_member())
 and exists(select 1 from public.universe_threads t where t.id::text=split_part(name,'/',1) and (t.user_a=(select auth.uid()) or t.user_b=(select auth.uid()))));
create policy universe_chat_remove on storage.objects for delete to authenticated
using(bucket_id='universe-chat' and (select public.universe_is_member()) and split_part(name,'/',2)=(select auth.uid())::text);


-- 202609200013_profile_tastes.sql
-- The shelf of the profile: what each person watches, plays and listens to, and
-- the quick picks. Both are filled by tapping, never typed.
-- Favourites arrive already resolved from the public catalogues (title, subtitle
-- and cover path), so reading a profile never calls an external API. The shape
-- is checked in lib/community/tastes.ts; here we only bound size and vocabulary.
alter table public.universe_profiles
  add column favorites jsonb not null default '[]'::jsonb
    check (jsonb_typeof(favorites) = 'array'
           and jsonb_array_length(favorites) <= 20
           and length(favorites::text) <= 4000),
  add column picks text[] not null default '{}'
    check (cardinality(picks) <= 12 and picks <@ array[
      'madrugar','trasnochar','biblioteca','cocina','horchata','cafe',
      'mano','tablet','bus','bici','playa','montana',
      'ultima-noche','al-dia','maraton','capitulo','auriculares','altavoz',
      'salir','sofa','menu','tupper','contesto','silenciado'
    ]::text[]);

grant update(favorites, picks) on public.universe_profiles to authenticated;


-- 202609200014_plus_one.sql
-- Tu +1. Apply after the existing migrations. No client metadata grants access.
-- Keep consumed slots even after either auth account is deleted (no cascading FK).
create table public.universe_plus_one (
 inviter_id uuid primary key,
 token uuid not null unique default gen_random_uuid(),
 recipient_email text not null check (recipient_email = lower(btrim(recipient_email))),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now() + interval '7 days',
 cancelled_at timestamptz,
 claimed_user_id uuid unique,
 claimed_at timestamptz,
 check ((claimed_user_id is null) = (claimed_at is null))
);
alter table public.universe_plus_one enable row level security;
revoke all on public.universe_plus_one from public, anon, authenticated, supabase_auth_admin;

-- Internal helpers have no API grants, including lookup by arbitrary user id.
create function public.universe_account_kind(account_id uuid) returns text
language sql stable security definer set search_path='' as $$
 select case when exists (
  select 1 from public.universe_university_domains d
  where d.domain=split_part(lower(u.email),'@',2) and d.enabled and d.launch_region='valencia'
 ) then 'university' when exists (
  select 1 from public.universe_plus_one i where i.claimed_user_id=u.id
 ) then 'guest' end
 from auth.users u where u.id=account_id and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false);
$$;
revoke all on function public.universe_account_kind(uuid) from public, anon, authenticated;

create function public.universe_plus_one_eligible(account_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(public.universe_account_kind(account_id)='university',false)
 and exists(select 1 from public.universe_profiles p where p.user_id=account_id and length(btrim(p.bio))>0 and cardinality(p.interests)>0)
 and (exists(select 1 from public.universe_posts p where p.author_id=account_id)
   or exists(select 1 from public.universe_comments c where c.author_id=account_id)
   or exists(select 1 from public.universe_plan_members m where m.user_id=account_id));
$$;
revoke all on function public.universe_plus_one_eligible(uuid) from public, anon, authenticated;

create function public.universe_plus_one_status() returns jsonb
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); kind text:=public.universe_account_kind(caller); invitation public.universe_plus_one;
begin
 if kind is null then raise exception 'INVITE_ACCESS_REQUIRED'; end if;
 if kind='guest' then return jsonb_build_object('state','guest'); end if;
 select * into invitation from public.universe_plus_one where inviter_id=caller;
 if invitation.claimed_at is not null then return jsonb_build_object('state','used'); end if;
 if not public.universe_plus_one_eligible(caller) then return jsonb_build_object('state','locked'); end if;
 if invitation.inviter_id is null or invitation.cancelled_at is not null or invitation.expires_at<=now() then return jsonb_build_object('state','available'); end if;
 return jsonb_build_object('state','pending','token',invitation.token,'email',invitation.recipient_email,'expires_at',invitation.expires_at);
end;
$$;
revoke all on function public.universe_plus_one_status() from public, anon;
grant execute on function public.universe_plus_one_status() to authenticated;

create function public.universe_create_plus_one(recipient text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); target text:=lower(btrim(recipient)); invitation public.universe_plus_one;
begin
 -- Serialize competing issue/cancel requests from the same account.
 perform 1 from auth.users where id=caller for update;
 if not public.universe_plus_one_eligible(caller) then raise exception 'INVITE_NOT_ELIGIBLE'; end if;
 if target is null or length(target)>254 or target !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  or exists(select 1 from auth.users where id=caller and lower(email)=target) then raise exception 'INVITE_EMAIL_INVALID'; end if;
 select * into invitation from public.universe_plus_one where inviter_id=caller for update;
 if invitation.claimed_at is not null then raise exception 'INVITE_ALREADY_USED'; end if;
 if invitation.inviter_id is not null and invitation.cancelled_at is null and invitation.expires_at>now() then
  if invitation.recipient_email<>target then raise exception 'INVITE_PENDING'; end if;
  return public.universe_plus_one_status();
 end if;
 insert into public.universe_plus_one(inviter_id,recipient_email) values(caller,target)
 on conflict(inviter_id) do update set token=gen_random_uuid(),recipient_email=excluded.recipient_email,
  created_at=now(),expires_at=now()+interval '7 days',cancelled_at=null;
 return public.universe_plus_one_status();
end;
$$;
revoke all on function public.universe_create_plus_one(text) from public, anon;
grant execute on function public.universe_create_plus_one(text) to authenticated;

create function public.universe_cancel_plus_one() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from auth.users where id=auth.uid() for update;
 if public.universe_account_kind(auth.uid()) is distinct from 'university' then raise exception 'INVITE_NOT_ELIGIBLE'; end if;
 -- A used invitation cannot be revoked by the inviter, even before confirmation.
 update public.universe_plus_one set cancelled_at=now() where inviter_id=auth.uid() and claimed_at is null;
 return public.universe_plus_one_status();
end;
$$;
revoke all on function public.universe_cancel_plus_one() from public, anon;
grant execute on function public.universe_cancel_plus_one() to authenticated;

-- The auth hook provides early feedback; the trigger below is the authority.
create or replace function public.universe_before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare email text:=lower(coalesce(event->'user'->>'email','')); invite text:=event->'user'->'user_metadata'->>'plus_one_token';
begin
 if coalesce(event->'user'->>'is_anonymous','false')='true'
  or coalesce(event->'user'->'app_metadata'->>'provider','email')<>'email' then
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','UNIVERSE_UNIVERSITY_REQUIRED'));
 end if;
 if exists(select 1 from public.universe_university_domains d where d.domain=split_part(email,'@',2) and d.enabled and d.launch_region='valencia')
 or exists(select 1 from public.universe_plus_one i where i.token::text=invite and i.recipient_email=email
  and i.claimed_at is null and i.cancelled_at is null and i.expires_at>now() and public.universe_account_kind(i.inviter_id)='university') then return '{}'::jsonb; end if;
 return jsonb_build_object('error',jsonb_build_object('http_code',403,'message',case when invite is not null then 'INVITE_INVALID' else 'UNIVERSE_UNIVERSITY_REQUIRED' end));
end;
$$;
revoke all on function public.universe_before_user_created(jsonb) from public,anon,authenticated;
grant execute on function public.universe_before_user_created(jsonb) to supabase_auth_admin;

create or replace function public.universe_guard_email() returns trigger
language plpgsql security definer set search_path='' as $$
declare allowed boolean; claimed uuid;
begin
 if new.email is null or coalesce(new.is_anonymous,false) then raise exception 'UNIVERSE_UNIVERSITY_REQUIRED' using errcode='23514'; end if;
 allowed:=exists(select 1 from public.universe_university_domains d where d.domain=split_part(lower(new.email),'@',2) and d.enabled and d.launch_region='valencia');
 if tg_op='UPDATE' then
  if allowed or exists(select 1 from public.universe_plus_one i where i.claimed_user_id=new.id) then return new; end if;
 elsif new.raw_user_meta_data->>'plus_one_token' is not null then
  -- Atomic claim: double use cannot pass even when two signups race or the hook is disabled.
  update public.universe_plus_one i set claimed_user_id=new.id,claimed_at=now()
  where i.token::text=new.raw_user_meta_data->>'plus_one_token' and i.recipient_email=lower(new.email)
   and i.claimed_at is null and i.cancelled_at is null and i.expires_at>now()
   and public.universe_account_kind(i.inviter_id)='university' returning i.inviter_id into claimed;
  if claimed is null then raise exception 'INVITE_INVALID' using errcode='23514'; end if;
  new.raw_user_meta_data:=new.raw_user_meta_data-'plus_one_token';
  return new;
 elsif allowed then return new;
 end if;
 raise exception 'UNIVERSE_UNIVERSITY_REQUIRED' using errcode='23514';
end;
$$;

create or replace function public.universe_current_member() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',u.id,'email',u.email,'name',left(coalesce(u.raw_user_meta_data->>'full_name',''),60),
  'university',case when public.universe_account_kind(u.id)='university' then d.university_name else 'Acceso por invitación' end,
  'account_kind',public.universe_account_kind(u.id))
 from auth.users u left join public.universe_university_domains d on d.domain=split_part(lower(u.email),'@',2) and d.enabled and d.launch_region='valencia'
 where u.id=auth.uid() and public.universe_account_kind(u.id) is not null;
$$;

alter table public.universe_profiles add column account_kind text not null default 'university' check(account_kind in ('university','guest'));
alter table public.universe_profiles drop constraint universe_profiles_year_check;
alter table public.universe_profiles add constraint universe_profiles_year_check check(year between 0 and 6);
alter table public.universe_profiles drop constraint universe_profiles_campus_check;
alter table public.universe_profiles add constraint universe_profiles_campus_check check(campus in ('Tarongers','Blasco Ibáñez','Vera','Burjassot-Paterna','Otra sede en Valencia','Valencia'));
create or replace function public.universe_profile_identity() returns trigger
language plpgsql security definer set search_path='' as $$
declare member jsonb:=public.universe_current_member();
begin
 if member is null or new.user_id<>(member->>'id')::uuid then raise exception 'UNIVERSE_UNIVERSITY_REQUIRED' using errcode='42501'; end if;
 if tg_op='UPDATE' and new.user_id<>old.user_id then raise exception 'IMMUTABLE_ID' using errcode='42501'; end if;
 new.university:=member->>'university'; new.account_kind:=member->>'account_kind';
 if new.account_kind='guest' then new.year:=0;
 elsif new.year<1 then raise exception 'PROFILE_YEAR_REQUIRED'; end if;
 return new;
end;
$$;

create or replace function public.universe_open_thread(peer_uuid uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); a uuid; b uuid; result uuid;
begin
 if not public.universe_is_member() then raise exception 'UNIVERSE_UNIVERSITY_REQUIRED' using errcode='42501'; end if;
 if peer_uuid is null or peer_uuid=caller or public.universe_account_kind(peer_uuid) is null
  or not exists(select 1 from public.universe_profiles p where p.user_id=peer_uuid) then raise exception 'PEER_UNAVAILABLE'; end if;
 a:=least(caller,peer_uuid); b:=greatest(caller,peer_uuid);
 insert into public.universe_threads(user_a,user_b) values(a,b) on conflict(user_a,user_b) do update set user_a=excluded.user_a returning id into result;
 return result;
end;
$$;


-- 202609200014_profile_faces.sql
-- Profile photo and banner. The browser crops and shrinks the picture to a small
-- webp before uploading, so the bucket only ever holds known, bounded files.
alter table public.universe_profiles
  add column avatar_url text
    check (avatar_url is null or avatar_url ~ '^[a-f0-9-]{36}/avatar-[0-9]{1,14}\.webp$'),
  add column banner_url text
    check (banner_url is null or banner_url ~ '^[a-f0-9-]{36}/banner-[0-9]{1,14}\.webp$');

grant update(avatar_url, banner_url) on public.universe_profiles to authenticated;

-- Private, like the notes bucket: a face is visible to verified members through a
-- short-lived signed link, never to the open internet.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('universe-faces','universe-faces',false,1048576,array['image/webp'])
on conflict(id) do update set public=false,file_size_limit=1048576,allowed_mime_types=array['image/webp'];

create policy universe_faces_write on storage.objects for insert to authenticated
with check(bucket_id='universe-faces' and (select public.universe_is_member())
 and name ~ '^[a-f0-9-]{36}/(avatar|banner)-[0-9]{1,14}\.webp$' and split_part(name,'/',1)=(select auth.uid())::text);
create policy universe_faces_replace on storage.objects for update to authenticated
using(bucket_id='universe-faces' and (select public.universe_is_member()) and split_part(name,'/',1)=(select auth.uid())::text)
with check(bucket_id='universe-faces' and name ~ '^[a-f0-9-]{36}/(avatar|banner)-[0-9]{1,14}\.webp$' and split_part(name,'/',1)=(select auth.uid())::text);
create policy universe_faces_read on storage.objects for select to authenticated
using(bucket_id='universe-faces' and (select public.universe_is_member()));
create policy universe_faces_remove on storage.objects for delete to authenticated
using(bucket_id='universe-faces' and (select public.universe_is_member()) and split_part(name,'/',1)=(select auth.uid())::text);


-- 202609210015_backoffice.sql
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


-- 202609210016_plan_places.sql
-- El mapa de Inicio pintaba once puntos pero un plan sólo podía vivir en cinco:
-- los otros seis salían siempre apagados y al tocarlos no había nada que ver.
-- La lista queda igual que `lib/community/places.ts`, que es la que leen el mapa,
-- el filtro de lugar de Explorar y el formulario de crear plan.
alter table public.universe_plans drop constraint if exists universe_plans_place_check;
alter table public.universe_plans add constraint universe_plans_place_check
  check (place in (
    'Benimaclet',
    'Torres de Serranos',
    'La Malvarrosa',
    'L’Albufera · Gola de Pujol',
    'Campus de Vera · Ágora',
    'Ruzafa · Café',
    'Mercado de Colón · Restaurantes',
    'Biblioteca Pública',
    'Marina · Discotecas',
    'Cines Lys',
    'Jardín del Turia'
  ));


-- 202609220017_launch_regions.sql
-- Launch scope is server-owned. This migration does NOT open Madrid.
create table public.universe_launch_regions (
 slug text primary key check(slug ~ '^[a-z][a-z0-9-]{1,40}$'),
 name text not null,
 enabled boolean not null default false
);
alter table public.universe_launch_regions enable row level security;
revoke all on public.universe_launch_regions from public, anon, authenticated;
insert into public.universe_launch_regions values ('valencia','Valencia',true),('madrid','Madrid',false);
update public.universe_university_domains set enabled=false where domain in ('opre.com','xarly.com');

create or replace function public.universe_account_kind(account_id uuid) returns text
language sql stable security definer set search_path='' as $$
 select case when exists (
  select 1 from public.universe_university_domains d
  where d.domain=split_part(lower(u.email),'@',2) and d.enabled and exists(select 1 from public.universe_launch_regions r where r.slug=d.launch_region and r.enabled)
 ) then 'university' when exists (
  select 1 from public.universe_plus_one i where i.claimed_user_id=u.id
 ) then 'guest' end
 from auth.users u where u.id=account_id and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false);
$$;

create or replace function public.universe_before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare email text:=lower(coalesce(event->'user'->>'email','')); invite text:=event->'user'->'user_metadata'->>'plus_one_token';
begin
 if coalesce(event->'user'->>'is_anonymous','false')='true'
  or coalesce(event->'user'->'app_metadata'->>'provider','email')<>'email' then
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','UNIVERSE_UNIVERSITY_REQUIRED'));
 end if;
 if exists(select 1 from public.universe_university_domains d where d.domain=split_part(email,'@',2) and d.enabled and exists(select 1 from public.universe_launch_regions r where r.slug=d.launch_region and r.enabled))
 or exists(select 1 from public.universe_plus_one i where i.token::text=invite and i.recipient_email=email
  and i.claimed_at is null and i.cancelled_at is null and i.expires_at>now() and public.universe_account_kind(i.inviter_id)='university') then return '{}'::jsonb; end if;
 return jsonb_build_object('error',jsonb_build_object('http_code',403,'message',case when invite is not null then 'INVITE_INVALID' else 'UNIVERSE_UNIVERSITY_REQUIRED' end));
end;
$$;

create or replace function public.universe_guard_email() returns trigger
language plpgsql security definer set search_path='' as $$
declare allowed boolean; claimed uuid;
begin
 if new.email is null or coalesce(new.is_anonymous,false) then raise exception 'UNIVERSE_UNIVERSITY_REQUIRED' using errcode='23514'; end if;
 allowed:=exists(select 1 from public.universe_university_domains d where d.domain=split_part(lower(new.email),'@',2) and d.enabled and exists(select 1 from public.universe_launch_regions r where r.slug=d.launch_region and r.enabled));
 if tg_op='UPDATE' then
  if allowed or exists(select 1 from public.universe_plus_one i where i.claimed_user_id=new.id) then return new; end if;
 elsif new.raw_user_meta_data->>'plus_one_token' is not null then
  -- Atomic claim: double use cannot pass even when two signups race or the hook is disabled.
  update public.universe_plus_one i set claimed_user_id=new.id,claimed_at=now()
  where i.token::text=new.raw_user_meta_data->>'plus_one_token' and i.recipient_email=lower(new.email)
   and i.claimed_at is null and i.cancelled_at is null and i.expires_at>now()
   and public.universe_account_kind(i.inviter_id)='university' returning i.inviter_id into claimed;
  if claimed is null then raise exception 'INVITE_INVALID' using errcode='23514'; end if;
  new.raw_user_meta_data:=new.raw_user_meta_data-'plus_one_token';
  return new;
 elsif allowed then return new;
 end if;
 raise exception 'UNIVERSE_UNIVERSITY_REQUIRED' using errcode='23514';
end;
$$;

create or replace function public.universe_current_member() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',u.id,'email',u.email,'name',left(coalesce(u.raw_user_meta_data->>'full_name',''),60),
  'university',case when public.universe_account_kind(u.id)='university' then d.university_name else 'Acceso por invitación' end,
  'account_kind',public.universe_account_kind(u.id))
 from auth.users u left join public.universe_university_domains d on d.domain=split_part(lower(u.email),'@',2) and d.enabled and exists(select 1 from public.universe_launch_regions r where r.slug=d.launch_region and r.enabled)
 where u.id=auth.uid() and public.universe_account_kind(u.id) is not null;
$$;


-- 202609220018_participation_incentives.sql
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


-- 202609220019_scheduled_launch.sql
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


-- 202609230020_waitlist.sql
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


-- 202609240021_waitlist_sequence.sql
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


-- 202609240022_waitlist_full_sequence.sql
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


-- 202609240023_early_coins.sql
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


-- 202609240024_waitlist_service_grants.sql
-- The mailer calls these with the service key. Supabase normally hands
-- service_role execute on new functions through default privileges, but that
-- is an assumption about the project, not something this schema states. Say it.
grant execute on function public.universe_waitlist_due(integer) to service_role;
grant execute on function public.universe_waitlist_sent(bigint, text) to service_role;
grant execute on function public.universe_waitlist_unsubscribe(uuid) to service_role;


-- 202609250025_analytics.sql
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



-- 202609250026_showcase.sql
-- The showcase: a shop window on every profile. A piece is a link, a note, a
-- story, a picture or clip, or a PDF, and each piece carries its own audience.
-- Who may see a piece is decided here, row by row, so a file behind it can
-- only be opened by somebody the row itself is visible to.
alter table public.universe_profiles
  add column showcase_frame text not null default 'madera'
    check (showcase_frame in ('madera','cristal','neon'));
grant update(showcase_frame) on public.universe_profiles to authenticated;

create table public.universe_showcase (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.universe_profiles(user_id) on delete cascade,
 kind text not null check (kind in ('link','note','story','media','file')),
 title text not null default '' check (char_length(title) <= 120),
 body text not null default '' check (char_length(body) <= 1200),
 url text check (url is null or (url ~ '^https://' and char_length(url) <= 500)),
 media_path text check (media_path is null or media_path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|png|webp|gif|mp4|webm|pdf)$'),
 media_kind text check (media_kind in ('image','video','pdf')),
 audience text not null default 'everyone' check (audience in ('everyone','campus','contacts','chosen','only_me')),
 viewers uuid[] not null default '{}' check (cardinality(viewers) <= 50),
 position integer not null default 0,
 created_at timestamptz not null default now(),
 -- Each kind carries exactly what it needs and nothing of the others.
 check ((kind = 'link') = (url is not null)),
 check ((kind in ('story','media','file')) = (media_path is not null)),
 check ((media_path is null) = (media_kind is null)),
 check (kind <> 'file' or media_kind = 'pdf'),
 check (kind not in ('story','media') or media_kind in ('image','video')),
 check (kind <> 'note' or char_length(btrim(body)) >= 1),
 check (audience <> 'chosen' or cardinality(viewers) >= 1),
 -- The file path names its owner, so storage can trust the path alone.
 check (media_path is null or split_part(media_path, '/', 1) = owner_id::text)
);
create index universe_showcase_owner on public.universe_showcase(owner_id, position, created_at desc);
revoke all on public.universe_showcase from public, anon, authenticated;
alter table public.universe_showcase enable row level security;

-- Who a piece is for. The owner always; then by audience. `campus` reads the
-- two profiles, `contacts` the private threads, `chosen` the list on the row.
create function public.universe_showcase_visible(owner uuid, audience text, viewers uuid[]) returns boolean
language sql stable security definer set search_path='' as $$
 select (select auth.uid()) = owner
  or audience = 'everyone'
  or (audience = 'campus' and exists (
       select 1 from public.universe_profiles a join public.universe_profiles b on a.campus = b.campus
       where a.user_id = owner and b.user_id = (select auth.uid())))
  or (audience = 'contacts' and exists (
       select 1 from public.universe_threads t
       where (t.user_a = owner and t.user_b = (select auth.uid())) or (t.user_b = owner and t.user_a = (select auth.uid()))))
  or (audience = 'chosen' and (select auth.uid()) = any(viewers));
$$;
revoke all on function public.universe_showcase_visible(uuid, text, uuid[]) from public, anon;
grant execute on function public.universe_showcase_visible(uuid, text, uuid[]) to authenticated;

create policy showcase_read on public.universe_showcase for select to authenticated
 using ((select public.universe_is_member()) and public.universe_showcase_visible(owner_id, audience, viewers));
create policy showcase_insert on public.universe_showcase for insert to authenticated
 with check ((select public.universe_is_member()) and owner_id = (select auth.uid()));
create policy showcase_update on public.universe_showcase for update to authenticated
 using ((select public.universe_is_member()) and owner_id = (select auth.uid()))
 with check (owner_id = (select auth.uid()));
create policy showcase_delete on public.universe_showcase for delete to authenticated
 using ((select public.universe_is_member()) and owner_id = (select auth.uid()));
grant select, insert, update, delete on public.universe_showcase to authenticated;

-- Private, like every other bucket here. Reading a file goes through the row
-- that names it: no visible row, no signed link.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('universe-showcase','universe-showcase',false,26214400,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=26214400,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','application/pdf'];
create policy universe_showcase_upload on storage.objects for insert to authenticated
 with check (bucket_id='universe-showcase' and (select public.universe_is_member())
  and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|png|webp|gif|mp4|webm|pdf)$'
  and split_part(name,'/',1)=(select auth.uid())::text);
create policy universe_showcase_view on storage.objects for select to authenticated
 using (bucket_id='universe-showcase' and (select public.universe_is_member())
  and (split_part(name,'/',1)=(select auth.uid())::text
       or exists (select 1 from public.universe_showcase s where s.media_path = name)));
create policy universe_showcase_remove on storage.objects for delete to authenticated
 using (bucket_id='universe-showcase' and (select public.universe_is_member()) and split_part(name,'/',1)=(select auth.uid())::text);


-- 202609260026_waitlist_snapshot.sql
-- Private aggregate for the owner dashboard. It never returns waitlist addresses.
create or replace function public.universe_waitlist_snapshot(p_days integer default 7)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  days integer := least(greatest(coalesce(p_days, 7), 1), 90);
  cutoff timestamptz := now() - make_interval(days => days);
begin
  if not public.universe_backoffice_can('support') then
    raise exception 'BACKOFFICE_ACCESS_REQUIRED' using errcode='42501';
  end if;
  return jsonb_build_object(
    'total', (select count(*) from public.universe_waitlist),
    'active', (select count(*) from public.universe_waitlist where unsubscribed_at is null),
    'new_today', (select count(*) from public.universe_waitlist where created_at >= date_trunc('day', now())),
    'new_last_7_days', (select count(*) from public.universe_waitlist where created_at >= cutoff),
    'last_signup_at', (select max(created_at) from public.universe_waitlist),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('source', source, 'total', total) order by total desc) from (select source, count(*)::integer as total from public.universe_waitlist group by source) grouped), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.universe_waitlist_snapshot(integer) from public, anon;
grant execute on function public.universe_waitlist_snapshot(integer) to authenticated;



-- 202609260027_profile_space.sql
-- The personal space: which blocks a profile shows and in what order, one of a
-- fixed set of backgrounds, and stickers pinned on the cover. The blocks and
-- background are one JSON whose shape the app checks; the column only bounds it.
alter table public.universe_profiles
  add column space jsonb not null default '{}'::jsonb
    check (jsonb_typeof(space) = 'object' and length(space::text) <= 2000);
grant update(space) on public.universe_profiles to authenticated;

-- A sticker is either one that ships with the app or a small transparent webp
-- the owner uploaded, placed on the cover in percentages so it lands in the
-- same spot on every screen.
create table public.universe_stickers (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.universe_profiles(user_id) on delete cascade,
 path text not null check (path ~ '^builtin:[a-z]{2,20}$' or path ~ '^[a-f0-9-]{36}/sticker-[a-f0-9-]{36}\.webp$'),
 x real not null default 50 check (x between 0 and 100),
 y real not null default 50 check (y between 0 and 100),
 scale real not null default 1 check (scale between 0.25 and 3),
 rotation smallint not null default 0 check (rotation between -180 and 180),
 z smallint not null default 0 check (z between 0 and 99),
 created_at timestamptz not null default now(),
 check (path like 'builtin:%' or split_part(path, '/', 1) = owner_id::text)
);
create index universe_stickers_owner on public.universe_stickers(owner_id, z);
revoke all on public.universe_stickers from public, anon, authenticated;
alter table public.universe_stickers enable row level security;
-- Stickers are as public as the avatar they sit next to: every member reads them.
create policy stickers_read on public.universe_stickers for select to authenticated using ((select public.universe_is_member()));
create policy stickers_insert on public.universe_stickers for insert to authenticated with check ((select public.universe_is_member()) and owner_id = (select auth.uid()));
create policy stickers_update on public.universe_stickers for update to authenticated using ((select public.universe_is_member()) and owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy stickers_delete on public.universe_stickers for delete to authenticated using ((select public.universe_is_member()) and owner_id = (select auth.uid()));
grant select, insert, update, delete on public.universe_stickers to authenticated;

-- Twelve is plenty for a cover and keeps a profile from becoming a wall of them.
create function public.universe_sticker_limit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if (select count(*) from public.universe_stickers where owner_id = new.owner_id) >= 12 then
  raise exception 'STICKER_LIMIT' using errcode = '23514';
 end if;
 return new;
end;
$$;
revoke all on function public.universe_sticker_limit() from public, anon, authenticated;
create trigger universe_sticker_limit before insert on public.universe_stickers
for each row execute function public.universe_sticker_limit();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('universe-stickers','universe-stickers',false,524288,array['image/webp'])
on conflict(id) do update set public=false,file_size_limit=524288,allowed_mime_types=array['image/webp'];
create policy universe_stickers_write on storage.objects for insert to authenticated
 with check (bucket_id='universe-stickers' and (select public.universe_is_member())
  and name ~ '^[a-f0-9-]{36}/sticker-[a-f0-9-]{36}\.webp$' and split_part(name,'/',1)=(select auth.uid())::text);
create policy universe_stickers_read on storage.objects for select to authenticated
 using (bucket_id='universe-stickers' and (select public.universe_is_member()));
create policy universe_stickers_remove on storage.objects for delete to authenticated
 using (bucket_id='universe-stickers' and (select public.universe_is_member()) and split_part(name,'/',1)=(select auth.uid())::text);


-- 202609260028_waitlist_blog_source.sql
-- The blog carries the same form as the landing and the roadmap. Its addresses
-- are recorded under their own origin so the backoffice can tell which pages
-- bring people in.
alter table public.universe_waitlist drop constraint if exists universe_waitlist_source_check;
alter table public.universe_waitlist add constraint universe_waitlist_source_check check (source in ('landing','roadmap','blog'));


-- 202609260029_waitlist_hardening.sql
-- Public waitlist hardening.
-- Anonymous visitors call the function below; they never receive INSERT on
-- the table itself. The advisory lock makes the counters consistent when a
-- burst arrives at the same time.
create or replace function public.universe_join_waitlist(
 p_email text,
 p_locale text default 'es',
 p_source text default 'landing'
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
 normalized text := lower(btrim(coalesce(p_email, '')));
 recent_count integer;
 today_count integer;
begin
 if normalized !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or length(normalized) < 6
    or length(normalized) > 254 then
   raise exception 'WAITLIST_INVALID_EMAIL' using errcode = '22023';
 end if;

 if p_locale not in ('es', 'va') then
   raise exception 'WAITLIST_INVALID_LOCALE' using errcode = '22023';
 end if;

 if p_source not in ('landing', 'roadmap', 'blog') then
   raise exception 'WAITLIST_INVALID_SOURCE' using errcode = '22023';
 end if;

 perform pg_catalog.pg_advisory_xact_lock(hashtextextended('entreclases-waitlist', 0));

 -- Keep duplicate requests indistinguishable from new requests.
 if exists (
   select 1 from public.universe_waitlist
   where email = normalized
 ) then
   return jsonb_build_object('status', 'saved');
 end if;

 select count(*)::integer into recent_count
 from public.universe_waitlist
 where created_at >= now() - interval '1 minute';

 if recent_count >= 60 then
   raise exception 'WAITLIST_RATE_LIMIT' using errcode = 'P0001';
 end if;

 select count(*)::integer into today_count
 from public.universe_waitlist
 where created_at >= date_trunc('day', now());

 if today_count >= 1000 then
   raise exception 'WAITLIST_RATE_LIMIT' using errcode = 'P0001';
 end if;

 insert into public.universe_waitlist(email, locale, source)
 values (normalized, p_locale, p_source);

 return jsonb_build_object('status', 'saved');
end;
$$;

drop policy if exists universe_waitlist_join on public.universe_waitlist;
revoke insert on public.universe_waitlist from public, anon, authenticated;
revoke all on function public.universe_join_waitlist(text, text, text) from public, anon, authenticated;
grant execute on function public.universe_join_waitlist(text, text, text) to anon, authenticated;


-- 202609270029_note_study.sql
-- Estudiar con un apunte: resumen, tarjetas y test que la IA prepara una sola vez
-- por PDF y que luego usa todo el que lo abre. La Edge Function note-study es la
-- única que escribe; los miembros solo leen el resultado, nunca el texto extraído.
create table public.universe_note_study (
 note_id uuid primary key references public.universe_notes(id) on delete cascade,
 status text not null default 'working' check (status in ('working','ready','unreadable','too_long','failed')),
 content jsonb check (content is null or (jsonb_typeof(content) = 'object' and length(content::text) <= 60000)),
 language text check (language is null or language in ('es','va','en','other')),
 model text check (model is null or char_length(model) <= 60),
 pages integer check (pages is null or pages between 0 and 2000),
 -- Lo necesita «Pregunta a tus apuntes» y no sale nunca de la base de datos hacia el navegador.
 source_text text check (source_text is null or char_length(source_text) <= 400000),
 requested_by uuid references public.universe_profiles(user_id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
revoke all on public.universe_note_study from public, anon, authenticated;
alter table public.universe_note_study enable row level security;
create policy note_study_read on public.universe_note_study for select to authenticated using ((select public.universe_is_member()));
-- Sin source_text ni requested_by: quién lo pidió y el texto completo no se publican.
grant select (note_id, status, content, language, model, pages, updated_at) on public.universe_note_study to authenticated;

-- Cuántas veces ha usado cada persona la IA hoy, hora de València. Solo lo tocan las funciones.
create table public.universe_ai_usage (
 user_id uuid not null references public.universe_profiles(user_id) on delete cascade,
 day date not null,
 kind text not null check (kind in ('study','ask')),
 uses integer not null default 0 check (uses >= 0),
 primary key (user_id, day, kind)
);
revoke all on public.universe_ai_usage from public, anon, authenticated;
alter table public.universe_ai_usage enable row level security;

create function public.universe_ai_today() returns date language sql stable set search_path = '' as $$
 select (now() at time zone 'Europe/Madrid')::date;
$$;
revoke all on function public.universe_ai_today() from public, anon, authenticated;

-- Suma un uso si queda cupo. Los límites viven aquí y no en el navegador.
create function public.universe_ai_spend(p_kind text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
 u uuid := auth.uid(); today date := public.universe_ai_today();
 mine integer; everyone integer;
 personal constant jsonb := '{"study":6,"ask":30}';
 overall constant jsonb := '{"study":400,"ask":3000}';
begin
 select coalesce(sum(uses),0) into everyone from public.universe_ai_usage where day = today and kind = p_kind;
 if everyone >= (overall->>p_kind)::integer then return false; end if;
 insert into public.universe_ai_usage(user_id, day, kind, uses) values (u, today, p_kind, 0) on conflict do nothing;
 select uses into mine from public.universe_ai_usage where user_id = u and day = today and kind = p_kind for update;
 if mine >= (personal->>p_kind)::integer then return false; end if;
 update public.universe_ai_usage set uses = uses + 1 where user_id = u and day = today and kind = p_kind;
 return true;
end;
$$;
revoke all on function public.universe_ai_spend(text) from public, anon, authenticated;

-- La llama la Edge Function con la sesión de quien pide. Si el estudio ya existe o
-- alguien lo está preparando, no gasta cupo. Un intento que lleva más de tres
-- minutos «preparándose» se da por perdido y se puede repetir.
create function public.universe_note_study_request(p_note uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n public.universe_notes; s public.universe_note_study;
begin
 if not public.universe_is_member() then raise exception 'STUDY_NOT_MEMBER'; end if;
 select * into n from public.universe_notes where id = p_note;
 if n.id is null then raise exception 'STUDY_NOT_FOUND'; end if;
 select * into s from public.universe_note_study where note_id = p_note for update;
 if s.note_id is not null and (s.status in ('ready','unreadable','too_long') or (s.status = 'working' and s.updated_at > now() - interval '3 minutes')) then
  return jsonb_build_object('status', s.status);
 end if;
 if not public.universe_ai_spend('study') then raise exception 'STUDY_DAILY_LIMIT'; end if;
 insert into public.universe_note_study(note_id, status, requested_by) values (p_note, 'working', auth.uid())
 on conflict (note_id) do update set status = 'working', content = null, requested_by = auth.uid(), updated_at = now();
 return jsonb_build_object('status', 'claimed', 'file_path', n.file_path, 'title', n.title, 'subject', n.subject);
end;
$$;
revoke all on function public.universe_note_study_request(uuid) from public, anon;
grant execute on function public.universe_note_study_request(uuid) to authenticated;

-- Una pregunta sobre un apunte ya preparado. Gasta cupo de preguntas.
create function public.universe_note_ask_request(p_note uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
 if not public.universe_is_member() then raise exception 'STUDY_NOT_MEMBER'; end if;
 if not exists (select 1 from public.universe_note_study where note_id = p_note and status = 'ready') then raise exception 'STUDY_NOT_READY'; end if;
 if not public.universe_ai_spend('ask') then raise exception 'STUDY_DAILY_LIMIT'; end if;
 return true;
end;
$$;
revoke all on function public.universe_note_ask_request(uuid) from public, anon;
grant execute on function public.universe_note_ask_request(uuid) to authenticated;

-- Guarda el resultado. Solo con la clave de servicio.
create function public.universe_note_study_save(p_note uuid, p_status text, p_content jsonb, p_language text, p_model text, p_pages integer, p_source text) returns void
language sql security definer set search_path = '' as $$
 update public.universe_note_study
 set status = p_status, content = p_content, language = p_language, model = p_model, pages = p_pages,
     source_text = p_source, updated_at = now()
 where note_id = p_note;
$$;
revoke all on function public.universe_note_study_save(uuid, text, jsonb, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.universe_note_study_save(uuid, text, jsonb, text, text, integer, text) to service_role;

-- El texto para responder preguntas. Solo con la clave de servicio.
create function public.universe_note_study_source(p_note uuid) returns text
language sql stable security definer set search_path = '' as $$
 select source_text from public.universe_note_study where note_id = p_note and status = 'ready';
$$;
revoke all on function public.universe_note_study_source(uuid) from public, anon, authenticated;
grant execute on function public.universe_note_study_source(uuid) to service_role;


-- 202609270030_meet_games_gate.sql
-- Los juegos para conocer gente (¿Me lío? y La cita) necesitan masa: con pocas
-- personas en el campus se adivina quién hay detrás y la baraja sale vacía. Se
-- abren cuando el campus de quien pregunta llega al mínimo. Solo se responde sí o
-- no: el recuento no sale de la base de datos. El servidor de esos juegos debe
-- consultar esta misma función antes de aceptar una jugada.
create function public.universe_meet_games_open() returns boolean
language sql stable security definer set search_path = '' as $$
 select public.universe_is_member() and (
  select count(*) >= 150 from public.universe_profiles p
  where p.campus = (select campus from public.universe_profiles where user_id = auth.uid())
 );
$$;
revoke all on function public.universe_meet_games_open() from public, anon;
grant execute on function public.universe_meet_games_open() to authenticated;


-- 202609270031_play_v2.sql
-- Server for the redesigned games (docs/juegos/08-servidor.md). Replaces, does not
-- extend, universe_play from 202609190007. Serves Dos verdades y una trola, El jurado
-- del campus and Hay hueco. The other four raise 42883, which the client already
-- shows as "not active yet, play the demo".
-- Nothing here is readable by clients: every row leaves only through the projections
-- of universe_play_v2, which filter by audience and hide what must stay hidden.

create table if not exists public.universe_game_items (
  id uuid primary key default gen_random_uuid(),
  game text not null check(game in ('crush','questions','debate','truth','hangout','jury','blind')),
  kind text not null check(kind in ('round','group_round','case','hangout')),
  owner uuid not null references public.universe_profiles(user_id) on delete cascade,
  audience_kind text not null check(audience_kind in ('campus','site','degree','course','group','contacts','person')),
  audience_ref uuid,
  -- The owner's campus, degree and year when it was created: an audience never widens later.
  audience_campus text not null default '', audience_degree text not null default '', audience_year smallint,
  anon boolean not null default false,
  state jsonb not null default '{}',
  starts_at timestamptz not null default now(), ends_at timestamptz not null,
  -- Set by universe_game_sweep once the end has been processed. Time itself is always read from ends_at.
  settled_at timestamptz,
  withdrawn boolean not null default false,
  created_at timestamptz not null default now(),
  check((audience_kind in ('group','person'))=(audience_ref is not null)),
  check(ends_at>=starts_at)
);
create index if not exists universe_game_items_game on public.universe_game_items(game,kind,ends_at desc);
create index if not exists universe_game_items_owner on public.universe_game_items(owner,game,kind);
create index if not exists universe_game_items_open on public.universe_game_items(ends_at) where settled_at is null;

-- One row per thing a person does inside an item: a guess, a vote, an argument, a seat, a message.
create table if not exists public.universe_game_moves (
  id uuid primary key default gen_random_uuid(),
  item uuid not null references public.universe_game_items(id) on delete cascade,
  actor uuid not null references public.universe_profiles(user_id) on delete cascade,
  kind text not null check(kind in ('guess','vote','argument','support','seat','message','tap','want','dismiss')),
  choice smallint, ref uuid, body text not null default '' check(char_length(body)<=600),
  data jsonb not null default '{}', created_at timestamptz not null default now()
);
create unique index if not exists universe_game_moves_once on public.universe_game_moves(item,actor,kind) where kind in ('guess','vote','seat','want','dismiss');
create unique index if not exists universe_game_moves_pair on public.universe_game_moves(item,actor,kind,ref) where kind in ('support','tap');
create index if not exists universe_game_moves_item on public.universe_game_moves(item,kind,created_at,id);
create index if not exists universe_game_moves_actor on public.universe_game_moves(actor,kind,created_at);

-- One block list for every game. Blocking an anonymous author stores the account, never shows it.
create table if not exists public.universe_game_blocks (
  blocker uuid not null references public.universe_profiles(user_id) on delete cascade,
  blocked uuid not null references public.universe_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker,blocked), check(blocker<>blocked)
);
create index if not exists universe_game_blocks_blocked on public.universe_game_blocks(blocked);
create table if not exists public.universe_game_reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references public.universe_profiles(user_id) on delete cascade,
  accused uuid references public.universe_profiles(user_id) on delete set null,
  game text not null, item uuid, move uuid, body text not null default '', reason text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.universe_game_activity (
  actor uuid not null references public.universe_profiles(user_id) on delete cascade,
  game text not null, command text not null, created_at timestamptz not null default now()
);
create index if not exists universe_game_activity_actor on public.universe_game_activity(actor,created_at);
alter table public.universe_game_items enable row level security;
alter table public.universe_game_moves enable row level security;
alter table public.universe_game_blocks enable row level security;
alter table public.universe_game_reports enable row level security;
alter table public.universe_game_activity enable row level security;
revoke all on public.universe_game_items,public.universe_game_moves,public.universe_game_blocks,public.universe_game_reports,public.universe_game_activity from public,anon,authenticated;

-- ---- Small helpers. None is callable by clients. ----

create or replace function public.universe_game_tr(p_va boolean,p_es text,p_vl text) returns text
language sql immutable set search_path='' as $$ select case when p_va then p_vl else p_es end $$;
create or replace function public.universe_game_fail(p_va boolean,p_es text,p_vl text) returns void
language plpgsql set search_path='' as $$ begin raise exception '%', case when p_va then p_vl else p_es end; end $$;
create or replace function public.universe_game_uuid(p text) returns uuid
language plpgsql immutable set search_path='' as $$ begin return p::uuid; exception when others then return null; end $$;
create or replace function public.universe_game_num(p text) returns numeric
language plpgsql immutable set search_path='' as $$ begin return p::numeric; exception when others then return null; end $$;
create or replace function public.universe_game_ts(p text) returns timestamptz
language plpgsql stable set search_path='' as $$ begin return p::timestamptz; exception when others then return null; end $$;
create or replace function public.universe_game_text(p text) returns text
language sql immutable set search_path='' as $$ select regexp_replace(btrim(coalesce(p,'')),'\s+',' ','g') $$;
create or replace function public.universe_game_iso(p timestamptz) returns text
language sql stable set search_path='' as $$ select to_char(p at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;

create or replace function public.universe_game_blocked(p_a uuid,p_b uuid) returns boolean
language sql stable set search_path='' as $$
  select exists(select 1 from public.universe_game_blocks where (blocker=p_a and blocked=p_b) or (blocker=p_b and blocked=p_a));
$$;

-- Implicit contacts, as in lib/community/games/world.ts: an open private conversation, or a small group in common.
create or replace function public.universe_game_contact(p_a uuid,p_b uuid) returns boolean
language sql stable set search_path='' as $$
  select exists(select 1 from public.universe_threads where user_a=least(p_a,p_b) and user_b=greatest(p_a,p_b))
    or exists(select 1 from public.universe_group_members x join public.universe_group_members y on y.group_id=x.group_id and y.user_id=p_b
      where x.user_id=p_a and (select count(*) from public.universe_group_members z where z.group_id=x.group_id)<=12);
$$;

-- Whether an audience, defined from its owner's point of view, reaches this viewer.
create or replace function public.universe_game_reaches(p_viewer uuid,p_owner uuid,p_kind text,p_ref uuid,p_campus text,p_degree text,p_year smallint) returns boolean
language sql stable set search_path='' as $$
  select case when p_viewer=p_owner then true when public.universe_game_blocked(p_viewer,p_owner) then false else coalesce((
    select case p_kind
      when 'campus' then true
      when 'site' then p.campus=p_campus
      when 'degree' then lower(btrim(p.degree))=lower(btrim(p_degree))
      when 'course' then lower(btrim(p.degree))=lower(btrim(p_degree)) and p.year=p_year
      when 'group' then exists(select 1 from public.universe_group_members m where m.group_id=p_ref and m.user_id=p_viewer)
      when 'contacts' then public.universe_game_contact(p_owner,p_viewer)
      when 'person' then p_viewer=p_ref
      else false end
    from public.universe_profiles p where p.user_id=p_viewer),false) end;
$$;
create or replace function public.universe_game_sees(p_viewer uuid,p_item public.universe_game_items) returns boolean
language sql stable set search_path='' as $$
  select not p_item.withdrawn and public.universe_game_reaches(p_viewer,p_item.owner,p_item.audience_kind,p_item.audience_ref,p_item.audience_campus,p_item.audience_degree,p_item.audience_year);
$$;
-- People an audience of mine would reach, not counting me. Recomputed at creation for the anonymous minimum.
create or replace function public.universe_game_reach(p_owner uuid,p_kind text,p_ref uuid) returns integer
language sql stable set search_path='' as $$
  select count(*)::integer from public.universe_profiles p, public.universe_profiles me
  where me.user_id=p_owner and p.user_id<>p_owner
    and public.universe_game_reaches(p.user_id,p_owner,p_kind,p_ref,me.campus,me.degree,me.year);
$$;
create or replace function public.universe_game_audience(p_item public.universe_game_items) returns jsonb
language sql immutable set search_path='' as $$ select jsonb_strip_nulls(jsonb_build_object('kind',p_item.audience_kind,'ref',p_item.audience_ref)) $$;
create or replace function public.universe_game_group_name(p_id uuid) returns text
language sql stable set search_path='' as $$ select name from public.universe_groups where id=p_id $$;

-- Reads the audience a person picked and checks it is theirs to use.
create or replace function public.universe_game_pick_audience(p_user uuid,p_va boolean,p_kind text,p_ref text,p_allowed text[]) returns uuid
language plpgsql stable set search_path='' as $$
declare v_ref uuid:=public.universe_game_uuid(p_ref);
begin
  if p_kind is null or not p_kind=any(p_allowed) then perform public.universe_game_fail(p_va,'Elige para quién es.','Tria per a qui és.'); end if;
  if p_kind='group' then
    if v_ref is null or not exists(select 1 from public.universe_group_members where group_id=v_ref and user_id=p_user) then perform public.universe_game_fail(p_va,'Elige un grupo del que formes parte.','Tria un grup del qual formes part.'); end if;
    return v_ref;
  elsif p_kind='person' then
    if v_ref is null or v_ref=p_user or not exists(select 1 from public.universe_profiles where user_id=v_ref) or public.universe_game_blocked(p_user,v_ref) then perform public.universe_game_fail(p_va,'Elige a una persona.','Tria una persona.'); end if;
    return v_ref;
  end if;
  return null;
end; $$;

-- ================= Dos verdades y una trola =================

create or replace function public.universe_game_truth_round(p_round public.universe_game_items,p_user uuid,p_va boolean) returns jsonb
language plpgsql stable set search_path='' as $$
declare
  v_lie integer:=(p_round.state->>'lie')::integer; v_mine smallint; v_reveal boolean; v_total integer; v_right integer;
  v_cards jsonb:='[]'; v_label text; i integer;
begin
  select choice into v_mine from public.universe_game_moves where item=p_round.id and actor=p_user and kind='guess';
  -- The lie leaves the database only for its author and for whoever already guessed.
  v_reveal:=p_round.owner=p_user or v_mine is not null;
  select count(*),count(*) filter(where choice=v_lie) into v_total,v_right from public.universe_game_moves where item=p_round.id and kind='guess';
  for i in 0..2 loop
    if v_reveal then
      v_cards:=v_cards||jsonb_build_array(jsonb_build_object('text',p_round.state->'cards'->>i,'lie',i=v_lie,'picked',coalesce(v_mine=i,false),
        'share',case when v_total>0 then round((select count(*) from public.universe_game_moves where item=p_round.id and kind='guess' and choice=i)::numeric/v_total,4) else 0 end));
    else v_cards:=v_cards||jsonb_build_array(jsonb_build_object('text',p_round.state->'cards'->>i)); end if;
  end loop;
  v_label:=case p_round.audience_kind
    when 'campus' then public.universe_game_tr(p_va,'Todo el campus','Tot el campus')
    when 'site' then p_round.audience_campus
    when 'degree' then p_round.audience_degree
    when 'course' then p_round.audience_degree||' · '||p_round.audience_year||'º'
    when 'contacts' then public.universe_game_tr(p_va,'Contactos','Contactes')
    when 'group' then coalesce(public.universe_game_group_name(p_round.audience_ref),public.universe_game_tr(p_va,'Un grupo','Un grup'))
    else case when p_round.audience_ref=p_user then public.universe_game_tr(p_va,'Reto directo','Repte directe')
      else coalesce((select name from public.universe_profiles where user_id=p_round.audience_ref),public.universe_game_tr(p_va,'Una persona','Una persona')) end end;
  return jsonb_strip_nulls(jsonb_build_object('id',p_round.id,'owner',p_round.owner,
    'owner_name',(select name from public.universe_profiles where user_id=p_round.owner),'mine',p_round.owner=p_user,
    'audience',public.universe_game_audience(p_round),'anon',false,'created_at',public.universe_game_iso(p_round.created_at),'expires',public.universe_game_iso(p_round.ends_at),
    'cards',v_cards,'audienceLabel',v_label,'played',v_mine is not null,'correct',case when v_mine is not null then v_mine=v_lie end,
    'playedCount',v_total,'deceived',case when v_reveal then v_total-v_right else 0 end,'groupRound',p_round.state->>'group_round'));
end; $$;

create or replace function public.universe_game_truth_view(p_user uuid,p_va boolean) returns jsonb
language plpgsql stable set search_path='' as $$
declare v_streak integer:=0; v_ok boolean; v_groups jsonb;
begin
  for v_ok in select m.choice=(i.state->>'lie')::integer from public.universe_game_moves m join public.universe_game_items i on i.id=m.item
    where m.actor=p_user and m.kind='guess' order by m.created_at desc,m.id desc
  loop exit when not v_ok; v_streak:=v_streak+1; end loop;
  select coalesce(jsonb_agg(v order by c desc),'[]') into v_groups from (
    select g.created_at c,jsonb_build_object('id',g.id,'group',g.audience_ref,'groupName',coalesce(public.universe_game_group_name(g.audience_ref),''),
      'active',g.ends_at>now(),'finished',g.ends_at<=now(),'expires',public.universe_game_iso(g.ends_at),
      'members',(select count(*) from public.universe_group_members where group_id=g.audience_ref),
      'posted',(select count(*) from public.universe_game_items r where r.game='truth' and r.kind='round' and not r.withdrawn and r.state->>'group_round'=g.id::text),
      'myRound',(select r.id from public.universe_game_items r where r.game='truth' and r.kind='round' and r.owner=p_user and r.state->>'group_round'=g.id::text limit 1),
      'summary',case when g.ends_at>now() then null else jsonb_build_object(
        'mostDeceiving',coalesce((select p.name from public.universe_game_items r join public.universe_game_moves m on m.item=r.id and m.kind='guess' and m.choice<>(r.state->>'lie')::integer
          join public.universe_profiles p on p.user_id=r.owner where r.game='truth' and r.state->>'group_round'=g.id::text group by p.user_id,p.name order by count(*) desc,p.name limit 1),''),
        'mostAccurate',coalesce((select p.name from public.universe_game_items r join public.universe_game_moves m on m.item=r.id and m.kind='guess' and m.choice=(r.state->>'lie')::integer
          join public.universe_profiles p on p.user_id=m.actor where r.game='truth' and r.state->>'group_round'=g.id::text group by p.user_id,p.name order by count(*) desc,p.name limit 1),'')) end) v
    from public.universe_game_items g
    where g.game='truth' and g.kind='group_round' and exists(select 1 from public.universe_group_members where group_id=g.audience_ref and user_id=p_user)
    order by g.created_at desc limit 10) q;
  return jsonb_build_object('streak',v_streak,
    'deck',(select coalesce(jsonb_agg(public.universe_game_truth_round(r,p_user,p_va) order by r.created_at desc,r.id),'[]') from public.universe_game_items r where r.id in (
      select x.id from public.universe_game_items x where x.game='truth' and x.kind='round' and x.owner<>p_user and x.ends_at>now() and public.universe_game_sees(p_user,x)
      order by x.created_at desc limit 50)),
    'mine',(select coalesce(jsonb_agg(public.universe_game_truth_round(r,p_user,p_va) order by r.created_at desc,r.id),'[]') from public.universe_game_items r where r.id in (
      select x.id from public.universe_game_items x where x.game='truth' and x.kind='round' and x.owner=p_user and not x.withdrawn order by x.created_at desc limit 30)),
    'groups',v_groups,'audienceKinds',jsonb_build_array('campus','degree','course','group','contacts','person'));
end; $$;

create or replace function public.universe_game_truth(p_user uuid,p_va boolean,p_command text,p_input jsonb) returns void
language plpgsql set search_path='' as $$
declare
  v_me public.universe_profiles; r public.universe_game_items; v_cards jsonb; v_kind text; v_ref uuid; v_lie integer; v_ends timestamptz:=now()+interval '7 days';
  v_group uuid; v_guess jsonb;
begin
  select * into v_me from public.universe_profiles where user_id=p_user;
  if p_command='create' then
    v_cards:=p_input->'cards';
    if jsonb_typeof(v_cards) is distinct from 'array' or jsonb_array_length(v_cards)<>3 then perform public.universe_game_fail(p_va,'Escribe tres frases.','Escriu tres frases.'); end if;
    if exists(select 1 from jsonb_array_elements(v_cards) c where jsonb_typeof(c->'text') is distinct from 'string' or char_length(btrim(c->>'text')) not between 1 and 180) then
      perform public.universe_game_fail(p_va,'Cada frase necesita texto, hasta 180 caracteres.','Cada frase necessita text, fins a 180 caràcters.'); end if;
    if (select count(distinct lower(btrim(c->>'text'))) from jsonb_array_elements(v_cards) c)<>3 then perform public.universe_game_fail(p_va,'Las tres frases deben ser distintas.','Les tres frases han de ser diferents.'); end if;
    if (select count(*) from jsonb_array_elements(v_cards) c where c->'lie'='true'::jsonb)<>1 then perform public.universe_game_fail(p_va,'Da la vuelta a la carta que es mentira.','Gira la carta que és mentida.'); end if;
    select n-1 into v_lie from jsonb_array_elements(v_cards) with ordinality c(v,n) where v->'lie'='true'::jsonb;
    v_kind:=p_input->'audience'->>'kind';
    v_ref:=public.universe_game_pick_audience(p_user,p_va,v_kind,p_input->'audience'->>'ref',array['campus','degree','course','group','contacts','person']);
    if exists(select 1 from public.universe_game_items where game='truth' and kind='round' and owner=p_user and not withdrawn and ends_at>now() and audience_kind=v_kind and audience_ref is not distinct from v_ref) then
      perform public.universe_game_fail(p_va,'Ya tienes una ronda activa para ese destinatario.','Ja tens una ronda activa per a eixe destinatari.'); end if;
    if v_kind='group' then
      select id,ends_at into v_group,v_ends from public.universe_game_items where game='truth' and kind='group_round' and audience_ref=v_ref and ends_at>now() order by created_at desc limit 1;
      if v_group is null then v_ends:=now()+interval '7 days'; end if;
    end if;
    insert into public.universe_game_items(game,kind,owner,audience_kind,audience_ref,audience_campus,audience_degree,audience_year,state,ends_at)
      values('truth','round',p_user,v_kind,v_ref,v_me.campus,v_me.degree,v_me.year,
        jsonb_strip_nulls(jsonb_build_object('cards',(select jsonb_agg(btrim(c->>'text') order by n) from jsonb_array_elements(v_cards) with ordinality x(c,n)),'lie',v_lie,'group_round',v_group)),v_ends);
  elsif p_command='play' then
    select * into r from public.universe_game_items where id=public.universe_game_uuid(p_input->>'round') and game='truth' and kind='round';
    if r.id is null or not public.universe_game_sees(p_user,r) then perform public.universe_game_fail(p_va,'Esa ronda ya no existe.','Eixa ronda ja no existix.'); end if;
    if r.owner=p_user then perform public.universe_game_fail(p_va,'No puedes jugar tu propia ronda.','No pots jugar la teua pròpia ronda.'); end if;
    if r.ends_at<=now() then perform public.universe_game_fail(p_va,'Esta ronda ya ha terminado.','Esta ronda ja ha acabat.'); end if;
    if exists(select 1 from public.universe_game_moves where item=r.id and actor=p_user and kind='guess') then perform public.universe_game_fail(p_va,'Ya has jugado esta ronda.','Ja has jugat esta ronda.'); end if;
    v_guess:=p_input->'guess';
    if jsonb_typeof(v_guess) is distinct from 'number' or v_guess::text not in ('0','1','2') then perform public.universe_game_fail(p_va,'Toca una de las tres cartas.','Toca una de les tres cartes.'); end if;
    insert into public.universe_game_moves(item,actor,kind,choice) values(r.id,p_user,'guess',v_guess::text::smallint);
  elsif p_command='startGroupRound' then
    v_ref:=public.universe_game_uuid(p_input->>'group');
    if v_ref is null or not exists(select 1 from public.universe_group_members where group_id=v_ref and user_id=p_user) then perform public.universe_game_fail(p_va,'Elige un grupo del que formes parte.','Tria un grup del qual formes part.'); end if;
    if exists(select 1 from public.universe_game_items where game='truth' and kind='group_round' and audience_ref=v_ref and ends_at>now()) then perform public.universe_game_fail(p_va,'Este grupo ya tiene una ronda en marcha.','Este grup ja té una ronda en marxa.'); end if;
    insert into public.universe_game_items(game,kind,owner,audience_kind,audience_ref,ends_at) values('truth','group_round',p_user,'group',v_ref,now()+interval '3 days');
  else perform public.universe_game_fail(p_va,'Acción desconocida.','Acció desconeguda.'); end if;
end; $$;

-- ================= El jurado del campus =================

create or replace function public.universe_game_jury_argument(p_case public.universe_game_items,p_move public.universe_game_moves,p_user uuid,p_va boolean,p_top boolean) returns jsonb
language sql stable set search_path='' as $$
  -- An anonymous author may argue in their own case, but only as "whoever opened it".
  select jsonb_build_object('id',p_move.id,'side',case when p_move.choice=0 then 'a' else 'b' end,
    'authorId',case when p_case.anon and p_move.actor=p_case.owner then '' else p_move.actor::text end,
    'authorName',case when p_case.anon and p_move.actor=p_case.owner then public.universe_game_tr(p_va,'Quien abrió el caso','Qui ha obert el cas')
      else (select name from public.universe_profiles where user_id=p_move.actor) end,
    'text',p_move.body,'supports',(select count(*) from public.universe_game_moves s where s.item=p_case.id and s.kind='support' and s.ref=p_move.id),
    'supportedByMe',exists(select 1 from public.universe_game_moves s where s.item=p_case.id and s.kind='support' and s.ref=p_move.id and s.actor=p_user),
    'mine',p_move.actor=p_user,'top',p_top);
$$;

create or replace function public.universe_game_jury_case(p_case public.universe_game_items,p_user uuid,p_va boolean) returns jsonb
language plpgsql stable set search_path='' as $$
declare
  v_me public.universe_profiles; v_closed boolean:=p_case.ends_at<=now(); v_vote smallint; v_switched boolean:=false; v_revealed boolean;
  v_a integer:=0; v_b integer:=0; v_sa integer:=0; v_sb integer:=0; v_da integer:=0; v_db integer:=0; v_ca integer:=0; v_cb integer:=0;
  v_best_a public.universe_game_moves; v_best_b public.universe_game_moves; v_args_a jsonb:='[]'; v_args_b jsonb:='[]'; v_verdict jsonb; v_share_a numeric:=0; v_share_b numeric:=0;
  v_weekly boolean:=coalesce((p_case.state->>'weekly')::boolean,false);
begin
  select * into v_me from public.universe_profiles where user_id=p_user;
  select choice,coalesce((data->>'switched')::boolean,false) into v_vote,v_switched from public.universe_game_moves where item=p_case.id and actor=p_user and kind='vote';
  -- Blind voting: no tally and no argument leaves the database before my vote, or before the case closes.
  v_revealed:=v_closed or v_vote is not null;
  if v_revealed then
    select count(*) filter(where m.choice=0),count(*) filter(where m.choice=1),
      count(*) filter(where m.choice=0 and (m.data->>'switched')::boolean),count(*) filter(where m.choice=1 and (m.data->>'switched')::boolean),
      count(*) filter(where m.choice=0 and lower(btrim(p.degree))=lower(btrim(v_me.degree))),count(*) filter(where m.choice=1 and lower(btrim(p.degree))=lower(btrim(v_me.degree))),
      count(*) filter(where m.choice=0 and lower(btrim(p.degree))=lower(btrim(v_me.degree)) and p.year=v_me.year),count(*) filter(where m.choice=1 and lower(btrim(p.degree))=lower(btrim(v_me.degree)) and p.year=v_me.year)
      into v_a,v_b,v_sa,v_sb,v_da,v_db,v_ca,v_cb
      from public.universe_game_moves m join public.universe_profiles p on p.user_id=m.actor where m.item=p_case.id and m.kind='vote';
    if v_a+v_b>0 then v_share_a:=round(v_a::numeric/(v_a+v_b),4); v_share_b:=round(v_b::numeric/(v_a+v_b),4); end if;
    select m.* into v_best_a from public.universe_game_moves m where m.item=p_case.id and m.kind='argument' and m.choice=0 and (m.actor=p_user or not public.universe_game_blocked(p_user,m.actor))
      order by (select count(*) from public.universe_game_moves s where s.item=m.item and s.kind='support' and s.ref=m.id) desc,m.created_at,m.id limit 1;
    select m.* into v_best_b from public.universe_game_moves m where m.item=p_case.id and m.kind='argument' and m.choice=1 and (m.actor=p_user or not public.universe_game_blocked(p_user,m.actor))
      order by (select count(*) from public.universe_game_moves s where s.item=m.item and s.kind='support' and s.ref=m.id) desc,m.created_at,m.id limit 1;
    select coalesce(jsonb_agg(public.universe_game_jury_argument(p_case,m,p_user,p_va,m.id=v_best_a.id) order by m.created_at,m.id) filter(where m.choice=0),'[]'),
      coalesce(jsonb_agg(public.universe_game_jury_argument(p_case,m,p_user,p_va,m.id=v_best_b.id) order by m.created_at,m.id) filter(where m.choice=1),'[]')
      into v_args_a,v_args_b
      from public.universe_game_moves m where m.item=p_case.id and m.kind='argument' and (m.actor=p_user or not public.universe_game_blocked(p_user,m.actor));
  end if;
  if v_closed then
    v_verdict:=jsonb_build_object('result',case when v_a+v_b=0 or v_share_a between 0.45 and 0.55 then 'split' when v_share_a>v_share_b then 'a' else 'b' end,
      'shareA',v_share_a,'shareB',v_share_b,'total',v_a+v_b,'switched',v_sa+v_sb,'switchedToA',v_sa,'switchedToB',v_sb,
      'bestArgumentA',case when v_best_a.id is null then null else public.universe_game_jury_argument(p_case,v_best_a,p_user,p_va,true) end,
      'bestArgumentB',case when v_best_b.id is null then null else public.universe_game_jury_argument(p_case,v_best_b,p_user,p_va,true) end);
  end if;
  return jsonb_build_object('id',p_case.id,'weekly',v_weekly,'mine',p_case.owner=p_user,'anon',p_case.anon,
    -- Requirement 2: an anonymous author never leaves the database, not even in a field the screen ignores.
    'ownerId',case when p_case.anon or v_weekly then '' else p_case.owner::text end,
    'ownerName',case
      when v_weekly then public.universe_game_tr(p_va,'El equipo de Campus','L''equip del campus')
      when p_case.anon then case p_case.audience_kind
        when 'degree' then public.universe_game_tr(p_va,'Alguien de tu carrera pregunta','Algú de la teua carrera pregunta')
        when 'course' then public.universe_game_tr(p_va,'Alguien de tu curso pregunta','Algú del teu curs pregunta')
        when 'group' then public.universe_game_tr(p_va,'Alguien de tu grupo pregunta','Algú del teu grup pregunta')
        else public.universe_game_tr(p_va,'Alguien del campus pregunta','Algú del campus pregunta') end
      else (select name from public.universe_profiles where user_id=p_case.owner) end,
    'audienceLabel',case p_case.audience_kind
      when 'degree' then p_case.audience_degree
      when 'course' then p_case.audience_degree||' · '||p_case.audience_year||'º'
      when 'group' then coalesce(public.universe_game_group_name(p_case.audience_ref),public.universe_game_tr(p_va,'Un grupo','Un grup'))
      else public.universe_game_tr(p_va,'Todo el campus','Tot el campus') end,
    'dilemma',p_case.state->>'dilemma','stanceA',p_case.state->>'stanceA','stanceB',p_case.state->>'stanceB',
    'createdAt',public.universe_game_iso(p_case.created_at),'expires',public.universe_game_iso(p_case.ends_at),
    'minutesLeft',greatest(0,round(extract(epoch from p_case.ends_at-now())/60))::integer,
    'status',case when v_closed then 'closed' else 'open' end,
    'myVote',case v_vote when 0 then 'a' when 1 then 'b' end,
    'canSwitch',not v_closed and v_vote is not null and not v_switched,'switched',v_switched,
    'totalVotes',v_a+v_b,'shareA',v_share_a,'shareB',v_share_b,
    'breakdownDegree',case when v_da+v_db>=8 then jsonb_build_object('label',v_me.degree,'shareA',round(v_da::numeric/(v_da+v_db),4),'shareB',round(v_db::numeric/(v_da+v_db),4),'total',v_da+v_db) end,
    'breakdownCourse',case when v_ca+v_cb>=8 then jsonb_build_object('label',v_me.degree||' · '||v_me.year||'º','shareA',round(v_ca::numeric/(v_ca+v_cb),4),'shareB',round(v_cb::numeric/(v_ca+v_cb),4),'total',v_ca+v_cb) end,
    'argumentsA',v_args_a,'argumentsB',v_args_b,'verdict',v_verdict,'canDemoVote',false);
end; $$;

create or replace function public.universe_game_jury_view(p_user uuid,p_va boolean) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object(
    'weekly',(select public.universe_game_jury_case(c,p_user,p_va) from public.universe_game_items c
      where c.game='jury' and c.kind='case' and coalesce((c.state->>'weekly')::boolean,false) and c.ends_at>now() and public.universe_game_sees(p_user,c) order by c.created_at desc limit 1),
    'deck',(select coalesce(jsonb_agg(public.universe_game_jury_case(c,p_user,p_va) order by c.created_at desc,c.id),'[]') from public.universe_game_items c where c.id in (
      select x.id from public.universe_game_items x where x.game='jury' and x.kind='case' and not coalesce((x.state->>'weekly')::boolean,false) and x.owner<>p_user
        and x.ends_at>now()-interval '7 days' and public.universe_game_sees(p_user,x) order by x.created_at desc limit 40)),
    'mine',(select coalesce(jsonb_agg(public.universe_game_jury_case(c,p_user,p_va) order by c.created_at desc,c.id),'[]') from public.universe_game_items c where c.id in (
      select x.id from public.universe_game_items x where x.game='jury' and x.kind='case' and x.owner=p_user and not x.withdrawn order by x.created_at desc limit 20)),
    'openMineCount',o.n,'canCreate',o.n<2)
  from (select count(*)::integer n from public.universe_game_items where game='jury' and kind='case' and owner=p_user and not withdrawn and ends_at>now()) o;
$$;

create or replace function public.universe_game_jury(p_user uuid,p_va boolean,p_command text,p_input jsonb) returns void
language plpgsql set search_path='' as $$
declare
  v_me public.universe_profiles; c public.universe_game_items; v_vote public.universe_game_moves; v_arg public.universe_game_moves;
  v_dilemma text; v_a text; v_b text; v_kind text; v_ref uuid; v_choice smallint; v_text text; v_anon boolean;
begin
  select * into v_me from public.universe_profiles where user_id=p_user;
  if p_command='create' then
    v_dilemma:=public.universe_game_text(p_input->>'dilemma');
    if char_length(v_dilemma)<10 then perform public.universe_game_fail(p_va,'Cuenta el dilema con una frase algo más larga.','Conta el dilema amb una frase una mica més llarga.'); end if;
    if char_length(v_dilemma)>220 then perform public.universe_game_fail(p_va,'Resume el dilema en menos texto.','Resumeix el dilema en menys text.'); end if;
    v_a:=coalesce(nullif(btrim(coalesce(p_input->>'stanceA','')),''),'Sí'); v_b:=coalesce(nullif(btrim(coalesce(p_input->>'stanceB','')),''),'No');
    if char_length(v_a)>40 or char_length(v_b)>40 then perform public.universe_game_fail(p_va,'Las posturas deben ser cortas.','Les postures han de ser curtes.'); end if;
    if lower(v_a)=lower(v_b) then perform public.universe_game_fail(p_va,'Las dos posturas deben ser distintas.','Les dues postures han de ser diferents.'); end if;
    v_kind:=p_input->>'audienceKind';
    if v_kind is null or v_kind not in ('campus','degree','course','group') then perform public.universe_game_fail(p_va,'Elige quién juzga el caso.','Tria qui jutja el cas.'); end if;
    v_ref:=public.universe_game_pick_audience(p_user,p_va,v_kind,p_input->>'audienceRef',array['campus','degree','course','group']);
    v_anon:=coalesce(p_input->'anon'='true'::jsonb,false);
    -- Requirement 3: the screen shows the minimum, the server enforces it on the audience as it is now.
    if v_anon and public.universe_game_reach(p_user,v_kind,v_ref)<8 then
      perform public.universe_game_fail(p_va,'Hacen falta 8 personas en ese destinatario para preguntar sin tu nombre.','Calen 8 persones en eixe destinatari per a preguntar sense el teu nom.'); end if;
    if (select count(*) from public.universe_game_items where game='jury' and kind='case' and owner=p_user and not withdrawn and ends_at>now())>=2 then
      perform public.universe_game_fail(p_va,'Ya tienes dos casos abiertos. Cierra o retira uno antes de abrir otro.','Ja tens dos casos oberts. Tanca''n o retira''n un abans d''obrir-ne un altre.'); end if;
    if exists(select 1 from unnest(array['suicid','quitarme la vida','quitar-me la vida','no quiero vivir','no vull viure','matarme','matar-me','autolesi','hacerme dano','hacerme daño','fer-me mal','self harm',
      'maltrato','maltracte','violacion','violación','violencia','abuso sexual','abus sexual','acoso sexual','assetjament sexual','me pega','em pega','me pegan','em peguen','sobredosis','anorexia','bulimia']) w
      where strpos(lower(v_dilemma||' '||v_a||' '||v_b),w)>0) then
      perform public.universe_game_fail(p_va,
        'Esto no es un caso para un jurado: parece algo que necesita ayuda de verdad, no un veredicto. El Servei d''Assessorament Psicològic (SAP) de tu universidad puede ayudarte, y si es urgente puedes llamar al 024 o al 112.',
        'Això no és un cas per a un jurat: pareix una cosa que necessita ajuda de veritat, no un veredicte. El Servei d''Assessorament Psicològic (SAP) de la teua universitat pot ajudar-te, i si és urgent pots telefonar al 024 o al 112.'); end if;
    insert into public.universe_game_items(game,kind,owner,audience_kind,audience_ref,audience_campus,audience_degree,audience_year,anon,state,ends_at)
      values('jury','case',p_user,v_kind,v_ref,v_me.campus,v_me.degree,v_me.year,v_anon,jsonb_build_object('dilemma',v_dilemma,'stanceA',v_a,'stanceB',v_b),now()+interval '72 hours');
    return;
  end if;
  if p_command not in ('vote','switch','argue','support','withdraw') then perform public.universe_game_fail(p_va,'Acción desconocida.','Acció desconeguda.'); end if;
  select * into c from public.universe_game_items where id=public.universe_game_uuid(p_input->>'caseId') and game='jury' and kind='case' for update;
  if c.id is null or not public.universe_game_sees(p_user,c) then perform public.universe_game_fail(p_va,'Ese caso ya no está disponible.','Eixe cas ja no hi és disponible.'); end if;
  if p_command='withdraw' then
    if c.owner<>p_user then perform public.universe_game_fail(p_va,'Solo puedes retirar tus propios casos.','Només pots retirar els teus propis casos.'); end if;
    update public.universe_game_items set withdrawn=true where id=c.id;
    return;
  end if;
  if c.ends_at<=now() then perform public.universe_game_fail(p_va,'Este caso ya está cerrado.','Este cas ja està tancat.'); end if;
  select * into v_vote from public.universe_game_moves where item=c.id and actor=p_user and kind='vote';
  if p_command in ('vote','switch') then
    v_choice:=case p_input->>'choice' when 'a' then 0 when 'b' then 1 end;
    if v_choice is null then perform public.universe_game_fail(p_va,'Elige una de las dos posturas.','Tria una de les dues postures.'); end if;
    if p_command='vote' then
      if v_vote.id is not null then perform public.universe_game_fail(p_va,'Ya has votado este caso.','Ja has votat este cas.'); end if;
      insert into public.universe_game_moves(item,actor,kind,choice,data) values(c.id,p_user,'vote',v_choice,'{"switched":false}');
    else
      if v_vote.id is null then perform public.universe_game_fail(p_va,'Vota primero para poder cambiar de opinión.','Vota primer per a poder canviar d''opinió.'); end if;
      if coalesce((v_vote.data->>'switched')::boolean,false) then perform public.universe_game_fail(p_va,'Ya has cambiado de opinión una vez en este caso.','Ja has canviat d''opinió una vegada en este cas.'); end if;
      if v_vote.choice=v_choice then perform public.universe_game_fail(p_va,'Ese ya es tu voto.','Eixe ja és el teu vot.'); end if;
      update public.universe_game_moves set choice=v_choice,data='{"switched":true}' where id=v_vote.id;
    end if;
  elsif p_command='argue' then
    if v_vote.id is null then perform public.universe_game_fail(p_va,'Vota primero para poder argumentar.','Vota primer per a poder argumentar.'); end if;
    v_choice:=case p_input->>'side' when 'a' then 0 when 'b' then 1 end;
    if v_choice is null then perform public.universe_game_fail(p_va,'Elige una de las dos posturas.','Tria una de les dues postures.'); end if;
    if v_choice<>v_vote.choice then perform public.universe_game_fail(p_va,'Solo puedes argumentar el lado que has votado.','Només pots argumentar el costat que has votat.'); end if;
    v_text:=public.universe_game_text(p_input->>'text');
    if char_length(v_text)<3 then perform public.universe_game_fail(p_va,'Escribe tu argumento.','Escriu el teu argument.'); end if;
    if char_length(v_text)>280 then perform public.universe_game_fail(p_va,'Sé más breve en tu argumento.','Sigues més breu en el teu argument.'); end if;
    insert into public.universe_game_moves(item,actor,kind,choice,body) values(c.id,p_user,'argument',v_choice,v_text);
  else
    if v_vote.id is null then perform public.universe_game_fail(p_va,'Vota primero para poder apoyar un argumento.','Vota primer per a poder recolzar un argument.'); end if;
    select * into v_arg from public.universe_game_moves where id=public.universe_game_uuid(p_input->>'argumentId') and item=c.id and kind='argument';
    if v_arg.id is null or (v_arg.actor<>p_user and public.universe_game_blocked(p_user,v_arg.actor)) then perform public.universe_game_fail(p_va,'Ese argumento ya no está.','Eixe argument ja no hi és.'); end if;
    if exists(select 1 from public.universe_game_moves where item=c.id and actor=p_user and kind='support' and ref=v_arg.id) then
      delete from public.universe_game_moves where item=c.id and actor=p_user and kind='support' and ref=v_arg.id;
    else insert into public.universe_game_moves(item,actor,kind,ref) values(c.id,p_user,'support',v_arg.id); end if;
  end if;
end; $$;

-- ================= Hay hueco =================

create or replace function public.universe_game_what(p_va boolean,p_state jsonb) returns text
language sql immutable set search_path='' as $$
  select case p_state->>'what'
    when 'cafe' then public.universe_game_tr(p_va,'Café','Cafè') when 'comer' then public.universe_game_tr(p_va,'Comer','Menjar')
    when 'estudiar' then 'Estudiar' when 'pasear' then public.universe_game_tr(p_va,'Pasear','Passejar')
    when 'deporte' then public.universe_game_tr(p_va,'Deporte','Esport')
    else coalesce(nullif(p_state->>'whatText',''),public.universe_game_tr(p_va,'Otra cosa','Una altra cosa')) end;
$$;
create or replace function public.universe_game_place(p_va boolean,p_state jsonb) returns text
language sql immutable set search_path='' as $$
  select case p_state->>'place'
    when 'cafeteria' then public.universe_game_tr(p_va,'Cafetería','Cafeteria') when 'biblioteca' then 'Biblioteca'
    when 'cesped' then public.universe_game_tr(p_va,'El césped','La gespa') when 'entrada' then 'Entrada principal'
    else coalesce(nullif(p_state->>'placeText',''),public.universe_game_tr(p_va,'Otro sitio','Un altre lloc')) end;
$$;
-- System lines in the hangout chat keep both languages; each reader gets theirs.
create or replace function public.universe_game_say(p_item uuid,p_actor uuid,p_es text,p_vl text) returns void
language sql set search_path='' as $$
  insert into public.universe_game_moves(item,actor,kind,data) values(p_item,p_actor,'message',jsonb_build_object('system',true,'es',p_es,'va',p_vl));
$$;

create or replace function public.universe_game_hangout_room(p_room public.universe_game_items,p_user uuid,p_va boolean,p_detail boolean) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('id',p_room.id,'owner',p_room.owner,'owner_name',(select name from public.universe_profiles where user_id=p_room.owner),
    'mine',p_room.owner=p_user,'audience',public.universe_game_audience(p_room),'anon',false,
    'created_at',public.universe_game_iso(p_room.created_at),'expires',public.universe_game_iso(p_room.ends_at),
    'what',p_room.state->>'what','whatLabel',public.universe_game_what(p_va,p_room.state),'place',p_room.state->>'place','placeLabel',public.universe_game_place(p_va,p_room.state),
    'starts_at',public.universe_game_iso(p_room.starts_at),'started',p_room.starts_at<=now(),
    'capacity',(p_room.state->>'capacity')::integer,'spotsLeft',greatest(0,(p_room.state->>'capacity')::integer-s.n),'full',s.n>=(p_room.state->>'capacity')::integer)
  || case when p_detail then jsonb_build_object('note',coalesce(p_room.state->>'note',''),'ended',p_room.ends_at<=now(),'closed',coalesce((p_room.state->>'closed')::boolean,false),
      'waitTotal',greatest(0,round(extract(epoch from p_room.starts_at-p_room.created_at)*1000))::bigint,
      'runTotal',greatest(0,round(extract(epoch from p_room.ends_at-p_room.starts_at)*1000))::bigint,
      'seats',(select coalesce(jsonb_agg(jsonb_build_object('id',m.actor,'here',coalesce((m.data->>'here')::boolean,false),'mine',m.actor=p_user) order by m.created_at,m.id),'[]')
        from public.universe_game_moves m where m.item=p_room.id and m.kind='seat'),
      'messages',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'from',case when coalesce((m.data->>'system')::boolean,false) then 'system' else m.actor::text end,
          'mine',m.actor=p_user and not coalesce((m.data->>'system')::boolean,false),'system',coalesce((m.data->>'system')::boolean,false),
          'text',case when coalesce((m.data->>'system')::boolean,false) then public.universe_game_tr(p_va,m.data->>'es',m.data->>'va') else m.body end,
          'at',public.universe_game_iso(m.created_at)) order by m.created_at,m.id),'[]')
        from (select * from public.universe_game_moves m where m.item=p_room.id and m.kind='message' order by m.created_at desc,m.id desc limit 200) m))
    else jsonb_build_object('startsInMinutes',greatest(0,round(extract(epoch from p_room.starts_at-now())/60))::integer,'seats',s.n,
      'going',(select coalesce(jsonb_agg(m.actor order by m.created_at,m.id),'[]') from public.universe_game_moves m where m.item=p_room.id and m.kind='seat')) end
  from (select count(*)::integer n from public.universe_game_moves where item=p_room.id and kind='seat') s;
$$;

create or replace function public.universe_game_hangout_view(p_user uuid,p_va boolean) returns jsonb
language plpgsql stable set search_path='' as $$
declare
  v_active public.universe_game_items; v_repeat public.universe_game_items; v_local timestamp:=now() at time zone 'Europe/Madrid'; v_first timestamp; v_repeat_view jsonb;
begin
  select i.* into v_active from public.universe_game_items i join public.universe_game_moves m on m.item=i.id and m.kind='seat' and m.actor=p_user
    where i.game='hangout' and i.ends_at>now() order by i.starts_at desc limit 1;
  if v_active.id is null then
    select i.* into v_repeat from public.universe_game_items i join public.universe_game_moves m on m.item=i.id and m.kind='seat' and m.actor=p_user and coalesce((m.data->>'here')::boolean,false)
      where i.game='hangout' and i.ends_at<=now() and i.ends_at>now()-interval '7 days'
        and not exists(select 1 from public.universe_game_moves d where d.item=i.id and d.actor=p_user and d.kind='dismiss')
      order by i.ends_at desc limit 1;
    if v_repeat.id is not null then
      select jsonb_build_object('id',v_repeat.id,'whatLabel',public.universe_game_what(p_va,v_repeat.state),'placeLabel',public.universe_game_place(p_va,v_repeat.state),
        'others',coalesce(jsonb_agg(jsonb_build_object('id',s.actor,'tapped',t.id is not null,'mutual',t.id is not null and exists(select 1 from public.universe_game_moves b where b.item=v_repeat.id and b.kind='tap' and b.actor=s.actor and b.ref=p_user)) order by s.created_at) filter(where s.actor<>p_user),'[]'),
        'canGroup',count(*)>=2 and bool_and(exists(select 1 from public.universe_game_moves w where w.item=v_repeat.id and w.kind='want' and w.actor=s.actor)))
        into v_repeat_view
        from public.universe_game_moves s left join public.universe_game_moves t on t.item=s.item and t.kind='tap' and t.actor=p_user and t.ref=s.actor
        where s.item=v_repeat.id and s.kind='seat' and coalesce((s.data->>'here')::boolean,false);
    end if;
  end if;
  v_first:=date_trunc('hour',v_local)+case when extract(minute from v_local)<30 then interval '30 minutes' else interval '60 minutes' end;
  return jsonb_build_object(
    'places',jsonb_build_array(jsonb_build_object('id','cafeteria','label',public.universe_game_tr(p_va,'Cafetería','Cafeteria')),jsonb_build_object('id','biblioteca','label','Biblioteca'),
      jsonb_build_object('id','cesped','label',public.universe_game_tr(p_va,'El césped','La gespa')),jsonb_build_object('id','entrada','label','Entrada principal')),
    'whatOptions',(select jsonb_agg(jsonb_build_object('id',w,'label',public.universe_game_what(p_va,jsonb_build_object('what',w))) order by n)
      from unnest(array['cafe','comer','estudiar','pasear','deporte','otra']) with ordinality x(w,n)),
    'timeSlots',(select coalesce(jsonb_agg(public.universe_game_iso((v_first+n*interval '30 minutes') at time zone 'Europe/Madrid') order by n),'[]')
      from generate_series(0,5) n where (v_first+n*interval '30 minutes')::date=v_local::date),
    'discover',(select coalesce(jsonb_agg(public.universe_game_hangout_room(i,p_user,p_va,false) order by greatest(i.starts_at,now()),i.created_at),'[]') from public.universe_game_items i where i.id in (
      select x.id from public.universe_game_items x where x.game='hangout' and x.ends_at>now() and not coalesce((x.state->>'closed')::boolean,false)
        and public.universe_game_sees(p_user,x)
        and not exists(select 1 from public.universe_game_moves m where m.item=x.id and m.kind='seat' and (m.actor=p_user or public.universe_game_blocked(p_user,m.actor)))
      order by greatest(x.starts_at,now()),x.created_at limit 50)),
    'active',case when v_active.id is null then null else public.universe_game_hangout_room(v_active,p_user,p_va,true) end,
    'repeat',v_repeat_view);
end; $$;

create or replace function public.universe_game_hangout(p_user uuid,p_va boolean,p_command text,p_input jsonb) returns void
language plpgsql set search_path='' as $$
declare
  v_me public.universe_profiles; r public.universe_game_items; v_seat public.universe_game_moves; v_what text; v_what_text text; v_place text; v_place_text text;
  v_mode text; v_starts timestamptz; v_minutes integer; v_capacity integer; v_kind text; v_ref uuid; v_note text; v_text text; v_person uuid; v_new public.universe_game_items;
  v_busy boolean;
begin
  select * into v_me from public.universe_profiles where user_id=p_user;
  -- One hangout at a time: open, or sat in, until it ends.
  v_busy:=exists(select 1 from public.universe_game_moves m join public.universe_game_items i on i.id=m.item where m.actor=p_user and m.kind='seat' and i.game='hangout' and i.ends_at>now());
  if p_command='create' then
    if v_busy then perform public.universe_game_fail(p_va,'Ya estás en un hueco. Sal de él antes de abrir otro.','Ja estàs en un forat. Ix-ne abans d''obrir-ne un altre.'); end if;
    v_what:=coalesce(p_input->>'what','');
    if v_what not in ('cafe','comer','estudiar','pasear','deporte','otra') then perform public.universe_game_fail(p_va,'Elige qué vais a hacer.','Tria què fareu.'); end if;
    v_what_text:=case when v_what='otra' then left(btrim(coalesce(p_input->>'whatText','')),40) else '' end;
    if v_what='otra' and v_what_text='' then perform public.universe_game_fail(p_va,'Cuéntanos qué plan es.','Conta''ns quin pla és.'); end if;
    v_place:=coalesce(p_input->>'place','');
    if v_place not in ('cafeteria','biblioteca','cesped','entrada','otro') then perform public.universe_game_fail(p_va,'Elige dónde quedáis.','Tria on quedeu.'); end if;
    v_place_text:=case when v_place='otro' then left(btrim(coalesce(p_input->>'placeText','')),60) else '' end;
    if v_place='otro' and v_place_text='' then perform public.universe_game_fail(p_va,'Dinos el sitio.','Digues-nos el lloc.'); end if;
    v_mode:=coalesce(p_input->>'startMode','now');
    if v_mode='now' then v_starts:=now(); elsif v_mode='15' then v_starts:=now()+interval '15 minutes'; elsif v_mode='30' then v_starts:=now()+interval '30 minutes';
    elsif v_mode='at' then
      v_starts:=public.universe_game_ts(p_input->>'startsAt');
      if v_starts is null or v_starts<now()-interval '1 minute' or (v_starts at time zone 'Europe/Madrid')::date<>(now() at time zone 'Europe/Madrid')::date then
        perform public.universe_game_fail(p_va,'Elige una hora de hoy.','Tria una hora d''avui.'); end if;
      v_starts:=greatest(v_starts,now());
    else perform public.universe_game_fail(p_va,'Elige cuándo.','Tria quan.'); end if;
    v_minutes:=coalesce(least(120,greatest(15,round(public.universe_game_num(p_input->>'duration'))))::integer,30);
    v_capacity:=coalesce(least(8,greatest(2,round(public.universe_game_num(p_input->>'capacity'))))::integer,4);
    v_kind:=coalesce(p_input->>'audienceKind','site');
    if v_kind not in ('campus','site','degree','course','group','contacts','person') then v_kind:='site'; end if;
    v_ref:=public.universe_game_pick_audience(p_user,p_va,v_kind,p_input->>'audienceRef',array['campus','site','degree','course','group','contacts','person']);
    v_note:=left(btrim(coalesce(p_input->>'note','')),140);
    insert into public.universe_game_items(game,kind,owner,audience_kind,audience_ref,audience_campus,audience_degree,audience_year,state,starts_at,ends_at)
      values('hangout','hangout',p_user,v_kind,v_ref,v_me.campus,v_me.degree,v_me.year,
        jsonb_build_object('what',v_what,'whatText',v_what_text,'place',v_place,'placeText',v_place_text,'note',v_note,'capacity',v_capacity,'closed',false),
        v_starts,v_starts+make_interval(mins=>v_minutes)) returning * into v_new;
    insert into public.universe_game_moves(item,actor,kind,data) values(v_new.id,p_user,'seat','{"here":false}');
    return;
  end if;
  if p_command not in ('join','leave','here','message','close','extend','move','repeatTap','repeatSkip','repeatDone') then perform public.universe_game_fail(p_va,'Acción desconocida.','Acció desconeguda.'); end if;
  select * into r from public.universe_game_items where id=public.universe_game_uuid(p_input->>'id') and game='hangout' and kind='hangout' for update;
  select * into v_seat from public.universe_game_moves where item=r.id and actor=p_user and kind='seat';
  -- Requirement 1: whoever is not in the audience, and not sat in it, cannot even learn it exists.
  if r.id is null or (v_seat.id is null and not public.universe_game_sees(p_user,r)) then perform public.universe_game_fail(p_va,'Ese hueco ya no existe.','Eixe forat ja no existeix.'); end if;
  if p_command='join' then
    if v_busy then perform public.universe_game_fail(p_va,'Ya estás en un hueco. Sal de él antes de apuntarte a otro.','Ja estàs en un forat. Ix-ne abans d''apuntar-te a un altre.'); end if;
    if coalesce((r.state->>'closed')::boolean,false) then perform public.universe_game_fail(p_va,'Este hueco está cerrado.','Este forat està tancat.'); end if;
    if r.ends_at<=now() then perform public.universe_game_fail(p_va,'Este hueco ya ha terminado.','Este forat ja ha acabat.'); end if;
    if exists(select 1 from public.universe_game_moves where item=r.id and kind='seat' and public.universe_game_blocked(p_user,actor)) then perform public.universe_game_fail(p_va,'Ese hueco ya no existe.','Eixe forat ja no existeix.'); end if;
    if (select count(*) from public.universe_game_moves where item=r.id and kind='seat')>=(r.state->>'capacity')::integer then perform public.universe_game_fail(p_va,'Ya está completo.','Ja està complet.'); end if;
    insert into public.universe_game_moves(item,actor,kind,data) values(r.id,p_user,'seat','{"here":false}');
    perform public.universe_game_say(r.id,p_user,v_me.name||' se ha apuntado.',v_me.name||' s''ha apuntat.');
  elsif p_command='leave' then
    if v_seat.id is null then perform public.universe_game_fail(p_va,'No estabas en este hueco.','No estaves en aquest forat.'); end if;
    if r.owner=p_user and not coalesce((r.state->>'closed')::boolean,false) then perform public.universe_game_fail(p_va,'Quien abre el hueco puede cerrarlo, no irse. Usa «Cerrar».','Qui obri el forat pot tancar-lo, no anar-se''n. Usa «Tancar».'); end if;
    delete from public.universe_game_moves where id=v_seat.id;
    if r.owner<>p_user then perform public.universe_game_say(r.id,p_user,v_me.name||' se ha ido.',v_me.name||' se n''ha anat.'); end if;
  elsif p_command='here' then
    if v_seat.id is null then perform public.universe_game_fail(p_va,'Tienes que apuntarte primero.','T''has d''apuntar primer.'); end if;
    if not coalesce((v_seat.data->>'here')::boolean,false) then
      update public.universe_game_moves set data='{"here":true}' where id=v_seat.id;
      perform public.universe_game_say(r.id,p_user,v_me.name||' ya está aquí.',v_me.name||' ja està ací.');
    end if;
  elsif p_command='message' then
    if v_seat.id is null then perform public.universe_game_fail(p_va,'Tienes que apuntarte para escribir.','T''has d''apuntar per a escriure.'); end if;
    if r.ends_at<=now() then perform public.universe_game_fail(p_va,'Este hueco ya ha terminado.','Este forat ja ha acabat.'); end if;
    v_text:=left(btrim(coalesce(p_input->>'text','')),300);
    if v_text='' then perform public.universe_game_fail(p_va,'Escribe algo primero.','Escriu alguna cosa primer.'); end if;
    insert into public.universe_game_moves(item,actor,kind,body) values(r.id,p_user,'message',v_text);
  elsif p_command in ('close','extend','move') then
    if r.owner<>p_user then perform public.universe_game_fail(p_va,'Solo quien abrió el hueco puede hacer esto.','Només qui ha obert el forat pot fer això.'); end if;
    if p_command='close' then
      if r.ends_at<=now() then perform public.universe_game_fail(p_va,'Este hueco ya ha terminado.','Este forat ja ha acabat.'); end if;
      update public.universe_game_items set state=state||'{"closed":true}' where id=r.id;
      perform public.universe_game_say(r.id,p_user,'Quien abrió el hueco lo ha cerrado.','Qui ha obert el forat l''ha tancat.');
    elsif p_command='extend' then
      if coalesce((r.state->>'closed')::boolean,false) or r.ends_at<=now() then perform public.universe_game_fail(p_va,'Ya no se puede ampliar.','Ja no es pot ampliar.'); end if;
      update public.universe_game_items set ends_at=ends_at+interval '30 minutes' where id=r.id;
      perform public.universe_game_say(r.id,p_user,'Se ha ampliado media hora.','S''ha ampliat mitja hora.');
    else
      if coalesce((r.state->>'closed')::boolean,false) or r.ends_at<=now() then perform public.universe_game_fail(p_va,'Ya no se puede cambiar el sitio.','Ja no es pot canviar el lloc.'); end if;
      v_place:=coalesce(p_input->>'place','');
      if v_place not in ('cafeteria','biblioteca','cesped','entrada','otro') then perform public.universe_game_fail(p_va,'Elige un sitio.','Tria un lloc.'); end if;
      v_place_text:=case when v_place='otro' then left(btrim(coalesce(p_input->>'placeText','')),60) else '' end;
      if v_place='otro' and v_place_text='' then perform public.universe_game_fail(p_va,'Dinos el nuevo sitio.','Digues-nos el nou lloc.'); end if;
      update public.universe_game_items set state=state||jsonb_build_object('place',v_place,'placeText',v_place_text) where id=r.id returning * into r;
      perform public.universe_game_say(r.id,p_user,'Nuevo sitio: '||public.universe_game_place(false,r.state)||'.','Nou lloc: '||public.universe_game_place(true,r.state)||'.');
    end if;
  else
    if v_seat.id is null then perform public.universe_game_fail(p_va,'No estabas en este hueco.','No estaves en aquest forat.'); end if;
    if p_command='repeatTap' then
      if not coalesce((v_seat.data->>'here')::boolean,false) or r.ends_at>now() then perform public.universe_game_fail(p_va,'Esto solo vale al terminar el hueco.','Això només val en acabar el forat.'); end if;
      v_person:=public.universe_game_uuid(p_input->>'person');
      if v_person is not null then
        if v_person=p_user or not exists(select 1 from public.universe_game_moves where item=r.id and kind='seat' and actor=v_person and coalesce((data->>'here')::boolean,false)) then
          perform public.universe_game_fail(p_va,'Esa persona no estuvo en este hueco.','Eixa persona no va estar en este forat.'); end if;
        if exists(select 1 from public.universe_game_moves where item=r.id and actor=p_user and kind='tap' and ref=v_person) then
          delete from public.universe_game_moves where item=r.id and actor=p_user and kind='tap' and ref=v_person;
        else
          insert into public.universe_game_moves(item,actor,kind,ref) values(r.id,p_user,'tap',v_person);
          -- A mutual tap makes a contact: contacts are implicit, and an open conversation is one.
          if exists(select 1 from public.universe_game_moves where item=r.id and actor=v_person and kind='tap' and ref=p_user) and not public.universe_game_blocked(p_user,v_person) then
            insert into public.universe_threads(user_a,user_b) values(least(p_user,v_person),greatest(p_user,v_person)) on conflict do nothing;
          end if;
        end if;
      end if;
      insert into public.universe_game_moves(item,actor,kind) values(r.id,p_user,'want') on conflict do nothing;
    elsif p_command='repeatSkip' then
      delete from public.universe_game_moves where item=r.id and actor=p_user and kind='want';
      insert into public.universe_game_moves(item,actor,kind) values(r.id,p_user,'dismiss') on conflict do nothing;
    else
      insert into public.universe_game_moves(item,actor,kind) values(r.id,p_user,'dismiss') on conflict do nothing;
    end if;
  end if;
end; $$;

-- ================= Block and report, shared by every game =================

create or replace function public.universe_game_guard(p_user uuid,p_va boolean,p_game text,p_command text,p_input jsonb) returns void
language plpgsql set search_path='' as $$
declare v_person uuid:=public.universe_game_uuid(p_input->>'person'); r public.universe_game_items; v_move public.universe_game_moves;
begin
  if p_input ? 'item' then
    select * into r from public.universe_game_items where id=public.universe_game_uuid(p_input->>'item') and game=p_game;
    if r.id is null or not public.universe_game_sees(p_user,r) then perform public.universe_game_fail(p_va,'Ya no está disponible.','Ja no està disponible.'); end if;
    if p_input ? 'move' then
      select * into v_move from public.universe_game_moves where id=public.universe_game_uuid(p_input->>'move') and item=r.id and kind in ('argument','message');
      if v_move.id is null then perform public.universe_game_fail(p_va,'Ya no está disponible.','Ja no està disponible.'); end if;
    end if;
    -- Blocking or reporting an anonymous author works on the account without ever returning it.
    v_person:=coalesce(v_move.actor,r.owner);
  end if;
  if p_command='report' then
    if r.id is null then perform public.universe_game_fail(p_va,'Elige qué quieres denunciar.','Tria què vols denunciar.'); end if;
    insert into public.universe_game_reports(reporter,accused,game,item,move,body,reason)
      values(p_user,v_person,p_game,r.id,v_move.id,coalesce(v_move.body,r.state::text),left(btrim(coalesce(p_input->>'reason','')),500));
    if v_person<>p_user then insert into public.universe_game_blocks(blocker,blocked) values(p_user,v_person) on conflict do nothing; end if;
  elsif p_command='block' then
    if v_person is null or v_person=p_user or not exists(select 1 from public.universe_profiles where user_id=v_person) then perform public.universe_game_fail(p_va,'Elige a quién bloquear.','Tria a qui bloquejar.'); end if;
    insert into public.universe_game_blocks(blocker,blocked) values(p_user,v_person) on conflict do nothing;
  else
    delete from public.universe_game_blocks where blocker=p_user and blocked=v_person;
  end if;
end; $$;

-- ================= Entry point =================

create or replace function public.universe_play_v2(p_game text,p_command text default 'read',p_input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); v_va boolean:=coalesce(p_input->>'locale','')='va'; v_command text:=coalesce(p_command,'read');
begin
  if not public.universe_is_member() or not exists(select 1 from public.universe_profiles where user_id=u) then
    perform public.universe_game_fail(v_va,'Necesitas una cuenta universitaria verificada.','Necessites un compte universitari verificat.'); end if;
  if p_game is null or p_game not in ('crush','questions','debate','truth','hangout','jury','blind') then perform public.universe_game_fail(v_va,'Experiencia desconocida.','Experiència desconeguda.'); end if;
  -- 42883 is what the client already reads as "not active yet": it shows the link to the demo.
  if p_game not in ('truth','jury','hangout') then
    raise exception 'Este juego todavía no está activado para cuentas reales. Puedes jugarlo en la demo.' using errcode='42883';
  end if;
  if jsonb_typeof(p_input) is distinct from 'object' or length(p_input::text)>6000 then perform public.universe_game_fail(v_va,'Datos no válidos.','Dades no vàlides.'); end if;
  if v_command<>'read' then
    if v_command like 'demo%' then perform public.universe_game_fail(v_va,'Esta acción solo existe en la demo.','Esta acció només existix en la demo.'); end if;
    -- Serialise writes for each game: seats, single votes and open-item limits.
    perform pg_advisory_xact_lock(hashtext('universe_play_v2:'||p_game));
    if (select count(*) from public.universe_game_activity where actor=u and created_at>now()-interval '1 minute')>=40 then
      perform public.universe_game_fail(v_va,'Demasiadas acciones seguidas. Espera un minuto.','Massa accions seguides. Espera un minut.'); end if;
    if v_command in ('create','startGroupRound') and (select count(*) from public.universe_game_activity where actor=u and game=p_game and command in ('create','startGroupRound') and created_at>now()-interval '1 day')>=10 then
      perform public.universe_game_fail(v_va,'Has llegado al límite de hoy en este juego.','Has arribat al límit de hui en este joc.'); end if;
    if v_command in ('block','unblock','report') then perform public.universe_game_guard(u,v_va,p_game,v_command,p_input);
    elsif p_game='truth' then perform public.universe_game_truth(u,v_va,v_command,p_input);
    elsif p_game='jury' then perform public.universe_game_jury(u,v_va,v_command,p_input);
    else perform public.universe_game_hangout(u,v_va,v_command,p_input); end if;
    insert into public.universe_game_activity(actor,game,command) values(u,p_game,v_command);
  end if;
  return case p_game when 'truth' then public.universe_game_truth_view(u,v_va) when 'jury' then public.universe_game_jury_view(u,v_va) else public.universe_game_hangout_view(u,v_va) end;
end; $$;

-- ================= Time kept by the server =================

-- Marks what has ended and applies the hangout chat retention (24 hours after the end).
-- Reads never depend on it: every projection compares ends_at with now(). It is the place
-- where end-of-item notices will be written once the Buzón takes game notices.
create or replace function public.universe_game_sweep() returns integer
language plpgsql security definer set search_path='' as $$
declare v_settled integer;
begin
  update public.universe_game_items set settled_at=now() where settled_at is null and ends_at<=now();
  get diagnostics v_settled=row_count;
  delete from public.universe_game_moves m using public.universe_game_items i
    where m.item=i.id and i.game='hangout' and m.kind='message' and i.ends_at<now()-interval '24 hours'
      and not exists(select 1 from public.universe_game_reports x where x.item=i.id);
  return v_settled;
end; $$;
-- With pg_cron enabled:
-- select cron.schedule('universe-game-sweep','*/5 * * * *',$$select public.universe_game_sweep()$$);

revoke all on function public.universe_game_tr(boolean,text,text),public.universe_game_fail(boolean,text,text),public.universe_game_uuid(text),
  public.universe_game_num(text),public.universe_game_ts(text),public.universe_game_text(text),public.universe_game_iso(timestamptz),
  public.universe_game_blocked(uuid,uuid),public.universe_game_contact(uuid,uuid),
  public.universe_game_reaches(uuid,uuid,text,uuid,text,text,smallint),public.universe_game_sees(uuid,public.universe_game_items),
  public.universe_game_reach(uuid,text,uuid),public.universe_game_audience(public.universe_game_items),public.universe_game_group_name(uuid),
  public.universe_game_pick_audience(uuid,boolean,text,text,text[]),
  public.universe_game_truth_round(public.universe_game_items,uuid,boolean),public.universe_game_truth_view(uuid,boolean),public.universe_game_truth(uuid,boolean,text,jsonb),
  public.universe_game_jury_argument(public.universe_game_items,public.universe_game_moves,uuid,boolean,boolean),public.universe_game_jury_case(public.universe_game_items,uuid,boolean),
  public.universe_game_jury_view(uuid,boolean),public.universe_game_jury(uuid,boolean,text,jsonb),
  public.universe_game_what(boolean,jsonb),public.universe_game_place(boolean,jsonb),public.universe_game_say(uuid,uuid,text,text),
  public.universe_game_hangout_room(public.universe_game_items,uuid,boolean,boolean),public.universe_game_hangout_view(uuid,boolean),public.universe_game_hangout(uuid,boolean,text,jsonb),
  public.universe_game_guard(uuid,boolean,text,text,jsonb),public.universe_game_sweep()
  from public,anon,authenticated;
revoke all on function public.universe_play_v2(text,text,jsonb) from public,anon;
grant execute on function public.universe_play_v2(text,text,jsonb) to authenticated;


-- 202609270032_warmups.sql
-- Rondas de calentamiento del «juego del día» propuestas por la IA. Llegan como
-- pendientes y solo se muestran cuando alguien del equipo las aprueba en el
-- backoffice. Si no hay ninguna aprobada, la aplicación usa las de siempre.
create table public.universe_warmups (
 id uuid primary key default gen_random_uuid(),
 game text not null check (game in ('truth','questions','blind','debate','jury')),
 content jsonb not null check (jsonb_typeof(content) = 'object' and length(content::text) <= 4000),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 model text check (model is null or char_length(model) <= 60),
 created_at timestamptz not null default now(),
 reviewed_by uuid references public.universe_profiles(user_id) on delete set null,
 reviewed_at timestamptz
);
create index universe_warmups_game on public.universe_warmups(game, status, reviewed_at);
revoke all on public.universe_warmups from public, anon, authenticated;
alter table public.universe_warmups enable row level security;
create policy warmups_read on public.universe_warmups for select to authenticated using ((select public.universe_is_member()) and status = 'approved');
grant select (id, game, content, reviewed_at) on public.universe_warmups to authenticated;

create function public.universe_warmup_reviewer() returns boolean
language sql stable security definer set search_path = '' as $$
 select coalesce(public.universe_backoffice_can('editor') or public.universe_backoffice_can('moderator'), false);
$$;
revoke all on function public.universe_warmup_reviewer() from public, anon, authenticated;

-- Las pendientes, para el backoffice.
create function public.universe_warmups_pending() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
 if not public.universe_warmup_reviewer() then raise exception 'BACKOFFICE_ACCESS_REQUIRED'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'game', w.game, 'content', w.content, 'model', w.model, 'created_at', w.created_at) order by w.created_at)
  from public.universe_warmups w where w.status = 'pending'), '[]'::jsonb);
end;
$$;
revoke all on function public.universe_warmups_pending() from public, anon;
grant execute on function public.universe_warmups_pending() to authenticated;

create function public.universe_warmup_review(p_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not public.universe_warmup_reviewer() then raise exception 'BACKOFFICE_ACCESS_REQUIRED'; end if;
 update public.universe_warmups set status = case when p_approve then 'approved' else 'rejected' end, reviewed_by = auth.uid(), reviewed_at = now()
 where id = p_id and status = 'pending';
 if not found then raise exception 'WARMUP_NOT_PENDING'; end if;
end;
$$;
revoke all on function public.universe_warmup_review(uuid, boolean) from public, anon;
grant execute on function public.universe_warmup_review(uuid, boolean) to authenticated;

-- La Edge Function warmup-writer añade propuestas con la clave de servicio. Si
-- ya hay muchas sin revisar, no añade más: nadie tiene que leer una cola infinita.
create function public.universe_warmup_add(p_game text, p_content jsonb, p_model text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
 if (select count(*) from public.universe_warmups where game = p_game and status = 'pending') >= 12 then return false; end if;
 insert into public.universe_warmups(game, content, model) values (p_game, p_content, p_model);
 return true;
end;
$$;
revoke all on function public.universe_warmup_add(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.universe_warmup_add(text, jsonb, text) to service_role;

commit;
