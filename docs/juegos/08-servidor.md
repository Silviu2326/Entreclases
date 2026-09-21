# El servidor de los juegos

Qué falta para que los siete juegos funcionen con cuentas reales, no solo en la demo.

## Dónde estamos

Las siete experiencias están construidas y son jugables **en la demo**. La pantalla de cada juego llama a `universe_play_v2`, una función de Supabase que todavía no existe. Mientras no exista, las cuentas reales ven el aviso de «todavía no está activado» con un enlace a la demo, que es lo que ya pasaba antes.

La función actual, `universe_play`, de la migración `202609190007_social_games.sql`, corresponde a los juegos antiguos: una sola tabla de salas con campos genéricos y siete juegos compartiendo el mismo formato. No sirve para el diseño nuevo y **no debe ampliarse**; conviene sustituirla.

## Lo que cambia respecto al modelo actual

| Hoy | Lo que hace falta |
| --- | --- |
| Una fila de sala con campos fijos: `body`, `options`, `place`, `capacity` | Una fila con un campo de estado propio de cada juego, en JSON, más los campos comunes |
| Todo lo creado lo ve toda la universidad | Un destinatario por fila, y la consulta filtra por él |
| El autor siempre es visible | Un indicador de anonimato, y el autor nunca sale en la proyección cuando está activo |
| Sin caducidad real | Fecha de inicio y de cierre, y cierre automático al vencer |
| Se consulta cada ocho segundos | Suscripción en tiempo real para los juegos de conversación |

## Los nueve requisitos del servidor

1. **El destinatario se comprueba en el servidor, no en la pantalla.** Cada fila guarda el tipo de destinatario y su referencia. La proyección devuelve solo las filas cuyo destinatario incluye a quien pregunta. Si esto se deja en el cliente, cualquiera puede leer las preguntas de otro curso.

2. **El anonimato se aplica en la proyección.** Cuando una fila es anónima, la identidad del autor no debe salir de la base de datos, ni siquiera en un campo que la pantalla no pinte. La moderación accede por una vía distinta.

3. **El mínimo de ocho personas se recalcula al crear.** El cliente lo muestra, el servidor lo exige. Un destinatario pequeño no admite contenido anónimo.

4. **Lo que está oculto, oculto.** El servidor no puede devolver: la solución de las tres frases antes de jugar, el recuento de una votación antes de cerrarse, los intereses entrantes de ¿Me lío? sin coincidencia, ni la decisión de la otra persona en La cita. Hoy esto se garantiza en la proyección de la función actual y hay que mantener ese enfoque.

5. **Los cierres neutros son idénticos para las dos partes.** En La cita, cuando no hay coincidencia, las dos personas reciben exactamente el mismo texto, sin distinguir si la otra dijo que no, dejó de contestar o se fue. En la demo esto se cumple porque solo hay un jugador real; en el servidor hay que garantizarlo de forma explícita, porque es la regla que evita que el juego reparta rechazos.

6. **El tiempo lo lleva el servidor.** Turnos que caducan, votaciones que cierran a las 24 horas, casos que cierran a las 72, citas que pasan a decisión a las 48, huecos que terminan. La demo lo resuelve al leer; el servidor necesita además una tarea programada, porque hay avisos que salen aunque nadie esté mirando.

7. **Los límites de ritmo se cuentan en el servidor.** Cinco preguntas al día, veinte personas en la baraja, dos casos abiertos, un hueco a la vez. La pantalla los muestra como parte del juego; el servidor los impone.

8. **Un bloqueo vale en los siete juegos.** Hace falta una lista de bloqueos por persona, consultada por todos los juegos, no una por juego como ahora.

9. **Las denuncias necesitan un panel.** Hoy se guardan en una tabla que solo se consulta desde Supabase. Con preguntas anónimas dirigidas a personas concretas y con citas privadas, revisar denuncias deja de ser opcional. **Es requisito previo para activar Sin dar la cara y La cita con cuentas reales.**

## Lo que además hay que decidir fuera del servidor

- **Preferencias de emparejamiento.** El perfil no guarda género ni a quién se busca. Sin esos datos, La cita empareja por orden de llegada y ¿Me lío? no puede filtrar. Los dos juegos están construidos dejando ese hueco marcado en el código.
- **La carrera es texto libre.** Los destinatarios «mi carrera» y «mi curso» necesitan que se elija de una lista.
- **Los avisos.** Los juegos resuelven hoy sus avisos dentro de su propia pantalla. Cuando el Buzón esté terminado, cada juego debe escribir en él.
- **Conservación.** Cada documento de juego propone su plazo de borrado. Hay que aplicarlos.

## Orden sugerido

1. La tabla nueva con destinatario, anonimato, estado en JSON y fechas, más la proyección que filtra.
2. `universe_play_v2` con los juegos sin conversación: Dos verdades, El jurado, Hay hueco.
3. Tiempo real y tarea programada.
4. Defiende lo indefendible y Sin dar la cara, este último detrás del panel de moderación.
5. ¿Me lío? y La cita, detrás de las preferencias de emparejamiento y de la decisión sobre la mayoría de edad.

Las pruebas del servidor actual están en `tests/social-games.test.mjs` y usan una instancia local de PostgreSQL. Sirven de modelo: la versión nueva debe cubrir al menos los puntos 1, 2, 4 y 5 de esta lista.
