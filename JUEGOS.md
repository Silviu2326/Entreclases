# Los juegos de Entreclases

Las siete experiencias se listan en **Explorar**, debajo del banner, y cada una tiene su propia página con dirección propia. Las tarjetas de Explorar son enlaces a esas páginas; también se puede enlazar a un juego desde fuera de la aplicación.

| Dónde | Dirección |
| --- | --- |
| Cuentas reales (español) | `/app/juegos/<nombre>/` |
| Demo (español) | `/demo/juegos/<nombre>/` |
| Cuentas reales (valenciano) | `/va/app/jocs/<nom>/` |
| Demo (valenciano) | `/va/demo/jocs/<nom>/` |

| Experiencia | Página (español / valenciano) | Motor y pantalla |
| --- | --- | --- |
| ¿Me lío? | `me-lio` / `ens-emboliquem` | `crush.ts` · `me-lio.tsx` |
| Sin dar la cara | `sin-dar-la-cara` / `sense-donar-la-cara` | `questions.ts` · `preguntas-anonimas.tsx` |
| Defiende lo indefendible | `defiende-lo-indefendible` / `defen-l-indefensable` | `debate.ts` · `defiende-lo-indefendible.tsx` |
| Dos verdades y una trola | `dos-verdades-y-una-trola` / `dues-veritats-i-una-mentida` | `truth.ts` · `dos-verdades.tsx` |
| Hay hueco | `hay-hueco` / `hi-ha-lloc` | `hangout.ts` · `hay-hueco.tsx` |
| El jurado del campus | `jurado-del-campus` / `jurat-del-campus` | `jury.ts` · `jurado-del-campus.tsx` |
| La cita empieza hablando | `la-cita-empieza-hablando` / `la-cita-comenca-parlant` | `blind.ts` · `cita-a-ciegas.tsx` |

## Cómo está organizado

Cada juego es independiente: tiene sus propias reglas, su propia forma de estado y sus propios estilos. Antes los siete compartían un único tipo genérico de «sala», y era la razón por la que todos se parecían.

```
lib/community/games/
  types.ts        Tipos comunes: destinatarios, persona, mundo, tiempo
  audience.ts     Quién ve cada cosa, y a cuánta gente alcanza
  world.ts        Construye el mundo desde los perfiles, grupos y conversaciones
  catalog.ts      Los siete juegos: nombre de página, título y descripción
  openings.ts     Los siete banners de Explorar
  demo.ts         Reparte cada juego a su motor
  demo/
    store.ts      El estado de la demo, que vive mientras dure la pestaña
    <juego>.ts    Las reglas de cada juego

components/community/games/
  shared.tsx      El enganche useGame y el marco GameShell
  ui.tsx          Las primitivas: fichas, destinatarios, baraja, reloj, chat…
  games.css       Los estilos de todo lo anterior
  catalog.ts      Enlaza cada juego con su pantalla
  index.tsx       La rejilla de Explorar y la página de cada juego
  <pantalla>.tsx  La pantalla de cada juego
  <pantalla>.css  Sus estilos, con prefijo propio
```

El contrato que cumplen los siete está en `docs/juegos/CONTRATO-TECNICO.md`. El diseño de cada uno, con sus estados, reglas y decisiones pendientes, está en `docs/juegos/`, un documento por juego más `00-conceptos-comunes.md`.

### Destinatarios

Casi todos los juegos preguntan **quién lo va a ver**: todo el campus, mi sede, mi carrera, mi curso, un grupo, mis contactos o una persona. El selector es el mismo en todos y muestra a cuánta gente alcanza. Un destinatario colectivo de menos de ocho personas no admite contenido anónimo, porque sería fácil deducir quién lo escribió.

Los contactos son implícitos: personas con las que ya tienes una conversación privada o compartes un grupo pequeño. No hay que añadir a nadie.

## Quitar un juego

En `lib/community/games/catalog.ts`, cambia a `enabled: false` la entrada del juego. Desaparece de Explorar, deja de generarse su página, sale de la rotación de banners y no se carga su pantalla. No afecta a los demás ni borra las partidas. Se recupera cambiando el valor a `true`.

Si quieres borrar también sus archivos, elimina primero su entrada del catálogo y su línea en `components/community/games/catalog.ts`.

## El banner de Explorar

El banner de apertura tiene siete versiones, una por juego. Cada vez que se entra en la página se muestra la siguiente, en el orden del catálogo; el turno se recuerda en el navegador y, si no se puede guardar, se elige una al azar. Buscar dentro de Explorar no cambia el banner de esa visita.

Cada versión tiene su titular, su nota manuscrita, su color y **una ronda de ejemplo con la mecánica de su juego**: fichas para ¿Me lío?, una nota sin firma para Sin dar la cara, dos esquinas enfrentadas para el debate, plazas para Hay hueco, barras de votación para el jurado y un chat con reloj para la cita. Las rondas de ejemplo no envían ni guardan nada y terminan en un enlace a la página del juego.

Los textos están en `lib/community/games/openings.ts`, el componente en `components/community/explore-opening.tsx` y los colores al final de `components/community/explore.css`. Un juego desactivado sale también de la rotación.

