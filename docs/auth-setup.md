# Activar las cuentas de Entreclase

La configuración local apunta al proyecto `avngidebyxsliavjkfvp`. El 9 de septiembre de 2026 se comprobó que la URL y la clave pública funcionan, el acceso por email está habilitado y la confirmación de correo es obligatoria. Faltan las tablas de Entreclase en el proyecto remoto. No se han creado cuentas ni enviado correos reales.

El interruptor `NEXT_PUBLIC_SUPABASE_AUTH_ENABLED=false` mantiene el acceso en preparación mientras se instala la base de datos. Solo ponerlo en `true` después de completar los pasos de esta guía. La clave pública permite usar las API, pero no aplicar migraciones ni administrar Auth.

Para repetir el diagnóstico sin leer registros de usuarios: `npm run supabase:check`. Para regenerar el archivo de instalación inicial: `npm run supabase:prepare`. El resultado, `supabase/setup.sql`, reúne las cinco migraciones dentro de una transacción y rechaza una instalación existente. Ejecutarlo en el SQL Editor del proyecto dedicado, o aplicar las migraciones por separado; no hacer ambas cosas.

## Arquitectura de esta aplicación

Entreclase usa la exportación estática de Next.js. El cliente compartido de `lib/auth/client.ts` conecta todos los formularios y la comunidad con `@supabase/supabase-js`; conserva PKCE, la persistencia y la renovación automática de sesiones. Los permisos se comprueban en PostgreSQL mediante las funciones y políticas RLS existentes.

Se ha instalado también `@supabase/ssr`, como se solicitó. Sus helpers de servidor y Proxy requieren peticiones atendidas por un servidor Next.js y no son compatibles con `output: "export"`. No se añade un middleware que no vaya a ejecutarse ni se reemplaza la portada por el ejemplo de la tabla `todos`. Una futura migración a SSR debe cambiar el alojamiento, crear clientes por petición, validar la identidad y propagar las cookies renovadas.

## 1. Proyecto y control universitario

Usar un proyecto de Supabase dedicado a Entreclase. Ejecutar, en ese orden, `supabase/migrations/202609090001_university_auth.sql` y `supabase/migrations/202609090002_valencia_launch.sql` en su SQL Editor. Para la aplicación interior, continuar con las migraciones `202609090003_community.sql`, `202609090004_community_storage.sql` y `202609090005_unicoins.sql`, descritas en [la guía de comunidad](community-setup.md). La migración crea una lista de dominios, un hook de registro, un trigger que también bloquea cambios a correos no admitidos y una función para leer únicamente la cuenta verificada del usuario actual.

La lista empieza sin dominios activos y bloquea todos los registros. Añadir solo dominios institucionales contrastados con la universidad. Coincidencia exacta: un dominio principal no aprueba automáticamente sus subdominios. No conceder acceso por acabar en “.edu” ni por metadatos del perfil.

Ejemplo que hay que sustituir por datos institucionales verificados:

```sql
insert into public.universe_university_domains (domain, university_name, enabled, launch_region)
values ('dominio-universitario-verificado.es', 'Nombre de la universidad', true, 'valencia');
```

Activar `public.universe_before_user_created` en Authentication → Hooks → Before User Created. La función RPC `universe_current_member` exige una identidad autenticada, un correo confirmado en `auth.users` y un dominio activo revisado para el lanzamiento en Valencia. Solo devuelve los datos de `auth.uid()`. No existen contraseñas ni permisos en el almacenamiento propio de la landing.

Para retirar un dominio, cambiar `enabled` a `false`. La comprobación del servidor deja de dar acceso incluso a usuarios con una sesión anterior. Las tablas de la comunidad implementan RLS que comprueba identidad y pertenencia vigente, además de la pantalla de login.

## 2. Correo y contraseñas

En Authentication, activar Email y **Confirm email**; mantener desactivados los accesos anónimos y los proveedores no usados. Establecer un mínimo de 12 caracteres. La confirmación por correo es obligatoria: no desactivarla para facilitar una prueba.

Configurar el envío de correo para los estudiantes que deban registrarse. Los límites y destinatarios permitidos dependen del servicio de correo configurado en Supabase.

URL del sitio:

`https://universe-landing.shironecocrazy.chatgpt.site`

Autorizar exactamente estos destinos:

- `https://universe-landing.shironecocrazy.chatgpt.site/verificar/`
- `https://universe-landing.shironecocrazy.chatgpt.site/nueva-contrasena/`

Copiar las plantillas de `supabase/email-templates/` en Confirm signup y Reset password. El enlace lleva el token en el fragmento y la página lo verifica después de pulsar un botón; así puede abrirse en otro dispositivo y los escáneres de enlaces no lo consumen al cargar la página. Los enlaces por defecto con PKCE también se admiten, pero deben abrirse en el navegador donde se solicitaron.

El SDK gestiona las sesiones y su renovación. Las contraseñas se envían exclusivamente a Supabase; no se guardan en localStorage, sessionStorage ni logs de Entreclase. Los tokens de sesión usan el almacenamiento estándar del SDK. La función del servidor, no esos datos locales, concede acceso.

## 3. Configuración pública del frontend

Copiar `.env.example` a `.env.local` y añadir:

- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto dedicado.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: clave publicable, o la antigua clave `anon`.
- `NEXT_PUBLIC_SUPABASE_AUTH_ENABLED`: `true` únicamente tras completar migraciones, dominios y correo; `false` durante la preparación.

