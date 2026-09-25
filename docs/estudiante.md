# Sección Estudiante

Herramientas que sirven aunque el usuario sea la única persona conectada. Responden al problema del arranque en frío: una comunidad vacía no da motivos para volver; un tutor de apuntes, un simulacro de examen o el calendario del cuatrimestre sí. La capa social (planes, grupos, gente) sigue siendo el objetivo; esta sección es la razón para entrar cada día mientras la comunidad crece.

Vive en la vista `student` de la aplicación: `/app/?view=student` y `/demo/?view=student` (en valenciano, bajo `/va/`). Cada herramienta se abre con `&tool=<slug>`.

| Herramienta | Slug (es / va) | IA | Estado |
| --- | --- | --- | --- |
| Tutor de apuntes | `tutor-de-apuntes` / `tutor-d-apunts` | Sí | Documentos en este navegador |
| Examíname | `examiname` / `examina-m` | Sí | Historial de intentos en este navegador |
| ¿Qué necesito en el final? | `calculadora-de-notas` / `calculadora-de-notes` | No | Este navegador |
| Mi semana | `mi-semana` / `la-meua-setmana` | No | Este navegador; importa y exporta `.ics` |
| Trabajos en grupo | `trabajos-en-grupo` / `treballs-en-grup` | No | Este navegador |
| ¿Dónde estudio? | `donde-estudio` / `on-estudie` | No | Sin estado; datos verificados en el código |

### Espacio de asignaturas

El hub incluye un espacio de asignaturas (components/community/student/subjects.tsx). Permite crear asignaturas, guardar la fecha del examen y vincular documentos del Tutor de apuntes. Desde una asignatura se abre Examíname con sus documentos seleccionados y una prueba breve de cinco preguntas; el resultado más reciente se muestra de vuelta en su tarjeta. Los datos se guardan en este navegador, en la clave subjects; el progreso procede del historial de Examíname.

Este primer recorrido todavía no sincroniza con Supabase ni muestra citas enlazadas a páginas del documento.

## Organización

Sigue el mismo patrón que los juegos (`JUEGOS.md`): un catálogo con textos y slugs, un archivo que enlaza cada entrada con su pantalla, y una pantalla por herramienta con su propio CSS.

```
lib/community/student/
  catalog.ts     Las herramientas: id, slugs, textos, grupo, si usan IA, interruptor `enabled`
  storage.ts     useToolStore: estado en localStorage por cuenta y modo (demo o real)
  ai.ts          Contrato con la IA (TutorRequest / TutorResponse) y askTutor
  demo-tutor.ts  Respuestas de la demo, generadas en el navegador sin red
  extract.ts     Texto de PDF, .txt y .md; fotos redimensionadas a JPEG
  grades.ts, teamwork.ts, calendar.ts, libraries.ts, notes.ts   Lógica pura de cada herramienta, con tests

components/community/student/
  index.tsx      El hub (tarjetas por grupo) y la lectura de `?tool=`
  catalog.ts     Enlaza cada id con su pantalla (importación dinámica)
  shared.tsx     useTool, ToolShell, Panel, Stat, Notice
  student.css    Marco y primitivas `st-*`
  <slug>.tsx / <slug>.css   Cada pantalla, con prefijo propio (gr-, tw-, cal-, lib-, nt-, ex-)

supabase/functions/study-tutor/   La única pieza con clave: llama a Claude con el JWT del usuario
tests/student-*.test.mjs           Lógica pura de cada herramienta
```

La vista está registrada en `lib/community/types.ts` (`View`), los textos de cabecera en `lib/community/copy.ts` (`studentTitle`, `studentSub`; la etiqueta `student` ya existía) y la navegación en `components/community/shell.tsx`.

## Estado: dónde vive y por qué

Todo lo que el alumno escribe se guarda en `localStorage`, con la clave `entreclases:student:<demo|real>:<userId>:<herramienta>` (`storage.ts`). Decisión deliberada para esta primera versión:

- Funciona igual en la demo y en cuentas reales, sin migraciones ni políticas nuevas.
- No hay datos académicos personales en el servidor (notas, exámenes, horarios) hasta que haga falta y esté cubierto por la política de privacidad.
- Cada pantalla lo dice en su pie: cambiar de dispositivo empieza de cero.

Las fotos de apuntes no se persisten (desbordarían el almacén); solo el texto extraído.

