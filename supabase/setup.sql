-- Entreclase: instalación inicial en un proyecto Supabase dedicado.
-- Generado desde supabase/migrations; no editar ni ejecutar sobre una instalación existente.
-- Instala tablas, funciones y permisos. No crea usuarios ni activa dominios.
begin;
do $$ begin
  if to_regclass('public.universe_university_domains') is not null then
    raise exception 'Entreclase ya tiene migraciones aplicadas. Ejecuta solo las pendientes, en orden.';
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

commit;
