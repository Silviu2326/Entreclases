# Tu +1

Una cuenta universitaria puede dar acceso a una persona que no estudia en la universidad. Esa persona confirma su propio correo y participa con una cuenta independiente, pero no puede crear invitaciones.

## Dónde se encuentra

En **Mi perfil → Tu +1**, justo debajo de la presentación del perfil. Disponible en castellano y valenciano.

Para desbloquearla: correo universitario confirmado, perfil con biografía y al menos un interés, y alguna publicación, respuesta o inscripción en un plan.

El propietario escribe el correo del destinatario, crea la invitación y copia el enlace para compartirlo. La aplicación no envía un mensaje al destinatario. El enlace dura siete días y solo sirve con el correo elegido.

La invitación pendiente se puede cancelar. Cancelar o dejar caducar permite generar un nuevo enlace, pero el anterior deja de funcionar. Una invitación utilizada consume la plaza para siempre; borrar la cuenta invitada no devuelve la plaza. El creador no puede expulsar al invitado anulando una invitación utilizada.

## Registro y acceso

- El enlace abre `/registro/#plus-one=TOKEN` o `/va/registre/#plus-one=TOKEN`.
- El formulario admite el correo personal cuando lleva la invitación; la comprobación decisiva se hace en Supabase.
- La invitación queda consumida cuando se crea la cuenta, incluso si aún falta confirmar el correo. Para repetir el correo de confirmación se usa «Pedir otro enlace»; no se necesita otra invitación.
- Hasta confirmar el correo no hay acceso a la comunidad.
- El perfil invitado muestra «Acceso por invitación», permite indicar trabajo o estudios y no exige curso universitario.
- Puede participar y abrir chats privados. No puede crear otra invitación, aunque modifique peticiones o metadatos.
- Si posteriormente su correo confirmado en Auth pasa a ser de un dominio universitario admitido, la comprobación de acceso lo reconoce como universitario. Esta entrega no añade una pantalla para cambiar el correo.

## Activación en Supabase

El código de la web no puede instalar SQL con la clave pública. En un proyecto que ya tiene las migraciones anteriores, ejecutar **solo** `supabase/migrations/202609200014_plus_one.sql` en una transacción, como propietario de la base de datos. No ejecutar `supabase/setup.sql` sobre una instalación existente.

La migración conserva el nombre del hook `public.universe_before_user_created` y el trigger de Auth: sustituye su lógica para aceptar dominios aprobados o una invitación válida. Mantener activada la confirmación de correo en Supabase Auth y los destinos de confirmación `/verificar/` y `/va/verificar/`.

Mientras la migración no esté aplicada, el perfil real muestra que Tu +1 no está activado, y el registro universitario existente continúa funcionando. No se ha aplicado SQL remoto desde esta entrega.

## Seguridad

La tabla `universe_plus_one` no permite lectura ni escritura directa a usuarios anónimos o autenticados. Las funciones autorizadas obtienen el propietario de `auth.uid()`, sin aceptar un identificador elegido por el cliente. La reclamación de un enlace es atómica y se revierte si falla la creación de la cuenta.

Los enlaces se guardan en el fragmento de la URL para que el token no viaje en la petición de la página. Se retira de los metadatos al crear la cuenta. Los metadatos editables nunca conceden acceso universitario.

El registro conserva un identificador del invitador y del invitado para impedir que borrar cuentas permita reciclar plazas. No hay una relación pública que revele quién invitó a quién. Al retirar una cuenta, el operador debe contemplar estos registros en su proceso de conservación o anonimización.

## Pruebas

`node --experimental-strip-types --test tests/plus-one-policy.test.mjs`

Ejecuta PostgreSQL local con PGlite: requisitos, permisos, reclamación por correo, bloqueo de reutilización, confirmación obligatoria, chats de invitados, cancelación, caducidad, borrado y ascenso a universitario por correo confirmado.

En `/demo/?view=profile` el enlace lleva `preview=1`: permite recorrer el formulario sin enviar correos ni crear cuentas reales. No concede acceso al backend. La invitación de demo solo se conserva en esa pestaña.

### Comprobación de esta entrega

| Comprobación | Resultado |
| --- | --- |
| `node --experimental-strip-types --test tests/plus-one-policy.test.mjs` | 8 pruebas superadas |
| ESLint del panel, formulario y utilidades de invitación | Sin errores |
| Navegador: crear enlace → registro de prueba → volver al perfil | Correcto; sin crear cuentas ni enviar correos |
| Vista de escritorio y móvil de 390 px | Panel legible, sin desbordamiento horizontal |
| Comprobación general de TypeScript y compilación | Bloqueada por errores en los minijuegos que se estaban modificando en paralelo |
| Supabase remoto | La función de invitaciones no está instalada; activación pendiente |