No usar `service_role`, `sb_secret_`, la contraseña de Postgres ni una clave del proveedor de correo. La configuración del frontend es pública.

Al ser una exportación estática de Next.js, estas variables se incorporan al compilar. Después de configurarlas hay que volver a construir y publicar el sitio. Cambiar solo variables de ejecución del alojamiento no modifica un archivo JavaScript ya compilado.

## 4. Comprobación de activación

Ejecutar `npm run test:auth` y `npm run build`. Antes de abrir cuentas reales, comprobar contra el proyecto conectado:

1. Un correo personal y un dominio no aprobado se rechazan también llamando a Auth directamente.
2. Una cuenta recién creada no puede obtener su perfil hasta confirmar el correo.
3. El enlace se usa una vez; uno caducado permite solicitar otro.
4. Login, nueva contraseña, recarga de la cuenta y cierre de sesión funcionan.
5. Otro usuario no obtiene la cuenta del primero y un dominio desactivado pierde acceso.

Esta entrega tiene pruebas locales de validación y del control de acceso ejecutadas sobre PostgreSQL en memoria. No sustituye una comprobación con correos reales del proyecto conectado. No se realizó prueba de navegador en este entorno.

El sitio sigue teniendo la audiencia privada configurada por su propietario. Crear cuentas de Entreclase no cambia esa audiencia; el acceso a estudiantes externos requiere configurar expresamente la publicación o compartir el sitio.

## Referencias de la integración

- [Hook de Supabase para restringir registros](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)
- [Confirmación y registro](https://supabase.com/docs/reference/javascript/auth-signup)
- [Plantillas de correo](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Recuperación de contraseña](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail)

## Lanzamiento en Valencia y dos idiomas

El ámbito inicial son las universidades de Valencia, públicas y privadas. Las menciones a los campus de Blasco Ibáñez, Tarongers y Vera sitúan el lanzamiento; no implican acuerdos con esas instituciones.

Después de la primera migración, aplicar `supabase/migrations/202609090002_valencia_launch.sql`. Los dominios que ya existieran quedan sin región asignada y no dan acceso hasta revisarlos. El hook, el trigger y la lectura de cuenta exigen simultáneamente `enabled = true` y `launch_region = 'valencia'`. La región de un perfil o su idioma no conceden permisos.

La migración prepara `alumni.uv.es`, dominio de estudiantes documentado por la [Universitat de València](https://www.uv.es/uvweb/filologia-traduccion-comunicacion/es/facultad/secretaria/tramites-procedimientos/consultas-1285960482280.html), y lo deja desactivado hasta la apertura. Para habilitarlo tras revisar el proyecto:

```sql
update public.universe_university_domains
set enabled = true, launch_region = 'valencia'
where domain = 'alumni.uv.es';
```

Añadir los dominios exactos de las demás universidades después de contrastarlos, indicando `launch_region = 'valencia'`. No se han supuesto dominios de estudiantes de UPV ni de las universidades privadas. Para instituciones con sedes en varias provincias, revisar si el correo distingue el campus; un dominio compartido no demuestra por sí solo que la persona estudie en Valencia. No habilitarlo como exclusivo de Valencia sin esa revisión o una comprobación adicional.

Autorizar también estos dos destinos de correo:

- `https://universe-landing.shironecocrazy.chatgpt.site/va/verificar/`
- `https://universe-landing.shironecocrazy.chatgpt.site/va/nova-contrasenya/`

Para probar en este equipo, autorizar además estos destinos exactos de desarrollo:

- `http://127.0.0.1:3000/verificar/`
- `http://127.0.0.1:3000/nueva-contrasena/`
- `http://127.0.0.1:3000/va/verificar/`
- `http://127.0.0.1:3000/va/nova-contrasenya/`

Si se accede usando `localhost` en vez de `127.0.0.1`, añadir los mismos cuatro destinos con ese host. Usar siempre el mismo origen durante la prueba de PKCE. Los destinos de producción deben corresponder al alojamiento real; no configurar `entreclase.com` antes de registrar y conectar ese dominio.

Las plantillas incluyen español y valenciano y usan `.Data.locale`, que se guarda al registrarse. Una cuenta sin ese dato recibe español. Los correos de recuperación usan el idioma registrado en la cuenta; el enlace vuelve al idioma de la pantalla desde la que se pidió. Se puede usar un asunto bilingüe: `Entreclase · Confirma tu correo / Confirma el teu correu` y `Entreclase · Recuperar el acceso / Recuperar l’accés`.

El selector conserva exclusivamente los parámetros de una acción de correo pendiente al cambiar entre las rutas de verificación o de nueva contraseña. El fragmento no se envía al servidor. Se retira de la URL al pulsar el botón de confirmación, antes de consumir el enlace; no se copian tokens de sesión ni destinos externos. La variante PKCE usa la consulta y requiere el navegador de origen.

La preferencia de interfaz queda en la URL. No se impone el idioma del navegador ni se cambia la página después de cargarla: cada idioma se genera con su propio `html lang`, metadatos y enlaces. Los formularios sin enviar se reinician al cambiar de idioma; el selector no guarda contraseñas.

Después de iniciar sesión o confirmar el correo, el usuario llega a `/app/` o `/va/app/` y completa su perfil en el primer acceso. Las rutas de cuenta anteriores se mantienen y enlazan al campus.

Al completar el primer perfil, el servidor concede 20 ClasiCoins de bienvenida. Volver a iniciar sesión o editar el perfil no concede otra bienvenida. Ver [reglas y activación de ClasiCoins](unicoins.md).
