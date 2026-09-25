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
