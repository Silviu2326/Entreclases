# Los juegos de Entreclase

Las siete experiencias están en **Explorar**, debajo del banner. Se abren dentro de la misma página. Cada una tiene un archivo propio; no hay que mantener una página nueva por juego.

| Experiencia | Archivo en `components/community/games/` | Qué se puede hacer |
| --- | --- | --- |
| ¿Me lío? | `me-lio.tsx` | Participar voluntariamente, elegir café/cita/me lío en privado, descubrir coincidencias mutuas y abrir un chat. |
| Sin dar la cara | `preguntas-anonimas.tsx` | Abrir un buzón, preguntar sin mostrar el nombre, responder y publicar, descartar, bloquear o denunciar. |
| Defiende lo indefendible | `defiende-lo-indefendible.tsx` | Proponer una afirmación, aceptar la postura contraria, debatir tres turnos por persona y votar como jurado. |
| Dos verdades y una trola | `dos-verdades.tsx` | Publicar tres frases, guardar cuál es mentira y adivinar las de otras personas. |
| Hay hueco | `hay-hueco.tsx` | Crear un encuentro de 15 a 120 minutos, reservar una plaza y conversar con quienes se apuntan. |
| El jurado del campus | `jurado-del-campus.tsx` | Proponer un dilema con dos posturas, votar y después ver resultados y debatir. |
| La cita empieza hablando | `cita-a-ciegas.tsx` | Entrar el jueves de 19:30 a 21:00, conversar doce minutos y revelar los perfiles solo con permiso mutuo. |

## Quitar un juego

En `components/community/games/catalog.ts`, cambia a `enabled: false` la entrada del juego. Desaparece de Explorar y no se carga su pantalla. No afecta a los demás ni borra las partidas. Puedes recuperarlo cambiando el valor a `true`.

Si quieres borrar también su archivo, elimina primero su entrada completa del catálogo. Desactivar la pantalla no desactiva su función en la base de datos; para retirar un juego del servicio hay que rechazar su identificador en `universe_play` antes de eliminar sus datos.

## Prueba sin personas reales

Abre `http://127.0.0.1:3000/demo/?view=explore#juegos`.

La demo incluye personas ficticias y botones expresamente marcados como **Demo** para simular interés mutuo, preguntas, un rival o la otra persona de una cita. No envía mensajes ni denuncias a nadie. Su estado se conserva al cerrar y abrir un juego durante la misma visita, y se reinicia al recargar. Las citas de la demo pueden probarse cualquier día.

## Activar en las cuentas reales

La interfaz está preparada para usar Supabase; la nueva migración debe aplicarse al proyecto antes de que las cuentas reales puedan jugar:

`supabase/migrations/202609190007_social_games.sql`

En una instalación existente, ejecuta **solo esa migración pendiente**, después de las anteriores, en una transacción. No vuelvas a ejecutar `supabase/setup.sql`: ese archivo es para instalaciones nuevas. Esta entrega no ha aplicado la migración al Supabase remoto.

Sin ella, los juegos muestran un aviso de que todavía no están activados. La demo sigue funcionando.

Los datos reales se actualizan cada ocho segundos mientras el juego está abierto y la pestaña visible. No hay notificaciones fuera de la página. El juego de citas empareja por orden de llegada entre participantes disponibles; todavía no filtra por preferencias románticas. La mayoría de edad se declara mediante una casilla, no se verifica documentalmente. Los juegos no consumen ni dan ClasiCoins.

## Privacidad y mantenimiento

- Las tablas no tienen acceso directo desde cuentas de usuario. La función `universe_play` comprueba la cuenta universitaria y cada acción.
- La solución de las tres frases se oculta hasta votar; los intereses románticos entrantes se ocultan hasta coincidir. Al abandonar ¿Me lío? se revocan también las elecciones salientes.
- Las preguntas sin contestar solo las ve quien recibe el buzón. Al responder, pregunta y respuesta se publican en esta experiencia de Explorar. No se añaden automáticamente al perfil ni al foro.
- Denunciar una pregunta guarda una copia para revisión y bloquea al remitente en ese buzón. Las denuncias quedan en `universe_play_reports`, accesible al administrador desde Supabase. No se ha creado un panel de moderación ni un servicio de avisos; hace falta revisar esas denuncias para operar el servicio.
- Las plazas y los turnos se comprueban dentro de una transacción. El chat de Hay hueco solo es visible para quienes se han unido.
- Al salir cualquiera de una cita se cierra la sala para ambos. El nombre y el enlace al chat privado solo se muestran tras dos permisos. El chat privado sigue disponible si se abrió antes de que caducase la sala.
- Las salas caducadas dejan de aparecer y de aceptar mensajes; no se borran físicamente de forma automática. Antes de un lanzamiento, definir y aplicar un plazo de conservación para salas, mensajes, denuncias y el registro de actividad.
- Se muestran las cien salas más recientes por experiencia; no se ha añadido paginación. Hay límites de creaciones, preguntas y acciones seguidas.

La lógica local de prueba está en `lib/community/games/demo.ts`, los tipos en `types.ts` y la conexión compartida en `components/community/games/shared.tsx`. Las reglas reales están en la migración. Al cambiar una regla, mantener coherentes ambas versiones.

## Comprobación

`npm run test:auth` incluye `tests/social-games.test.mjs`: permisos, anonimato, coincidencias, respuestas ocultas, plazas, turnos, votaciones y consentimiento mutuo. Las pruebas de la base de datos usan una instancia local de PostgreSQL; no modifican el Supabase real.
