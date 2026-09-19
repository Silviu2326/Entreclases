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
