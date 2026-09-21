# Entreclases

Comunidad universitaria y acceso por invitación, en español y valenciano, con Next.js, React y Supabase. Dominio canónico: https://www.entreclases.com. Los identificadores internos `universe_*` se conservan por compatibilidad.

La preparación del lanzamiento y los pasos pendientes de producción están en [la guía de lanzamiento](docs/lanzamiento.md). Madrid queda cerrado por defecto.

## Documentación legal

Las páginas legales están preparadas en ambos idiomas y se identifican como borrador hasta completar y validar los datos. Consulta [datos y decisiones pendientes del titular](docs/legal/PENDIENTES-TITULAR.md) y [procedimientos operativos](docs/legal/OPERACIONES.md).

## Prelanzamiento del 28 de septiembre

Cuenta atrás, calendario y control de nuevas altas: [configuración y apertura](docs/lanzamiento-28-septiembre.md). La fecha no abre el registro por sí sola; requiere activación del titular en web y servidor.

## Desarrollo

- `npm ci`
- `npm run dev`
- `npm run build` genera una exportación estática en `out/`.
- `npm start` sirve esa exportación en `http://localhost:3000`.
- `npm run lint` comprueba el código.
- `npm run test:auth` comprueba validación, enlaces y autorización en PostgreSQL en memoria.

No necesita variables de entorno para mostrar la landing. Mantiene las dependencias del proyecto de origen; el build de producción usa Next.js, no Vinext.

## Contenido

La portada prioriza la explicación del producto, una vista previa del campus, el lanzamiento en Valencia y el acceso universitario o por invitación personal. La historia empieza a las 14:07, mirando vidas ajenas, y termina a las 14:08, encontrando sitio en un plan del campus.

La sección de vida universitaria ofrece tres pestañas: apuntes y estudio, lugares y planes, y conocer gente. Se explica el acceso con correo universitario y se responden ocho dudas con acordeones nativos. El menú móvil permite recorrer las secciones, se cierra al elegir un enlace y admite la tecla Escape. El diseño es responsive y respeta las preferencias de movimiento reducido.

- `components/entreclase/landing-page.tsx`: composición y contenido compartido.
- `app/globals.css`: tokens, tipografía, maquetación y tamaños adaptables.
- `components/entreclase/campus-preview.tsx`: vista ilustrativa con pestañas y me gusta locales.
- `components/entreclase/campus-life.tsx`: tres situaciones de la vida universitaria con ejemplos interactivos.
- `components/entreclase/landing-sections.tsx`: acceso, preguntas frecuentes y desenlace de la historia.
- `components/entreclase/mobile-navigation.tsx`: navegación desplegable para móvil.
- `components/entreclase/signup-form.tsx`: formulario con validación.
- `app/(es)/` y `app/(va)/va/`: páginas y layouts raíz por idioma; seis pantallas de acceso en cada uno.
- `components/entreclase/auth-*.tsx`: diseño compartido y formularios de acceso.
- `lib/auth/`: integración con Supabase, mensajes y validación.
- `supabase/`: migración del control universitario y plantillas de correo.
- `docs/auth-setup.md`: pasos para conectar y activar cuentas reales.
- `public/images/`: fotografía generada para el diseño, optimizada en WebP.
- `public/fonts/`: tipografías servidas localmente.

## Estado del registro

Incluye landing, autenticación, comunidad, planes, grupos, apuntes, mensajes, proyectos y ClasiCoins.

El botón Entrar abre `/login/`. El registro está en `/registro/`, con nombre, correo universitario y contraseña. La entrada de correo de la landing lo lleva al registro mediante un borrador temporal en el navegador; no envía la dirección en la URL. Hay pantallas de verificación, reenvío, recuperación, nueva contraseña y cuenta con cierre de sesión.

**La configuración real depende del entorno; este cambio no aplica migraciones al servidor.** Sin su URL y clave pública, no se crean cuentas ni se envían correos: los formularios muestran el estado de apertura pendiente. La integración llama al proveedor real cuando se configura; no simula sesiones ni almacena contraseñas. La migración exige un dominio aprobado exacto y un correo confirmado en servidor. La regla de lanzamiento exige además una región Valencia revisada en servidor. La segunda migración prepara el dominio de estudiantes de la UV, desactivado; faltan la revisión y activación de los dominios admitidos. Ver [guía de activación](docs/auth-setup.md) para aplicar la migración, configurar el correo y recompilar con las variables públicas.

Las publicaciones, personas, cifras, conversaciones y planes de las vistas previas son ejemplos. Las vistas previas de la landing y la nueva demo interactiva usan contenido de ejemplo. El bloque de acceso, las preguntas frecuentes y el formulario explican que la apertura está en preparación.

## Diseño

Fondo crema, azul eléctrico, texto casi negro y subrayado lima. Titulares Inter, notas manuscritas Caveat, fotografía sin tintes superpuestos y controles HTML reales. La fotografía final retoma al grupo del inicio. En móvil las columnas se apilan, el formulario ocupa todo el ancho y se mantienen las diez secciones.

## Comprobaciones de esta entrega

El control de acceso tiene pruebas locales contra PostgreSQL en memoria: rechaza dominios falsos, universidades ajenas al lanzamiento, metadatos manipulados, cuentas sin verificar y cambios de correo no admitidos; limita la lectura al usuario actual y respeta la desactivación del dominio. La comprobación con cuentas y correos reales queda pendiente de aplicar las migraciones y configurar el correo. No se realizó una prueba visual ni de interacción en navegador en este entorno.

