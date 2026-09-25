# Seguridad de producción

Esta aplicación usa Next.js estático, Vercel y Supabase. La seguridad de los datos la aplica Supabase; las rutas /app, /demo y /backoffice no son una frontera de autorización por sí mismas.

## Antes de desplegar

1. Ejecuta en Supabase, una sola vez y en orden, la migración supabase/migrations/202609260029_waitlist_hardening.sql.
2. Comprueba que el formulario de lista de espera responde correctamente y que un anon no puede ejecutar:

   ~~~sql
   insert into public.universe_waitlist(email) values ('prueba@example.com');
   ~~~

   Debe devolver permission denied.
3. Comprueba que el RPC público sí funciona:

   ~~~sql
   select public.universe_join_waitlist('prueba@example.com', 'es', 'landing');
   ~~~
4. Despliega el proyecto para activar vercel.json.
5. En Vercel solo deben existir como variables públicas NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY y la bandera de Auth. Una service_role nunca lleva el prefijo NEXT_PUBLIC_.
6. Las claves de Resend y cualquier secreto de funciones deben vivir en Supabase Edge Functions o variables server-only.

## Controles incluidos

- Cabecera CSP, HSTS, X-Frame-Options, nosniff, política de referer y permisos del navegador.
- Backoffice y demo marcados como noindex.
- CORS de páginas restringido al dominio principal.
- Registro de espera mediante función security definer, sin INSERT anónimo directo.
- Límite global de 60 altas por minuto y 1.000 por día.
- Duplicados respondidos de forma indistinguible.
- Honeypot y espera mínima de 15 segundos en el formulario.
- RLS y funciones de backoffice con roles separados.
- Auditoría completa de npm sin vulnerabilidades conocidas.
- Build y pruebas automatizadas obligatorias.

## Mantenimiento

En cada despliegue ejecuta:

~~~bash
npm ci
npm audit
npm run lint
npm run build
node --experimental-strip-types --test tests/*.test.mjs
~~~

La protección antiabuso debe complementarse con monitorización de Supabase/Vercel y, si la campaña recibe mucho tráfico, Cloudflare Turnstile o un límite adicional en el edge.
