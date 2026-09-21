# Correos de Entreclase con Resend

## Estado comprobado

Revisión del 20 de septiembre de 2026: `npm run supabase:check` conecta con el proyecto configurado, confirma que Auth por email está habilitado y exige confirmar el correo. El acceso del frontend está activado y las tablas comprobadas existen. Este diagnóstico usa la clave pública: no permite consultar la configuración privada de SMTP ni acreditar la entrega.

El registro, el reenvío de confirmación y la recuperación llaman a Supabase Auth desde `components/entreclase/auth-form.tsx` y `email-verification.tsx`. Supabase genera los tokens y puede entregar esos mensajes mediante Resend SMTP. La web es una exportación estática; esta integración no requiere instalar el SDK de Resend ni añadir su clave al frontend.

La clave de Resend está configurada solo en el entorno local. No se ha configurado Resend remotamente, no se ha conectado todavía el SMTP de Supabase y no se ha enviado ningún correo de prueba.

## Configuración pendiente

1. En Resend, verificar un dominio propio instalando exactamente los registros DNS que muestre su panel. Elegir una dirección remitente de ese dominio y crear una clave con permiso de envío para él.
2. En el proyecto de Supabase, abrir **Authentication → Email → SMTP Settings**, activar SMTP personalizado y guardar:

| Campo | Valor |
| --- | --- |
| Sender name | `Entreclase` |
| Sender email | La dirección elegida del dominio verificado |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | La API key de Resend |

La clave se guarda en Supabase, nunca en variables `NEXT_PUBLIC_*`, código cliente, repositorio ni mensajes de chat. Si hay un hook **Send Email** activo, revisar su configuración: puede sustituir el transporte SMTP. El hook **Before User Created** de Entreclase controla las altas y debe mantenerse.

3. Desactivar el seguimiento de enlaces en Resend para que no reescriba los enlaces de autenticación. Mantener **Confirm email** activado. Revisar los límites de envío en Supabase y Resend antes de probar reenvíos.
4. En **Email Templates**, copiar `supabase/email-templates/confirm-signup.html` en **Confirm signup** y `reset-password.html` en **Reset password**. Asuntos sugeridos: `Entreclase · Confirma tu correo / Confirma el teu correu` y `Entreclase · Recuperar el acceso / Recuperar l’accés`.
5. En **URL Configuration**, usar el origen real del sitio como Site URL y autorizar las siguientes rutas bajo ese mismo origen:

   - `/verificar/`
   - `/nueva-contrasena/`
   - `/va/verificar/`
   - `/va/nova-contrasenya/`

Para pruebas locales, autorizar también esas rutas bajo `http://localhost:3000` o `http://127.0.0.1:3000`, según el host utilizado. Las plantillas usan `.RedirectTo`, `.TokenHash` y los tipos `email` o `recovery`, que la aplicación ya reconoce. No cambiar el dominio publicado por uno inventado.

## Comprobar la entrega completa

Con un buzón de prueba controlado por el propietario:

1. Registrarse con un correo admitido por las reglas de Entreclase (universitario habilitado o invitación +1 válida). Confirmar que la petición no devuelve un error de Auth y que Resend registra el mensaje.
2. Comprobar el evento de entrega en Resend y la recepción real en el buzón, incluida la carpeta de spam. Una respuesta correcta del formulario o un evento de envío no acredita por sí solo la recepción.
3. Abrir el enlace, pulsar el botón de confirmación y comprobar que se obtiene acceso. Probar también el idioma valenciano y que el enlace ya consumido no vuelve a dar acceso.
4. Con una cuenta de prueba pendiente, solicitar otro enlace tras el intervalo permitido.
5. Con una cuenta de prueba existente, solicitar recuperación, recibir el mensaje y completar el cambio de contraseña. Usar una cuenta de prueba porque este paso modifica su acceso.

Si Resend no registra el correo, revisar los logs de Auth de Supabase, SMTP, hooks y límites. Si Resend registra un rebote o supresión, revisar el motivo indicado y el dominio remitente. Si se entrega pero el enlace falla, revisar las plantillas, los destinos autorizados y el seguimiento de enlaces.

Las invitaciones de grupos y de +1 actualmente generan enlaces para compartir manualmente; configurar SMTP no las convierte en correos automáticos. Requerirían un envío transaccional adicional desde un backend.

## Documentación oficial

- [Resend SMTP con Supabase](https://resend.com/docs/send-with-supabase-smtp)
- [SMTP personalizado de Supabase](https://supabase.com/docs/guides/auth/auth-smtp)
- [Plantillas y seguimiento de enlaces](https://supabase.com/docs/guides/auth/auth-email-templates)

## Configuración de Entreclase

Para `entreclases.com` se usará un remitente único para mantener una identidad reconocible y simplificar la verificación del dominio:

- Remitente general: `hola@entreclases.com`
- Invitaciones +1: `invitaciones@entreclases.com`
- Avisos: `avisos@entreclases.com`
- Seguridad, confirmación y recuperación: `seguridad@entreclases.com`
- Nombre visible: `Entreclase`
- Responder a: `hola@entreclases.com`
- Cada flujo usa su dirección para que el propósito sea reconocible.
- Recuperación y confirmación de cuenta: las gestiona Supabase Auth a través del SMTP de Resend.

Las variables locales son `RESEND_API_KEY`, `RESEND_FROM_NAME`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO`, `RESEND_INVITES_FROM_EMAIL`, `RESEND_NOTIFICATIONS_FROM_EMAIL` y `RESEND_SECURITY_FROM_EMAIL`. La clave está en `.env.local`, que queda fuera del repositorio. Nunca debe aparecer en `NEXT_PUBLIC_*`, en componentes React ni en una plantilla enviada al navegador.

La aplicación actual genera el enlace de invitación +1 para compartirlo manualmente. El envío automático de esa invitación y de avisos requerirá un endpoint de servidor o una función de Supabase que use `RESEND_API_KEY`; no se debe llamar a Resend directamente desde el navegador.