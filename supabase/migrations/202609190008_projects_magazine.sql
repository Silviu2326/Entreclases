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
