# Prelanzamiento del 28 de septiembre de 2026

Hora elegida por defecto: **00:00 Europe/Madrid**, equivalente a **27/09/2026 22:00 UTC**. Puede modificarse antes de publicar la campaña. Se trata de la apertura de cuentas de Valencia; Madrid sigue cerrado.

## Experiencia preparada

- Cuenta atrás visible al principio de la portada en español y valenciano, con días, horas, minutos y segundos.
- Fecha legible aunque JavaScript no se ejecute; el reloj comienza tras hidratar para evitar discrepancias de la exportación estática.
- Acceso a la demo, descarga de calendario y botón de copiar enlace. No se envían correos ni mensajes a nadie, ni se anuncian cifras ficticias.
- Antes de abrir, las llamadas al registro llevan a la demo o a la información de lanzamiento. /registro/ y los enlaces +1 reales muestran el prelanzamiento. El recorrido de invitación demo sigue disponible como demostración explícita, sin crear cuentas.
- No se recogen correos como supuesta lista de espera: el formulario de alta de la portada se sustituye durante el prelanzamiento. No hay promesa de avisos por correo sin un sistema real para enviarlos.
- Si llega la fecha y el servicio no está activado, aparece «Estamos dando el último repaso». No hay cifras negativas, reinicios del contador ni anuncios falsos de apertura.
- El acceso de las cuentas existentes permanece disponible desde el inicio de sesión.

## Publicar la campaña

1. Integrar la propuesta revisada y desplegar con `NEXT_PUBLIC_LAUNCH_OPEN=false`. Los textos legales siguen como borrador hasta aportar y validar la información pendiente.
2. Aplicar solo las migraciones pendientes de Supabase, incluida `202609220019_scheduled_launch.sql`. Esta migración bloquea nuevas cuentas con un trigger en auth.users; bloquea también altas directas, invitados y altas creadas por un administrador. No se basa en el reloj o metadatos del navegador. **No aplicarla si necesitas mantener abierto un registro ya operativo.** No limita el login, confirmación o recuperación de cuentas existentes.
3. Verificar que portada, demo, calendario y enlaces funcionan en el dominio público. El archivo de calendario marca la fecha como prevista y no incluye invitaciones a otras personas.

## Apertura

Antes: completar datos legales y operativa, verificar correo, dominios universitarios, RLS, invitaciones y migraciones. No usar el contador como sustituto de esas comprobaciones.

Cuando esté todo preparado, habilitar el interruptor del servidor (se puede programar antes del día 28; la fecha sigue siendo obligatoria):

```sql
update public.universe_signup_launch set enabled=true where id=true;
```

Desplegar la web con `NEXT_PUBLIC_LAUNCH_OPEN=true` y `NEXT_PUBLIC_SUPABASE_AUTH_ENABLED=true` junto con la configuración válida de Supabase. Aunque los indicadores estén activados, la interfaz y el servidor esperan a la fecha. Las variables públicas quedan incluidas en la compilación: cambiar su valor requiere volver a desplegar. Una pestaña que cargó una versión anterior debe recargarse.

Mantener ambos lados coordinados. Si el servidor sigue desactivado, rechazará altas incluso si la interfaz anuncia apertura. La comprobación del cliente es informativa; el servidor es la autoridad. El proveedor puede devolver un error genérico de alta si el trigger bloquea la petición.

## Cambiar la fecha u hora

Actualizar `lib/launch/config.ts`, las menciones de «el 28 / 00:00» de `launch-campaign.tsx` y `auth-form.tsx`, la fecha de la migración 019 si aún no se ha aplicado (si ya se aplicó, modificar la fila mediante una nueva migración), y las pruebas. Regenerar el calendario con:

```bash
node --experimental-strip-types scripts/prepare-launch-calendar.mjs
npm run supabase:prepare
```

Regenerar no aplica SQL al servidor. Nunca ejecutar `setup.sql` sobre una instalación existente.

## Secuencia de comunicación propuesta

| Día | Contenido | Acción |
| --- | --- | --- |
| 21–22 | Presentación: qué es Entreclases y por qué empieza en Valencia | Ver la demo |
| 23 | Un recorrido corto por planes, grupos y apuntes | Guardar la fecha |
| 24 | Explicar «una cuenta universitaria, una invitación para alguien de fuera» | Compartir el enlace con esa persona |
| 25 | Mostrar un proyecto y cómo encontrar compañeros | Explorar proyectos en la demo |
| 26 | Resolver acceso, privacidad y ClasiCoins | Consultar dudas |
| 27 | Recordatorio de la fecha y hora | Abrir el enlace de lanzamiento |
| 28 | Anunciar apertura solo tras comprobarla | Crear cuenta y proponer un primer plan |

Este calendario es una propuesta de publicación, no una automatización ni mensajes enviados. Preparar actividad real y comprobar el registro antes de anunciar que ya está abierto.
