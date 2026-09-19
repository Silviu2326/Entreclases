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
