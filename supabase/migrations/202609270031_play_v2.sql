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
