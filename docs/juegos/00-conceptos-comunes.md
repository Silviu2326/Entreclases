# Los siete juegos: conceptos comunes

Este documento recoge lo que comparten los siete juegos de Explorar. Cada juego tiene su propio documento en esta carpeta. Son documentos de diseño: describen cómo debe funcionar y usarse cada juego, no cómo está programado hoy. Cada uno termina con una sección que compara el diseño con lo que existe ahora.

| N.º | Juego | Documento | Para qué sirve |
| --- | --- | --- | --- |
| 1 | Sin dar la cara | `01-sin-dar-la-cara.md` | Preguntar lo que no te atreves a preguntar con tu nombre. |
| 2 | La cita empieza hablando | `02-la-cita-empieza-hablando.md` | Conocer a alguien por lo que dice antes que por su foto. |
| 3 | ¿Me lío? | `03-me-lio.md` | Saber si el interés es mutuo sin exponerte. |
| 4 | Dos verdades y una trola | `04-dos-verdades-y-una-trola.md` | Tener una excusa para empezar una conversación. |
| 5 | Defiende lo indefendible | `05-defiende-lo-indefendible.md` | Discutir en broma con alguien y con público. |
| 6 | Hay hueco | `06-hay-hueco.md` | Quedar hoy, en el campus, con quien también tenga un rato. |
| 7 | El jurado del campus | `07-el-jurado-del-campus.md` | Saber qué opina la gente de tu dilema. |

## 1. Principio de diseño: nada de formularios

Hoy los siete juegos son un párrafo de instrucciones, un formulario y una lista. Eso hace que todos parezcan el mismo juego. El rediseño sigue cinco reglas:

1. **Una decisión por pantalla.** Crear algo es un recorrido de dos o tres pasos grandes, no un formulario con seis campos. Cada paso se responde tocando, no rellenando.
2. **Tocar antes que escribir.** Donde hoy hay un campo de texto vacío, debe haber sugerencias que se pueden usar tal cual, barajar o editar. Escribir desde cero es siempre opcional.
3. **Cada juego tiene su objeto.** Una nota sin firma, una conversación con reloj, una baraja de personas, tres cartas, un cuadrilátero, un hueco en el mapa, un caso con veredicto. El objeto es el mismo que ya enseña el banner de Explorar de cada juego.
4. **El juego tiene estados, y se ven.** Esperando, tu turno, en marcha, decidiendo, terminado. La pantalla cambia entera con el estado; no es una lista que se va alargando.
5. **Siempre hay un siguiente paso.** Todos los juegos desembocan en algo real: un chat privado, un plan, un grupo o un perfil. Ningún juego termina en una pantalla muerta.

## 2. Destinatarios: a quién va cada cosa

Hoy todo lo que se crea en un juego lo ve toda la universidad. El rediseño introduce el **destinatario**: quien crea algo elige quién puede verlo y participar. Es la pieza común más importante y la usan casi todos los juegos.

| Destinatario | Quién entra | Con qué dato se calcula |
| --- | --- | --- |
| Todo el campus | Cualquier cuenta universitaria verificada | Ya existe |
| Mi sede | Quien tiene la misma sede en el perfil, por ejemplo Tarongers | Campo `campus` del perfil |
| Mi carrera | Quien tiene la misma carrera | Campo `degree` del perfil |
| Mi curso | Misma carrera y mismo año | Campos `degree` y `year` del perfil |
| Un grupo | Miembros de un grupo al que pertenezco | Grupos ya existentes |
| Mis contactos | Personas con las que ya tengo relación | No existe todavía, ver abajo |
| Una persona | Una sola cuenta, elegida por nombre | Perfiles ya existentes |

Reglas comunes de los destinatarios:

- **El selector es el mismo en todos los juegos.** Una fila de fichas con icono, y debajo el recuento de personas que lo verán. El recuento evita sorpresas y protege el anonimato.
- **Mínimo de personas.** Un destinatario colectivo con menos de ocho personas no admite contenido anónimo, porque sería fácil deducir quién lo escribió. La ficha aparece desactivada con la explicación.
- **El destinatario no se puede ampliar después.** Se puede cerrar o borrar lo creado, pero no enseñárselo a más gente de la que se eligió.
- **La carrera es texto libre hoy.** Para que «mi carrera» y «mi curso» funcionen, la carrera del perfil debe elegirse de una lista, o al menos normalizarse. Es un requisito previo.

### Decisión pendiente: qué son «mis contactos»

La aplicación no tiene amigos ni seguidores. Hay dos caminos:

- **Recomendado para empezar:** contactos implícitos. Son mis contactos las personas con las que tengo un chat privado abierto, las que comparten un grupo pequeño conmigo y las coincidencias de los juegos. No requiere nada nuevo que el usuario tenga que gestionar.
- **Más adelante:** amistades explícitas, con solicitud y aceptación. Es una función de toda la aplicación, no de los juegos, y merece su propia decisión.

