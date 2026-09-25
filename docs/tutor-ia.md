# El tutor de IA

`supabase/functions/study-tutor/` es la función Edge que responde a las herramientas «Tutor de apuntes» y «Examíname» cuando hay cuenta real. Recibe los apuntes que el alumno pegó o extrajo de un PDF/foto, y devuelve una explicación, un resumen, los puntos clave, una tanda de tarjetas o un cuestionario — siempre basado en lo que el alumno le pasó, nunca inventado.

En la demo no interviene: `lib/community/student/demo-tutor.ts` genera las mismas formas de respuesta con reglas locales, sin red ni clave, para que el recorrido se pueda probar sin cuenta. El contrato entre pantallas y las dos puntas — demo y función real — vive en `lib/community/student/ai.ts`; tocar esta función no debe cambiar ese contrato.

## Qué hace, paso a paso

1. Exige una sesión válida (`Authorization: Bearer <JWT del usuario>`) contra el proyecto de Supabase. Sin sesión, 401 y ninguna llamada a la IA.
2. Valida el cuerpo: `mode` tiene que ser uno de `explain | summary | keypoints | flashcards | quiz | chat`; `language`, `es` o `va`. Un modo desconocido es 400.
3. Recorta `notes` a 60.000 caracteres y `images` a 4 fotos, por si el navegador no lo hizo ya.
4. Llama a Claude (`claude-opus-5`, el SDK oficial `@anthropic-ai/sdk`):
   - **explain, summary, keypoints, chat** → texto en Markdown sencillo, con `output_config.effort: "low"` y `max_tokens: 4000`. En `chat`, el historial (hasta los últimos 20 turnos) se manda como mensajes alternos; los apuntes van en el primer mensaje de usuario.
   - **flashcards, quiz** → salida estructurada con `client.messages.parse` y un esquema Zod (`output_config.effort: "medium"`, `max_tokens: 8000`). El esquema exige exactamente el número de preguntas pedido (`count`) y la forma que le toca a `kind` (test: 4 opciones; verdadero/falso: exactamente esas dos opciones, en el idioma pedido; corto: sin opciones, respuesta modelo).
5. Devuelve JSON con la forma de `TutorResponse` (o, si se pidió `stream: true` en un modo de texto, eventos SSE — ver más abajo). Cualquier fallo devuelve `{ "error": "..." }` con el código HTTP que le corresponde (ver más abajo).

Los apuntes y las fotos solo viajan en esa llamada: la función no los guarda en ningún sitio.

## Estilo de respuesta (`style`)

La petición puede incluir `style: { tone, length }` para cambiar cómo suena la respuesta, sin cambiar qué hace el modo. Si no se manda, se usa `{ tone: "peer", length: "normal" }` (el tono de compañero que ya había).

- `tone`: `peer` (compañero que ayuda, el de siempre), `teacher` (más formal y ordenado, con apartados) o `simple` (como si el alumno no supiera nada del tema: frases cortas, ejemplos cotidianos, sin tecnicismos sin explicar).
- `length`: `short` (lo justo, sin rodeos), `normal` o `long` (con ejemplos, matices y una recapitulación final).

Estas instrucciones se añaden al `system` prompt (`styleInstructions` en `index.ts`) en español o valenciano según `language`; un `style` con valores fuera de esa lista es petición inválida (400), igual que un `mode` desconocido.

## Streaming (`stream: true`)

Solo se aplica a los modos de texto (`explain`, `summary`, `keypoints`, `chat`); en `flashcards` y `quiz` la salida es JSON estructurado y no se puede trocear, así que aunque llegue `stream: true` la función responde igual que siempre (una sola pieza JSON). El cliente ya lo sabe: `askTutorStream` en `lib/community/student/ai.ts` cae a `askTutor` para esos dos modos.

Cuando `stream: true` y el modo es de texto, la función responde con `content-type: text/event-stream` (además de las cabeceras CORS habituales, más `cache-control: no-cache` y `x-accel-buffering: no` para que nada la bufferee por el camino) y va mandando eventos `data: {...}\n\n` según llega el texto de Claude:

- Uno o varios `data: {"delta":"<trozo de texto>"}\n\n` — cada trozo tal cual lo entrega el modelo (no acumulado; el cliente es quien lo va concatenando).
- Al terminar, `data: {"done":true,"response":{"mode":"...","text":"<texto completo>"}}\n\n` — la misma forma de `TutorResponse` que devolvería el modo no-streaming.
- Si algo falla a mitad (la API de Claude corta, un rechazo de seguridad, un error de red), `data: {"error":"<mensaje amable en el idioma pedido>"}\n\n` y la conexión se cierra ahí; no llega ningún `done` después de un `error`.

Por dentro, la función usa `client.messages.stream({...})` (los mismos parámetros que en el modo no-streaming) y recorre sus eventos con `for await`, quedándose solo con los `content_block_delta` de tipo `text_delta` — los bloques de razonamiento (`thinking`, activado por defecto en Opus 5) no se reenvían nunca. Al final, `await stream.finalMessage()` da el `stop_reason` (si es `"refusal"`, se emite el evento `error` con el mismo mensaje que en el modo no-streaming) y el `usage`, que se registra con `logUsage` igual que en las llamadas normales.

**Nota técnica:** las Supabase Edge Functions corren sobre Deno Deploy, que soporta respuestas en streaming de verdad — basta con devolver un `Response` cuyo cuerpo sea un `ReadableStream` (`Deno.serve` no necesita nada especial para esto). No hace falta ningún adaptador ni cabecera extra más allá de `content-type: text/event-stream`.

Probarlo con curl (con `-N` para que no bufferee la salida y `accept: text/event-stream` para pedir streaming explícitamente; aunque en la práctica la función decide por el campo `stream` del cuerpo, no por esta cabecera):

