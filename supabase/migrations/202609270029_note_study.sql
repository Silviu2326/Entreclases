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
