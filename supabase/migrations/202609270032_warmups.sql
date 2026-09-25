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