```bash
curl -N -s -X POST "https://<ref>.supabase.co/functions/v1/study-tutor" \
  -H "Authorization: Bearer <JWT del usuario>" \
  -H "content-type: application/json" \
  -H "accept: text/event-stream" \
  -d '{
    "mode": "explain",
    "language": "es",
    "notes": "Pega aquí un par de párrafos de apuntes de verdad, al menos unas líneas.",
    "question": "¿Qué es la fotosíntesis?",
    "style": { "tone": "simple", "length": "short" },
    "stream": true
  }'
```

La salida son líneas `data: {...}` una tras otra, terminando en el `done` (o en un `error`).

## Variables de entorno

| Variable | Quién la pone | Para qué |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Supabase, automáticamente | Crear el cliente que valida el JWT del usuario (`auth.getUser()`). |
| `ANTHROPIC_API_KEY` | Tú, como secreto | La clave de la API de Claude. Sin ella, cualquier petición responde 500 «clave no configurada». |

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

Ninguna de estas variables va en Vercel: la web es una exportación estática y nunca ve la clave.

## Despliegue

A diferencia de `waitlist-mailer`, esta función **sí necesita verificación de JWT** — es justo lo que impide que cualquiera use tu clave de Claude sin iniciar sesión:

```bash
supabase functions deploy study-tutor
```

(sin `--no-verify-jwt`; ese flag es solo para el correo de baja, que se abre desde una bandeja de entrada sin token).

**Sin línea de comandos:** copia el contenido de `supabase/functions/study-tutor/index.ts` en Edge Functions → Deploy a new function → Via Editor, con el nombre `study-tutor`, dejando **Verify JWT** activado (es la opción por defecto).

## Límites actuales

- **60.000 caracteres** de apuntes por llamada. Si el navegador manda más, `askTutor` ya los recorta y añade un aviso; la función los recorta también por su cuenta, por si acaso.
- **4 imágenes** como máximo por llamada.
- **Sin cuota diaria por usuario todavía.** Cualquier cuenta puede llamar tantas veces como quiera; el único límite es el `rate limit` general de la API de Claude (que responde 429 y la función lo traduce igual).

### Siguiente paso propuesto: `universe_tutor_usage`

Antes de abrir el tutor a todo el mundo conviene limitar el gasto por persona y por día. La idea, sin implementar todavía:

```sql
create table public.universe_tutor_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id),
  mode text not null,
  input_tokens int not null,
  output_tokens int not null,
  created_at timestamptz not null default now()
);
```

La función sumaría `response.usage` en esta tabla tras cada llamada con éxito, y antes de llamar a Claude comprobaría (con una función `universe_tutor_quota_ok(user_id)`, por ejemplo) que la persona no ha superado un tope diario de tokens o de llamadas. Se deja fuera de esta entrega porque el tutor mismo tiene que funcionar primero; añadirlo es una migración más un par de líneas en `index.ts`.

## Coste orientativo por llamada

Precios de `claude-opus-5`: 5 $ / millón de tokens de entrada, 25 $ / millón de salida (incluye el razonamiento interno del modelo, que en Opus 5 está activado por defecto y no se puede desactivar sin más). Con unos apuntes típicos de 2-3 páginas (~4.000 tokens de entrada):

| Modo | `max_tokens` | Coste aproximado |
| --- | --- | --- |
| explain / summary / keypoints / chat | 4.000 | 0,02–0,03 $ de entrada + hasta 0,10 $ de salida si agota los 4.000 tokens (razonamiento incluido) |
| flashcards / quiz | 8.000 | 0,02–0,03 $ de entrada + hasta 0,20 $ de salida |

Son techos, no promedios: la mayoría de respuestas usan bastante menos que el máximo. Las fotos añaden algo de coste de entrada (unos cientos de tokens cada una, según tamaño); por eso `extract.ts` las redimensiona a 1600 px antes de mandarlas.

## Qué se registra y qué no

Cada llamada deja una línea de `console.log` con `mode`, `language`, la longitud de `notes` (un número, no el texto) y `response.usage` (tokens de entrada/salida). **Nunca se registran los apuntes, las imágenes, la pregunta, el historial de chat ni la respuesta de Claude.** Los logs de la función son visibles desde el panel de Supabase (Edge Functions → study-tutor → Logs); sirven para vigilar gasto y detectar picos, no para depurar el contenido de una conversación concreta.

## Probarla con curl

Necesitas un JWT de un usuario real. La forma más simple es sacarlo de la sesión del navegador (DevTools → Application → Local Storage → la clave que empieza por `sb-...-auth-token`, campo `access_token`) mientras esa persona ha iniciado sesión en la app real (no en `/demo`).

```bash
curl -s -X POST "https://<ref>.supabase.co/functions/v1/study-tutor" \
  -H "Authorization: Bearer <JWT del usuario>" \
  -H "content-type: application/json" \
  -d '{
    "mode": "summary",
    "language": "es",
    "notes": "Pega aquí un par de párrafos de apuntes de verdad, al menos unas líneas."
  }'
```

Para un cuestionario:

```bash
curl -s -X POST "https://<ref>.supabase.co/functions/v1/study-tutor" \
  -H "Authorization: Bearer <JWT del usuario>" \
  -H "content-type: application/json" \
  -d '{
    "mode": "quiz",
    "language": "es",
    "notes": "...",
    "count": 5,
    "kind": "test"
  }'
```

Sin `Authorization`, la respuesta es 401. Con un JWT caducado o de otra app, también. Un `mode` que no exista, o `language` distinto de `es`/`va`, responde 400. Si `ANTHROPIC_API_KEY` no está puesta (o es inválida), 500 con un mensaje que dice justo eso, para no confundirlo con un fallo de sesión.