Sincronizar con Supabase es un paso posterior: una tabla por herramienta con RLS por `user_id`, y `useToolStore` sustituido por un repositorio con la misma interfaz.

## El Tutor como espacio de trabajo

El Tutor de apuntes no es un formulario: es un estudio de tres paneles, al estilo de las herramientas de chat con modelos, pensado para estudiar.

- **Izquierda, conversaciones.** Se guardan (hasta 30) en este navegador, con título automático a partir de la primera pregunta, buscador, renombrar y borrar.
- **Centro, el hilo.** Las respuestas van llegando en streaming y se pueden parar. Las tarjetas y los tests aparecen dentro de la conversación, no en otra pantalla: la baraja se voltea ahí mismo y el test se corrige ahí mismo, con nota, nivel por tema y «repetir solo los fallos». Cada respuesta tiene acciones: copiar, regenerar, «hazme tarjetas de esto», «hazme un test de esto». El compositor elige el modo (Preguntar, Explicar, Resumir, Puntos clave, Tarjetas, Test), adjunta archivos y muestra cuánto contexto va en cada petición.
- **Derecha, contexto y estilo.** Qué apuntes van adjuntos a esta conversación, el tono (compañero, profe, muy simple), la extensión (corto, normal, largo) y el idioma de la respuesta.

Los apuntes se comparten con Examíname a través del mismo almacén (`notes.ts`); las conversaciones viven en `chats.ts`.

## La IA

`askTutor` y `askTutorStream` (`ai.ts`) son las únicas entradas. La segunda recibe el texto a trozos por SSE (`data: {"delta":…}` y un `done` final) y acepta una señal de cancelación; los modos estructurados (tarjetas, test) llegan de una pieza. `TutorStyle` (tono y extensión) viaja en la petición y termina en el system prompt. En la demo responde `demoTutor`, un generador de reglas que trabaja con el texto real que pegue el usuario, para que el recorrido se pueda probar sin clave. En cuentas reales invoca la función Edge `study-tutor`, que:

1. Exige un usuario autenticado (`auth.getUser()` con el JWT que envía el cliente).
2. Recorta los apuntes a 60.000 caracteres y las fotos a 4.
3. Llama a Claude (`claude-opus-5`) con el SDK oficial; salidas estructuradas para tarjetas y tests.
4. Devuelve `TutorResponse`. Registra modo, idioma, longitud y tokens; nunca el contenido.

Despliegue, secretos y límites: `docs/tutor-ia.md`. Sin la función desplegada, las pantallas muestran «todavía no está activado en cuentas reales» y enlazan a la demo; el resto de la sección funciona igual.

Pendiente antes de abrir la IA a todas las cuentas: una cuota diaria por usuario (tabla `universe_tutor_usage`) y decidir si las llamadas cuestan ClasiCoins. Las reglas de ClasiCoins se aplican en PostgreSQL (`docs/unicoins.md`), así que cobrar por una llamada requiere migración; la propuesta inicial (resumir 2, test 3, tutor con mensajes gratuitos) queda como decisión de producto, no está implementada.

## Añadir una herramienta

1. Entrada en `lib/community/student/catalog.ts` con id, slugs, textos en los dos idiomas, grupo y `ai`.
2. Pantalla `components/community/student/<slug>.tsx` envuelta en `<ToolShell id="…">`, con `useTool` para idioma y almacén, y su CSS con prefijo propio.
3. Línea en `components/community/student/catalog.ts` enlazando el id con la pantalla.
4. Lógica que se pueda probar sin navegador en `lib/community/student/<nombre>.ts` y su test en `tests/`.

Quitar una: `enabled: false` en el catálogo. Desaparece del hub y deja de cargarse.

## Comprobaciones

```sh
npx tsc --noEmit -p tsconfig.json
npx eslint components/community/student lib/community/student
node --experimental-strip-types --test tests/student-*.test.mjs
```

## Datos y honestidad

- «¿Dónde estudio?» solo incluye bibliotecas verificadas en su web oficial, con la fecha de verificación y el enlace. Sin horario verificado, la tarjeta dice «Consulta el horario». Los horarios cambian en exámenes y festivos: la web oficial manda.
- Los ejemplos precargados (una asignatura, un trabajo) son ilustrativos y no usan personas reales.
- Ninguna herramienta muestra cifras de uso ni «N estudiantes aquí» hasta que existan. El hueco está previsto en «¿Dónde estudio?».