## Los juegos en el perfil

**Mi perfil** tiene una tarjeta plegable, «Tus juegos», con una entrada a cada juego activado. En la demo cada entrada dice además qué está pasando: preguntas por responder, tu turno en un debate, tu racha, el caso de la semana. Las que esperan algo de ti se marcan y se cuentan en la cabecera de la tarjeta.

El resumen sale de `lib/community/games/summary.ts`, que lee cada motor una sola vez con `"read"` y no refresca. Solo lo ve la persona a la que se refiere y, aun así, se construye solo con resultados: de ¿Me lío? cuenta coincidencias y nunca elecciones, y de La cita dice lo mismo acabe como acabe. La tarjeta está en `components/community/profile-games.tsx`.

### Desde el perfil de otra persona

Al abrir el perfil de alguien, en Personas o en «Tu gente», aparecen tres puertas bajo «Rompe el hielo». Cada una abre su juego ya dirigido a esa persona, con `?to=<user_id>` en la dirección:

| Puerta | Qué abre |
| --- | --- |
| Sin dar la cara | La pregunta, ya dirigida a esa persona, en el paso de escribirla |
| Dos verdades y una trola | Su ronda, si tiene una que no has jugado; si no, un reto directo para ella |
| Hay hueco | La lista con su hueco el primero, si tiene uno abierto; si no, uno nuevo de dos plazas que solo verá ella |

¿Me lío? y La cita no tienen puerta a propósito: entrar en ellas desde un perfil diría a por quién vas. La lista está en `personGames`, en `summary.ts`. Las pantallas leen el parámetro con `useGameTarget`, de `games/shared.tsx`, que lo ignora si no corresponde a nadie conocido o eres tú. Un juego nuevo que quiera puerta usa ese mismo enganche.

Las cuentas reales ven las entradas sin resumen. Cuando exista el servidor conviene que responda por los siete juegos en una sola llamada, en vez de siete `universe_play_v2`.

## Prueba sin personas reales

Abre `http://127.0.0.1:3000/demo/?view=explore` y entra en cualquier tarjeta, o ve directamente a la página de un juego, por ejemplo `http://127.0.0.1:3000/demo/juegos/hay-hueco/`.

La demo incluye personas ficticias y contenido ya sembrado en cada juego, para que haya algo que hacer desde el primer segundo. Como al otro lado no hay nadie, cada juego ofrece botones marcados **Demo** que simulan a la otra persona: una respuesta, un turno, un voto, una coincidencia o el final de un encuentro. No envía mensajes ni denuncias a nadie.

El estado se conserva mientras dure la pestaña, también al pasar de un juego a otro, y se reinicia al recargar.

## Cuentas reales

Las pantallas llaman a `universe_play_v2`, de la migración `202609270031_play_v2.sql`. Sirve con cuentas reales **Dos verdades y una trola, El jurado del campus y Hay hueco**: destinatario comprobado en el servidor, anonimato aplicado en la proyección, mínimo de ocho personas, soluciones y recuentos ocultos, tiempo y límites llevados por el servidor, y una lista de bloqueos común. Las pruebas están en `tests/play-v2.test.mjs`.

Los otros cuatro juegos siguen solo en la demo: con cuentas reales ven el aviso de «todavía no está activado» con un enlace a ella.

Lo pendiente está en `docs/juegos/08-servidor.md`: tiempo real, avisos al Buzón, panel de moderación (requisito previo para Sin dar la cara y La cita), plazos de conservación y los cuatro juegos restantes.

La función antigua `universe_play`, de la migración `202609190007_social_games.sql`, corresponde a los juegos anteriores. No sirve para el diseño nuevo y conviene sustituirla, no ampliarla.

## Privacidad

- Ningún juego publica nada dirigido a una persona sin su consentimiento. Las preguntas anónimas solo se publican si quien las recibe responde y lo decide.
- Los intereses de ¿Me lío? no se ven nunca salvo coincidencia, tampoco en recuentos. Quien eligió menos no sabe que la otra persona quería más.
- En La cita, cuando no hay coincidencia, las dos personas reciben exactamente el mismo cierre. Nadie recibe un rechazo explícito.
- La solución de las tres frases se oculta hasta jugar. El recuento de un debate se oculta hasta que cierra la votación. El resultado de un caso se oculta hasta votar.
- El anonimato es frente a otros estudiantes, nunca frente a la moderación. Se dice antes de la primera acción anónima, no en unas condiciones.
- Bloquear a alguien anónimo funciona sin desvelar quién es.

## Comprobación

`npm run test:auth` incluye:

- `tests/game-demos.test.mjs`: el contrato de los siete motores. Leer no cambia nada, todos responden en los dos idiomas, todos rechazan un comando desconocido con un mensaje para personas, y los destinatarios alcanzan exactamente a quien nombran, incluido el mínimo de ocho para el anonimato.
- `tests/social-games.test.mjs`: las reglas del servidor actual, sobre una instancia local de PostgreSQL. No tocan el Supabase real.
- `tests/game-pages.test.mjs`: que cada juego tiene su página en los dos idiomas, en la aplicación y en la demo.
