-- Dónde se ha quedado el correo de bienvenida. Pegar entero en el SQL Editor.
-- Cada fila es una etapa; la primera que diga «NO» es donde está el problema.
-- Las etapas del cron y de la red se consultan de forma dinámica para que el
-- informe salga entero aunque esas extensiones no estén activadas todavía.

create or replace function pg_temp.mark(v boolean) returns text language sql immutable as $$
 select case when v then 'SÍ' when v is null then '?' else 'NO' end
$$;

create or replace function pg_temp.diagnostico_correos()
returns table (n integer, estado text, etapa text, detalle text)
language plpgsql as $$
declare ok boolean; nota text;
begin
 -- 1 · cola
 ok := to_regclass('public.universe_waitlist_emails') is not null;
 return query select 1, pg_temp.mark(ok), 'La migración 021 está aplicada (existe la cola)'::text, ''::text;
 if not ok then return; end if;

 -- 2 · permisos del servidor
 ok := has_function_privilege('service_role', 'public.universe_waitlist_due(integer)', 'execute');
 return query select 2, pg_temp.mark(ok), 'La migración 024 está aplicada (el servidor puede llamar a la cola)'::text,
  case when ok then '' else 'Aplicar supabase/migrations/202609240024_waitlist_service_grants.sql' end;

 -- 3 · altas
 select count(*) > 0, count(*) || ' direcciones, la última ' || coalesce(max(created_at)::text, '—') into ok, nota from public.universe_waitlist;
 return query select 3, pg_temp.mark(ok), 'Hay altas en la lista'::text, nota;

 -- 4 · bienvenida programada para la última alta
 ok := exists (select 1 from public.universe_waitlist_emails q join public.universe_waitlist w on w.id = q.waitlist_id
        where q.step = 0 and w.created_at = (select max(created_at) from public.universe_waitlist));
 return query select 4, pg_temp.mark(ok), 'A la última alta se le programó la bienvenida (paso 0)'::text,
  case when ok then '' else 'La 021 se aplicó después de esa alta: correr el SQL del final de docs/correos-lista-espera.md' end;

 -- 5 · pg_cron
 ok := exists (select 1 from pg_extension where extname = 'pg_cron');
 return query select 5, pg_temp.mark(ok), 'pg_cron está activado'::text, case when ok then '' else 'Database → Extensions' end;

 -- 6 · pg_net
 ok := exists (select 1 from pg_extension where extname = 'pg_net');
 return query select 6, pg_temp.mark(ok), 'pg_net está activado'::text, case when ok then '' else 'Database → Extensions' end;

 -- 7 · trabajo programado
 begin
  execute $q$select exists (select 1 from cron.job where jobname = 'waitlist-mailer'),
   coalesce((select 'cada «' || schedule || '», activo=' || active from cron.job where jobname = 'waitlist-mailer'), 'Paso 4 de la guía')$q$ into ok, nota;
 exception when undefined_table or invalid_schema_name then ok := false; nota := 'Sin pg_cron no hay reloj'; end;
 return query select 7, pg_temp.mark(ok), 'Existe el trabajo programado waitlist-mailer'::text, nota;

 -- 8 · el cron ha corrido hace poco
 begin
  execute $q$select exists (select 1 from cron.job_run_details d join cron.job j on j.jobid = d.jobid
    where j.jobname = 'waitlist-mailer' and d.start_time > now() - interval '5 minutes'),
   coalesce((select status || ' · ' || left(coalesce(return_message, ''), 120) from cron.job_run_details d join cron.job j on j.jobid = d.jobid
    where j.jobname = 'waitlist-mailer' order by start_time desc limit 1), 'sin ejecuciones')$q$ into ok, nota;
 exception when undefined_table or invalid_schema_name then ok := false; nota := 'Sin pg_cron no hay ejecuciones'; end;
 return query select 8, pg_temp.mark(ok), 'El cron se ha ejecutado en los últimos 5 minutos'::text, nota;

 -- 9 · la función respondió
 begin
  execute $q$select (select status_code = 200 from net._http_response order by id desc limit 1),
   coalesce((select 'HTTP ' || status_code || ' · ' || left(coalesce(content, error_msg, ''), 160) from net._http_response order by id desc limit 1),
    'sin respuestas: el cron aún no ha llamado')$q$ into ok, nota;
 exception when undefined_table or invalid_schema_name then ok := false; nota := 'Sin pg_net no hay llamadas'; end;
 return query select 9, pg_temp.mark(ok), 'La función responde 200 a la última llamada del cron'::text, nota;

 -- 10 · enviado
 ok := exists (select 1 from public.universe_waitlist_emails where step = 0 and sent_at is not null);
 return query select 10, pg_temp.mark(ok), 'Alguna bienvenida se ha enviado ya'::text,
  coalesce((select 'última: intentos=' || attempts || ' · ' || coalesce(last_error, 'sin error registrado')
   from public.universe_waitlist_emails where step = 0 order by send_after desc limit 1), '—');
end;
$$;

select * from pg_temp.diagnostico_correos() order by n;

-- Qué significa cada NO:
--  2  → aplicar la migración 024
--  4  → correr el «Incluir a quien se apuntó antes» de la guía
--  7  → programar el cron (paso 4 de la guía)
--  8  → el cron existe pero no corre: revisar cron.job.active y el horario
--  9  → HTTP 401: la función se desplegó CON verificación de JWT; volver a desplegar con --no-verify-jwt
--       HTTP 403: WAITLIST_CRON_SECRET no coincide entre el cron y los secretos de la función
--       HTTP 500 «RESEND_API_KEY sin configurar»: falta el secreto
--       HTTP 500 «permission denied for function»: falta la migración 024
--       error de conexión / timeout: la URL del cron no es la de la función
-- 10  → mirar last_error: «resend 403» es dominio sin verificar; «resend 422» es remitente inválido