## Idiomas y rutas

El selector Español / Valencià aparece en la landing y en todas las pantallas de acceso. El copy, los ejemplos interactivos, las etiquetas y los errores se traducen desde `lib/i18n/`. Se mantiene el estilo directo y la historia del viernes. `components/entreclase/valencia-launch.tsx` presenta la primera etapa: «Primero, Valencia».

| Pantalla | Español | Valencià |
| --- | --- | --- |
| Landing | `/` | `/va/` |
| Registro | `/registro/` | `/va/registre/` |
| Login | `/login/` | `/va/iniciar-sessio/` |
| Verificación | `/verificar/` | `/va/verificar/` |
| Recuperación | `/recuperar-contrasena/` | `/va/recuperar-contrasenya/` |
| Nueva contraseña | `/nueva-contrasena/` | `/va/nova-contrasenya/` |
| Cuenta | `/mi-cuenta/` | `/va/el-meu-compte/` |

Las 14 páginas se exportan con contenido traducido y `lang="es"` o `lang="ca-ES-valencia"` desde la primera respuesta HTML. Las rutas públicas tienen enlaces alternativos entre idiomas; las de acceso siguen marcadas como no indexables. No se crean cookies de idioma. Las plantillas de correo son bilingües; aún requieren configurar el proveedor.

## Personalidad local

La historia del viernes empieza al salir de Tarongers y sigue con un plan en la Malvarrosa. El bloque «El algoritmo no baja al Turia» conecta el lanzamiento con Blasco Ibáñez, Tarongers y Vera. Cuatro escenas proponen un café en Benimaclet, una vuelta por el cauce desde las Torres de Serranos, una tarde en la Malvarrosa y un atardecer en l’Albufera. Son ideas ilustrativas, sin horarios de locales ni eventos anunciados. La adaptación al valenciano incluye también los topónimos Túria, Malva-rosa y Torres dels Serrans.

Se mantienen el titular inicial, el diseño aprobado y el selector de idioma. Las referencias locales también aparecen en los ejemplos de planes, conversaciones y pantallas de acceso.

Referencias de localización: [campus de la UV](https://www.uv.es/infrastructures/en/tarongers-campus/tarongers-campus.html), [campus de Vera de la UPV](https://www.upv.es/otros/como-llegar-upv/campus-vera/index-es.html), [Jardín del Turia](https://www.visitvalencia.com/en/what-to-see-valencia/turia-gardens), [Torres de Serranos](https://www.visitvalencia.com/en/what-to-do-valencia/valencian-culture/monuments-in-valencia/serranos-towers) y [l’Albufera](https://www.visitvalencia.com/que-ver-valencia/albufera-valencia).

## Movimiento de la landing

`LandingMotion` incorpora entradas por líneas en el titular, revelado de fotografía, subrayado lima y flecha dibujados, apariciones al recorrer las secciones y una línea discreta de progreso de lectura. Las escenas locales entran escalonadas. Las pestañas y las respuestas desplegables tienen transiciones breves; en dispositivos con ratón, las tarjetas, fotografías y botones responden al pasar por encima.

Las entradas son finitas y cada bloque se revela una vez por visita. El contenido ya existe y es visible en el HTML: no depende de JavaScript ni de que funcione el observador para poder leerse. Al restaurar una página desplazada o recibir JavaScript tarde, se evita repetir la entrada sobre el contenido ya alcanzado. La navegación por anclas y el foco del teclado cancelan entradas pendientes sobre su destino. Se respetan los cambios de `prefers-reduced-motion` durante la visita, y la impresión muestra todo sin efectos. No hay desplazamiento forzado, bucles continuos ni dependencias adicionales de animación.

La implementación conserva las páginas como componentes de servidor y pasa su contenido al contenedor de movimiento. Los eventos de desplazamiento solo actualizan la línea decorativa mediante `requestAnimationFrame`; no vuelven a renderizar el contenido de React. Las comprobaciones de esta actualización son de compilación y contenido estático; no se ha realizado una prueba de animación en navegador.

## Aplicación de la comunidad

El interior de Entreclase está en `/app/` y `/va/app/`. El login y la confirmación de correo redirigen a la aplicación. Incluye inicio con publicaciones, comentarios y reacciones; planes con inscripciones; grupos; apuntes descargables; gente; conversaciones privadas; y perfil editable. La primera entrada completa el perfil.

La demo navegable está en `/demo/` y `/va/demo/`, también enlazada desde la landing y el acceso. Todos sus perfiles son ficticios y los cambios solo duran esa visita. La activación del backend de Supabase sigue pendiente: la demo no crea cuentas ni conserva mensajes para otras personas.

El código está en `components/community/` y `lib/community/`, con estilos adaptables en `app/community.css`. Las migraciones de comunidad y Storage preparan datos reales protegidos por RLS. Ver [activación y alcance de la comunidad](docs/community-setup.md).

## ClasiCoins

La landing y la aplicación explican y aplican ClasiCoins, una moneda interna para incentivar la participación: 20 de bienvenida, −10 al crear un evento, −5 al abrir un hilo, +3 por la primera inscripción en un evento ajeno y +2 por la primera respuesta en un hilo ajeno. Hay límites diarios y un registro propio de movimientos. No se compran, venden ni convierten en dinero. [Reglas y despliegue](docs/unicoins.md).
