# Los correos de la lista de espera

Quien deja su correo recibe una bienvenida en el momento y después siete correos, uno por mañana a las **09:00 Europe/Madrid**, empezando **al día siguiente**. Los textos están en español y valenciano y se eligen por el idioma con el que esa persona se apuntó.

Los siete presentan la plataforma; no son una cuenta atrás. Son los mismos para todo el mundo, se apunte hoy o dentro de tres semanas, antes o después de la apertura. Por eso no llevan fechas que caduquen: las fechas viven en `/roadmap/` y una prueba comprueba que ningún correo las repite.

La web es una exportación estática y no tiene servidor: todo el envío vive en Supabase. La clave de Resend nunca sale de ahí y nunca viaja al navegador.

## Las piezas

| Pieza | Dónde | Qué hace |
| --- | --- | --- |
| `universe_waitlist_emails` | migración `202609240021` | La cola: qué correo le toca a quién y cuándo. Nadie puede leerla sin clave de servidor. |
| `universe_waitlist_schedule()` | migración `202609240022` | Al apuntarse alguien, programa la bienvenida y las siete mañanas. |
| `universe_waitlist_due()` | misma migración | Reclama lo vencido con un arriendo de diez minutos, para que dos ejecuciones no escriban dos veces a la misma persona. |
| `supabase/functions/waitlist-mailer/` | Edge Function | Vacía la cola llamando a Resend y atiende el enlace de baja. |
| `emails.es.ts` y `emails.va.ts` | misma carpeta | Los ocho textos de cada idioma. Cambiarlos no toca la base de datos. |

## Puesta en marcha

1. **Aplica las migraciones** `202609240021_waitlist_sequence.sql`, `202609240022_waitlist_full_sequence.sql`, `202609240023_early_coins.sql` y `202609240024_waitlist_service_grants.sql`, en ese orden, en el SQL Editor. La 022 completa la secuencia de quien ya estuviera apuntado; la 023 es la que hace real el saldo extra que promete la portada. Añade columnas a `universe_waitlist`, que ya tiene filas: no las borra ni las reprograma. Las personas apuntadas antes de aplicarla no reciben la secuencia; si quieres incluirlas, al final de este documento está el SQL.

