# IA en Entreclases

Dos usos, los dos con GPT-6 Luna (`gpt-6-luna`) de OpenAI, y los dos pensados para que la aplicación sirva aunque haya poca gente.

| Uso | Dónde se ve | Quién lo lanza | Qué se guarda |
| --- | --- | --- | --- |
| **Estudiar con estos apuntes**: resumen, tarjetas, test y preguntas | Campus → Apuntes → «Estudiar» | La primera persona que lo abre | El resultado, una vez por apunte, para todos. Las preguntas no se guardan |
| **Calentamientos del juego del día** | Inicio y Explorar | Una tarea programada semanal | Propuestas pendientes; solo se muestran las que aprueba el equipo |

La clave de OpenAI vive en las Edge Functions de Supabase. La web es estática y nunca la ve.

## Estudiar con estos apuntes

1. Alguien pulsa «Estudiar» en un apunte. Si ya está preparado, se ve al momento y no se gasta nada.
2. Si no lo está, pulsa «Prepararlo ahora». La función `note-study`:
   - comprueba con su sesión que es miembro y le queda cupo (`universe_note_study_request`);
   - descarga el PDF y extrae el texto con `unpdf`;
   - si el PDF es un escaneo (menos de 400 caracteres) o pasa de 80 páginas, lo marca y no llama a la IA;
   - pide a la IA el resumen, las tarjetas y el test con un esquema JSON estricto;
   - comprueba el resultado (`normalizeStudy`) y lo guarda.
3. «Reta a tu clase» comparte un enlace `/app/?view=campus&nota=<id>` que abre ese apunte en el test. Para verlo hace falta una cuenta.
4. «Pregunta» responde solo con el texto de ese PDF. La pregunta no se guarda.

**Cupos**, en `universe_ai_spend`:
- Por persona y día: 6 apuntes preparados y 30 preguntas.
- En total por día: 400 y 3.000.

Solo gasta cupo quien prepara un apunte nuevo, no quien abre uno ya preparado.

**Qué ve el navegador:** el estado y el resultado. El texto extraído (`source_text`) y quién lo pidió no se pueden leer desde el cliente. Borrar el apunte borra su estudio.

**Demo:** no llama a la IA. «Prepararlo ahora» enseña un estudio de ejemplo que explica cómo funciona.

## Calentamientos del juego del día

- La función `warmup-writer` propone rondas para cinco juegos: Dos verdades, Sin dar la cara, La cita, Defiende lo indefendible y El jurado.
- Cada ronda llega en castellano y en valenciano.
- Cada juego cambia solo lo que su tarjeta admite: las frases en unos, el tema en otros.
- Se revisan en **Backoffice → Calentamientos**. Aprobar o descartar requiere el rol `editor`, `moderator` o `admin`.
- Solo se muestran las aprobadas. Cada día sale una, la misma en Inicio y en Explorar. Si un juego no tiene ninguna, sale la de siempre.
- Si un juego acumula 12 pendientes, no se añaden más.

## Juegos para conocer gente

No es IA, pero forma parte del mismo plan.

- ¿Me lío? y La cita se abren cuando el campus de la persona llega a **150 perfiles** (`universe_meet_games_open`, migración 030). La función solo responde sí o no y no revela el recuento.
- Mientras están cerrados:
  - no salen como juego del día;
  - su tarjeta dice «Se abre cuando haya más gente de tu campus»;
  - su página invita a probarlos en la demo.
- El servidor de esos juegos, cuando exista, debe consultar la misma función antes de aceptar una jugada.

## Puesta en marcha

1. **Base de datos.** Aplica en orden las migraciones:
   - `202609270029_note_study.sql`
   - `202609270030_meet_games_gate.sql`
   - `202609270031_play_v2.sql` (servidor de los juegos, ver [docs/juegos/08-servidor.md](juegos/08-servidor.md))
   - `202609270032_warmups.sql`

   Después, regenera `supabase/setup.sql` con `npm run supabase:prepare` en la carpeta que tenga todas las migraciones.
2. **Secretos** (Supabase → Edge Functions → Secrets):

   | Secreto | Valor |
   | --- | --- |
   | `OPENAI_API_KEY` | La clave del proyecto de OpenAI |
   | `OPENAI_BASE_URL` | Opcional. `https://eu.api.openai.com/v1` para procesar en la UE (el proyecto de OpenAI debe estar configurado para la UE) |
   | `NOTE_STUDY_MODEL`, `WARMUP_MODEL` | Opcionales. Por defecto `gpt-6-luna` |
   | `NOTE_STUDY_ORIGINS` | Orígenes permitidos, separados por comas. Por defecto `https://www.entreclases.com,http://localhost:3000` |
   | `WARMUP_CRON_SECRET` | Un secreto largo para la tarea programada |

3. **Despliegue:**

   ```sh
   supabase functions deploy note-study
   supabase functions deploy warmup-writer --no-verify-jwt
   ```

   `note-study` verifica el JWT: solo entra quien tiene sesión. `warmup-writer` comprueba su propio secreto.
4. **Tarea semanal.** Con `pg_cron` y `pg_net`, igual que la lista de espera:

   ```sql
   select cron.schedule('warmup-writer', '0 8 * * 1', $$
     select net.http_post(
       url := 'https://<proyecto>.supabase.co/functions/v1/warmup-writer?rondas=3',
       headers := jsonb_build_object('x-warmup-secret', '<WARMUP_CRON_SECRET>', 'content-type', 'application/json')
     );
   $$);
   ```

   Para probarlo a mano, lanza la misma petición con `curl`. `?juego=debate` limita la tanda a un juego.
5. **Legal.** Antes de abrirlo al público, completa el punto 10 de [PENDIENTES-TITULAR](legal/PENDIENTES-TITULAR.md). La política de privacidad ya describe este uso.

## Coste

Precios de GPT-6 Luna: 0,10 $ por millón de tokens de entrada y 0,50 $ por millón de salida.

| Qué | Estimación |
| --- | --- |
| Un apunte de 20 páginas | ~0,006 $ |
| 500 apuntes al mes | ~3 $ |
| Una pregunta | < 0,001 $ |
| Tanda semanal de calentamientos | céntimos |

El procesamiento en la UE cuesta un 10 % más. Configura también un límite de gasto en el panel de OpenAI.

## Calidad

Luna es el modelo más barato de su familia. Antes de abrirlo a todo el mundo:
- prueba con 5 a 10 apuntes reales;
- revisa sobre todo las respuestas del test.

Si falla, cambia `NOTE_STUDY_MODEL`, por ejemplo a GPT-6 Sol. Cada resultado guarda el modelo que lo hizo (`model`). Para volver a preparar un apunte, borra su fila de `universe_note_study`.

## Pruebas

- `tests/note-study.test.mjs`: la forma del estudio y la validación de la salida del modelo.
- `tests/note-study-policy.test.mjs`: cupos, permisos, texto privado y el cierre de los juegos para conocer gente.
- `tests/warmups.test.mjs`: la forma de las rondas y quién las publica.
- `tests/play-v2.test.mjs`: el servidor de los juegos.

Ninguna prueba llama a OpenAI.
