# Entreclases: aplicación de la comunidad

La aplicación está implementada en Next.js, en `/app/` y `/va/app/`. Login y confirmación del correo llevan a ella. El primer acceso de una cuenta verificada pide completar el perfil. La configuración local de Supabase está comprobada, pero aún faltan las migraciones y la activación de dominios; el código de integración no activa por sí mismo cuentas reales.

La demo independiente está en `/demo/` y `/va/demo/`. Incluye perfiles y contenido ficticios, identificados en una franja persistente. Publicaciones, comentarios, me gusta, altas en grupos, planes, mensajes, perfil y archivos funcionan dentro de esa visita. Los datos están solo en memoria, no se comparten ni se conservan al recargar, salir o cambiar de idioma. No usa el servicio de autenticación ni genera respuestas de personas ficticias. Los apuntes precargados se descargan como TXT de ejemplo; se puede probar también la subida de un PDF propio.

## Datos reales y autorización

Seguir primero [la configuración de acceso](auth-setup.md). En el proyecto Supabase dedicado, aplicar las migraciones en orden:

1. `202609090001_university_auth.sql`
2. `202609090002_valencia_launch.sql`
3. `202609090003_community.sql`
4. `202609090004_community_storage.sql`
5. `202609090005_unicoins.sql`

Las migraciones de comunidad y Storage crean perfiles, publicaciones, comentarios, reacciones, grupos y miembros, planes y asistentes, apuntes, conversaciones y mensajes. No insertan contenido ni personas de demostración en la base de datos. El bucket `universe-notes` es privado, limitado a PDF de 10 MB. Después, revisar los dominios institucionales de Valencia, habilitar los que correspondan, configurar confirmación y entrega de correo e incorporar la URL y clave pública al compilar. Mantener el control universitario del servidor y las políticas RLS.

La autorización comprueba siempre `auth.uid()`, el correo confirmado real de `auth.users` y la lista de dominios revisados para Valencia. La universidad del perfil se deriva en servidor. El campus, intereses, nombre y carrera son datos declarados, no permisos. Una sesión de ChatGPT o entrar en la demo no otorga acceso a estas tablas. Ante un error de conexión, la aplicación real muestra el error; no se sustituye por datos de ejemplo.

- El muro y los grupos son legibles por la comunidad universitaria verificada. Publicar en un grupo exige ser miembro. Las publicaciones propias se pueden eliminar junto con sus comentarios y reacciones.
- Las inscripciones a planes pasan exclusivamente por `universe_set_plan_attendance`, que bloquea la fila del plan durante el recuento e inserción. Incluye al organizador, es idempotente y rechaza planes pasados o completos. El organizador puede cancelar el plan.
- Las conversaciones se abren con `universe_open_thread`, que valida la otra cuenta. Solo sus dos participantes pueden leer el hilo y escribir mensajes mediante la app. No se promete cifrado de extremo a extremo.
- Los archivos se suben a una carpeta del autor. Las descargas usan enlaces firmados de 60 segundos. La eliminación pasa por la API de Storage para retirar los bytes y después elimina la ficha. Si falla la segunda parte, la pantalla indica que hay que repetir la eliminación. No se elimina `storage.objects` directamente por SQL.

## Alcance de esta primera versión

Se cargan las 80 publicaciones recientes, 100 grupos, 100 planes recientes o futuros, 100 apuntes, 100 conversaciones y 200 perfiles recientes, más los perfiles referenciados. Las relaciones del contenido cargado se paginan de 500 en 500 para evitar truncar recuentos por el límite de filas de Supabase. La búsqueda filtra el contenido cargado; aún no hay búsqueda global ni paginación del historial completo. Los hilos muestran los últimos 100 mensajes y consultan cambios cada 10 segundos mientras la pestaña está visible. No hay presencia en línea ni respuestas automáticas.

Los horarios de bibliotecas enlazan a la fuente oficial; no se anuncian aforo, disponibilidad ni aperturas en tiempo real. Los planes enlazan a una búsqueda del lugar en Google Maps y muestran por separado el punto de encuentro escrito por el organizador. Las fechas se introducen en la zona del dispositivo y se muestran en la de Valencia (Europe/Madrid).

Esta entrega no incluye push, moderación administrativa, bloqueo de usuarios ni borrado completo de cuenta. Antes de una apertura pública habrá que concretar esas operaciones y comprobar los flujos con el backend y correo reales. Una aplicación con archivos también necesitará una operación administrativa de limpieza de objetos huérfanos, por ejemplo cuando un administrador elimina una cuenta directamente desde Auth. No convertir el bucket en público para resolver permisos.

## Verificación realizada

`npm run test:auth` ejecuta las pruebas de acceso existentes y las nuevas pruebas de comunidad. PostgreSQL en memoria comprueba RLS, autoría, revocación, privacidad de conversaciones, propiedad de archivos, inscripción idempotente y límite de plazas. Las pruebas de demo comprueban aislamiento por visita, mutaciones, conversación sin respuestas inventadas, PDF y descarga con contenido real. No prueban el servicio Storage alojado ni envío de correos. Se compila Next.js y se verifica la exportación estática. No se ha utilizado un navegador para QA visual o de interacción.

Referencias: [RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [buckets privados](https://supabase.com/docs/guides/storage/buckets/fundamentals), [descarga de objetos](https://supabase.com/docs/guides/storage/serving/downloads), [acceso a Storage](https://supabase.com/docs/guides/storage/security/access-control).

## ClasiCoins

El saldo interno de ClasiCoins incentiva la participación y nunca se compra ni se convierte en dinero. Crear un evento cuesta 10 y abrir un hilo del muro cuesta 5; se reciben 20 al completar el primer perfil verificado. La primera inscripción en un evento ajeno da 3 y la primera respuesta en otro hilo da 2, con límites diarios. Las reglas completas, la protección del saldo y la activación están en [ClasiCoins](unicoins.md).