2. **Guarda los secretos de la función** (Project Settings → Edge Functions → Secrets, o por consola):

   ```bash
   supabase secrets set RESEND_API_KEY=re_...
   supabase secrets set WAITLIST_CRON_SECRET="$(openssl rand -hex 32)"
   supabase secrets set WAITLIST_FROM="Entreclases <avisos@entreclases.com>"
   supabase secrets set WAITLIST_REPLY_TO="hola@entreclases.com"
   supabase secrets set WAITLIST_SITE_ORIGIN="https://www.entreclases.com"
   supabase secrets set WAITLIST_UNSUBSCRIBE_URL="https://<ref>.supabase.co/functions/v1/waitlist-mailer"
   ```

   `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los pone Supabase solo. Ninguno de estos valores va en Vercel.

3. **Despliega la función sin verificación de JWT**, porque el enlace de baja se abre desde una bandeja de entrada y nadie lleva un token encima:

   ```bash
   supabase functions deploy waitlist-mailer --no-verify-jwt
   ```

   El `POST` se protege por su cuenta con `WAITLIST_CRON_SECRET`; sin esa cabecera responde 403.

   **Sin línea de comandos:** `node scripts/bundle-waitlist-mailer.mjs` pliega los cinco módulos en `output/waitlist-mailer.index.ts`, que se pega en Edge Functions → Deploy a new function → Via Editor, con el nombre `waitlist-mailer`. En los ajustes de la función, desactivar **Verify JWT**: es lo mismo que `--no-verify-jwt`, y sin ello el enlace de baja responde 401 desde cualquier bandeja de entrada. El archivo generado no se versiona; la fuente sigue siendo la carpeta.

4. **Programa el reloj.** Activa `pg_cron` y `pg_net` (Database → Extensions) y ejecuta una vez, sustituyendo las dos constantes:

   ```sql
   select cron.schedule('waitlist-mailer', '* * * * *', $$
     select net.http_post(
       url := 'https://<ref>.supabase.co/functions/v1/waitlist-mailer',
       headers := '{"content-type":"application/json","x-waitlist-secret":"<el mismo secreto>"}'::jsonb,
       body := '{}'::jsonb,
       timeout_milliseconds := 60000
     );
   $$);

   El tiempo de espera es de un minuto porque la función envía los correos uno a uno y responde al terminar; con los cinco segundos por defecto de `pg_net` un lote grande se cortaría a medias.
   ```

   Cada minuto, no cada nueve de la mañana: así la bienvenida sale casi al instante y las mañanas salen a su hora aunque un envío falle. Si la cola está vacía la función responde y no hace nada.

5. **Comprueba el recorrido completo** con una dirección tuya: apúntate en la portada, mira que llega la bienvenida, abre el enlace de baja del pie y confirma que sales. Después, en el SQL Editor:

   ```sql
   select step, send_after, sent_at, attempts, last_error
   from public.universe_waitlist_emails q
   join public.universe_waitlist w on w.id = q.waitlist_id
   where w.email = 'tu@correo' order by step;
   ```

## Si no llega

`supabase/diagnostico-correos.sql` recorre las diez etapas, de la migración al envío, y marca la primera que falla con lo que hay que hacer. Pegarlo entero en el SQL Editor. Para llamar a la función a mano y ver su respuesta sin esperar al cron:

```bash
curl -s -X POST "https://<ref>.supabase.co/functions/v1/waitlist-mailer" \
  -H "x-waitlist-secret: <el secreto>" -H "content-type: application/json" -d '{}'
```

Responde `{"sent":N,"failed":[...]}`; cada fallo lleva el motivo que devolvió Resend.

## La baja

Cada correo lleva un enlace propio y las cabeceras `List-Unsubscribe`, que es lo que miran Gmail y Outlook antes de decidir si eres spam. Darse de baja detiene todo lo que quedara pendiente; la cola se conserva como prueba de qué se envió y cuándo.

El enlace apunta al dominio de la función. Si lo prefieres en `entreclases.com`, añade una reescritura de `/baja` en Vercel y cambia `WAITLIST_UNSUBSCRIBE_URL`. No está puesta: tocar el despliegue de la web para esto no compensa hasta que esté todo lo demás funcionando.

## Lo que hay que saber antes de encenderlo

- **Aceptar direcciones es prometer que escribirás.** La bienvenida dice «te voy a escribir siete mañanas». Si el cron no está programado, esa frase es mentira. Enciende los dos a la vez.
- **No hay correo del día de la apertura para todos.** La secuencia es personal y cada uno la recorre desde su propia alta. El aviso del 28 por la mañana a toda la lista es un envío aparte que todavía no está montado.
- **El saldo extra lo concede la base de datos, no el correo.** Quien se apuntó antes de `opens_at` recibe 30 ClasiCoins además de las 20 de bienvenida la primera vez que se le crea el monedero. Sin la migración 023 la portada promete algo que no ocurre.
- **El tratamiento sigue sin estar en la política de privacidad.** Punto 9 de `docs/legal/PENDIENTES-TITULAR.md`.

## Incluir a quien se apuntó antes de la migración

```sql
insert into public.universe_waitlist_emails(waitlist_id, step, send_after)
select w.id, 0, now()
from public.universe_waitlist w
where w.unsubscribed_at is null
  and not exists (select 1 from public.universe_waitlist_emails q where q.waitlist_id = w.id)
on conflict do nothing;
```

Eso les manda la bienvenida y nada más. Si además quieres la secuencia entera, repite el `insert` para los pasos 1 a 7 calculando `send_after` desde hoy, no desde su fecha de alta.
