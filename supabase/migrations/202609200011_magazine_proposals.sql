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