## 3. Identidad: cuándo se ve quién eres

Cada juego usa uno de estos cuatro niveles. El nivel se muestra siempre junto al botón de enviar, con una frase, para que nadie tenga que suponerlo.

| Nivel | Qué ve la otra persona | Juegos |
| --- | --- | --- |
| Con tu nombre | Nombre, foto y perfil | Hay hueco, Dos verdades, Defiende lo indefendible |
| Con alias | Un alias generado, igual durante toda la partida | La cita empieza hablando |
| Anónimo | Nada. Ni alias ni pistas | Sin dar la cara, y opcional en El jurado |
| Secreto hasta coincidir | Nada, salvo que el interés sea mutuo | ¿Me lío?, y la decisión final de La cita |

El anonimato es frente a otros estudiantes, nunca frente a la moderación. Toda acción queda asociada a una cuenta verificada, y una denuncia permite identificar al autor. Esto se dice con claridad antes de la primera acción anónima de cada persona, no escondido en unas condiciones.

## 4. Avisos

Los juegos no funcionan si hay que entrar a mirar si ha pasado algo. Todos los avisos de los juegos llegan al **Buzón** de la aplicación, la sección de avisos que ya existe, y al contador del menú.

- Un aviso por hecho relevante: te han preguntado, es tu turno, hay coincidencia, alguien se ha apuntado, tu caso tiene veredicto, tu conversación entra en sus últimas horas.
- Los avisos de juegos anónimos nunca incluyen el contenido ni pistas del remitente. Dicen «Tienes una pregunta nueva», no la pregunta.
- Cada juego se puede silenciar por separado.
- Nombre a revisar: el juego Sin dar la cara también habla de «tu buzón». Para no confundirlo con el Buzón de avisos, en el juego se llamará siempre «mi buzón de preguntas».

## 5. Seguridad y moderación

- **Mayoría de edad.** ¿Me lío? y La cita empieza hablando exigen declarar que se tienen 18 años. Hoy es una casilla. Antes de lanzar con cuentas reales hay que decidir si basta.
- **Denunciar y bloquear, siempre a un toque.** En cualquier contenido de otra persona. Bloquear a alguien anónimo funciona sin revelar quién es: el bloqueo se aplica a la cuenta, no al nombre.
- **Un bloqueo vale en todos los juegos.** Si bloqueo a alguien, no me lo cruzo en ninguna baraja, cita, debate ni hueco.
- **Personas reales, fuera del contenido.** Los dilemas, debates y preguntas colectivas no pueden nombrar a terceros. Se avisa al escribir y es motivo de denuncia.
- **Límites de ritmo.** Cada juego limita cuánto se puede crear o enviar al día. Los límites se muestran como parte del juego, por ejemplo «te quedan tres preguntas hoy», no como un error al pasarse.
- **Panel de moderación.** Hoy las denuncias se guardan en una tabla que solo se puede consultar desde Supabase. Con contenido anónimo dirigido a personas concretas, un panel de revisión deja de ser opcional. Es un requisito previo para lanzar Sin dar la cara y La cita con cuentas reales.
- **Conservación.** Las conversaciones y preguntas cerradas se borran pasado un plazo, salvo las denunciadas. Cada documento propone su plazo.

## 6. Lo que esto exige por debajo

Hoy los siete juegos comparten dos tablas, salas y movimientos, y una única función de base de datos que valida cada acción. El modelo aguanta, pero hay que ampliarlo:

- **Destinatario en cada sala:** tipo de destinatario y referencia al grupo o a la persona. La función que devuelve las salas debe filtrar por él. Es el cambio que desbloquea más juegos a la vez.
- **Ajustes por persona y juego:** quién puede preguntarme, quién me ve en ¿Me lío?, qué busco en La cita, qué juegos tengo silenciados.
- **Avisos:** los juegos deben poder escribir en el Buzón.
- **Tiempo real.** Hoy cada juego vuelve a pedir los datos cada ocho segundos. Para una conversación de dos días o un debate en directo hace falta recibir los mensajes al momento. Supabase lo permite con suscripciones en tiempo real.
- **La demo debe seguir funcionando.** Cada regla nueva tiene que existir también en la lógica local de prueba, con personas ficticias y botones marcados como simulación.

## 7. Orden recomendado

1. **Destinatarios y avisos.** Sin ellos, ningún juego mejora de verdad.
2. **Hay hueco y Dos verdades y una trola.** Poco riesgo, se entienden solos y generan actividad diaria.
3. **El jurado del campus y Defiende lo indefendible.** Necesitan público, así que van después de que haya gente entrando.
4. **Sin dar la cara.** Requiere el panel de moderación.
5. **¿Me lío? y La cita empieza hablando.** Son los más delicados. Necesitan masa crítica, mayoría de edad resuelta, moderación y tiempo real.
