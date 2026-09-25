// Turns pasted notes (plus up to 4 photos) into explanations, summaries, key
// points, flashcards, quizzes or chat answers. Claude does the work; this
// function only authenticates the caller, validates the request and shapes
// the two kinds of Claude calls (plain text vs. structured JSON).
//
// Types below mirror lib/community/student/ai.ts. Kept local on purpose: this
// function deploys on its own (Deno, no bundler) and never imports from lib/.
import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import { z } from "npm:zod";

type TutorLanguage = "es" | "va";
type TutorMode = "explain" | "summary" | "keypoints" | "flashcards" | "quiz" | "chat";
type QuizKind = "test" | "truefalse" | "short";
type TutorImage = { media_type: "image/jpeg" | "image/png" | "image/webp"; data: string };
type ChatTurn = { role: "user" | "assistant"; text: string };
type TutorStyle = { tone: "peer" | "teacher" | "simple"; length: "short" | "normal" | "long" };

type TutorRequest = {
  mode: TutorMode;
  language: TutorLanguage;
  notes: string;
  images?: TutorImage[];
  question?: string;
  history?: ChatTurn[];
  count?: 5 | 10 | 20;
  kind?: QuizKind;
  style?: TutorStyle;
  stream?: boolean;
};

const MODEL = "claude-opus-5";
const NOTES_LIMIT = 60_000;
const MAX_IMAGES = 4;
const MAX_HISTORY_TURNS = 20;
const DEFAULT_STYLE: TutorStyle = { tone: "peer", length: "normal" };
// Modos de texto: los únicos en los que el streaming tiene sentido (flashcards
// y quiz son JSON estructurado, no se pueden trocear). Mismo nombre que
// STREAMING_MODES en lib/community/student/ai.ts.
const STREAMING_MODES = new Set<TutorMode>(["explain", "summary", "keypoints", "chat"]);

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "content-type": "application/json" } });
}

// --- Request validation -----------------------------------------------

const MODES = new Set<TutorMode>(["explain", "summary", "keypoints", "flashcards", "quiz", "chat"]);
const KINDS = new Set<QuizKind>(["test", "truefalse", "short"]);
const COUNTS = new Set<number>([5, 10, 20]);
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const TONES = new Set<TutorStyle["tone"]>(["peer", "teacher", "simple"]);
const LENGTHS = new Set<TutorStyle["length"]>(["short", "normal", "long"]);

function isTutorImage(value: unknown): value is TutorImage {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.data === "string" && v.data.length > 0 && typeof v.media_type === "string" && IMAGE_TYPES.has(v.media_type);
}

function isChatTurn(value: unknown): value is ChatTurn {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (v.role === "user" || v.role === "assistant") && typeof v.text === "string";
}

function parseRequest(body: unknown): TutorRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  const rawMode = b.mode;
  if (typeof rawMode !== "string" || !MODES.has(rawMode as TutorMode)) return null;
  const mode = rawMode as TutorMode;

  const rawLanguage = b.language;
  if (rawLanguage !== "es" && rawLanguage !== "va") return null;
  const language: TutorLanguage = rawLanguage;

  const rawNotes = b.notes;
  if (typeof rawNotes !== "string") return null;
  const notes = rawNotes.length > NOTES_LIMIT ? rawNotes.slice(0, NOTES_LIMIT) : rawNotes;

  let images: TutorImage[] | undefined;
  const rawImages = b.images;
  if (rawImages !== undefined) {
    if (!Array.isArray(rawImages)) return null;
    images = rawImages.filter(isTutorImage).slice(0, MAX_IMAGES);
  }

  let question: string | undefined;
  const rawQuestion = b.question;
  if (rawQuestion !== undefined) {
    if (typeof rawQuestion !== "string") return null;
    question = rawQuestion;
  }

  let history: ChatTurn[] | undefined;
  const rawHistory = b.history;
  if (rawHistory !== undefined) {
    if (!Array.isArray(rawHistory) || !rawHistory.every(isChatTurn)) return null;
    history = rawHistory as ChatTurn[];
  }

  let count: 5 | 10 | 20 | undefined;
  const rawCount = b.count;
  if (rawCount !== undefined) {
    if (typeof rawCount !== "number" || !COUNTS.has(rawCount)) return null;
    count = rawCount as 5 | 10 | 20;
  }

  let kind: QuizKind | undefined;
  const rawKind = b.kind;
  if (rawKind !== undefined) {
    if (typeof rawKind !== "string" || !KINDS.has(rawKind as QuizKind)) return null;
    kind = rawKind as QuizKind;
  }

  let style: TutorStyle | undefined;
  const rawStyle = b.style;
  if (rawStyle !== undefined) {
    if (!rawStyle || typeof rawStyle !== "object") return null;
    const s = rawStyle as Record<string, unknown>;
    if (typeof s.tone !== "string" || !TONES.has(s.tone as TutorStyle["tone"])) return null;
    if (typeof s.length !== "string" || !LENGTHS.has(s.length as TutorStyle["length"])) return null;
    style = { tone: s.tone as TutorStyle["tone"], length: s.length as TutorStyle["length"] };
  }

  let stream: boolean | undefined;
  const rawStream = b.stream;
  if (rawStream !== undefined) {
    if (typeof rawStream !== "boolean") return null;
    stream = rawStream;
  }

  return { mode, language, notes, images, question, history, count, kind, style, stream };
}

// --- Prompt building ----------------------------------------------------

function notesBlock(notes: string): string {
  return `Apuntes del alumno:\n"""\n${notes}\n"""`;
}

function modeFallbackQuestion(mode: TutorMode, language: TutorLanguage): string {
  const va = language === "va";
  if (mode === "summary") return va ? "Fes un resum clar d'aquests apunts." : "Haz un resumen claro de estos apuntes.";
  if (mode === "keypoints") return va ? "Extrau els punts clau d'aquests apunts en una llista." : "Extrae los puntos clave de estos apuntes en una lista.";
  if (mode === "explain") return va ? "Explica estos apunts de manera senzilla." : "Explica estos apuntes de forma sencilla.";
  return va ? "Ajuda'm amb els meus apunts." : "Ayúdame con mis apuntes.";
}

// Cómo se ha de dirigir al alumno (por encima del tono de compañero base de
// systemPrompt) y cuánto ha de extenderse. No cambia qué hace cada modo, solo
// cómo suena.
function styleInstructions(style: TutorStyle, language: TutorLanguage): string {
  const va = language === "va";
  const parts: string[] = [];
  if (style.tone === "teacher") {
    parts.push(va
      ? "Per a aquesta resposta, encara que el fons siga proper, adopta un to més formal i ordenat, com un professor: estructura la resposta en apartats clars (amb títols curts o llistes) en compte de paràgrafs seguits."
      : "Para esta respuesta, aunque el fondo siga siendo cercano, adopta un tono más formal y ordenado, como un profesor: estructura la respuesta en apartados claros (con títulos cortos o listas) en lugar de párrafos seguidos.");
  } else if (style.tone === "simple") {
    parts.push(va
      ? "Parla com si l'alumne no sabera absolutament res del tema: frases curtes, exemples quotidians, i explica qualsevol tecnicisme la primera vegada que l'uses, sense donar per fet cap coneixement previ."
      : "Habla como si el alumno no supiera absolutamente nada del tema: frases cortas, ejemplos cotidianos, y explica cualquier tecnicismo la primera vez que lo uses, sin dar por hecho ningún conocimiento previo.");
  }
  if (style.length === "short") {
    parts.push(va
      ? "Sigues breu: ves al gra, sense rodejos ni reblit, aproximadament una tercera part del que escriuries normalment."
      : "Sé breve: ve al grano, sin rodeos ni relleno, aproximadamente un tercio de lo que escribirías normalmente.");
  } else if (style.length === "long") {
    parts.push(va
      ? "Explaya't: afig exemples i matisos, i acaba amb una xicoteta recapitulació final."
      : "Explaya-te: añade ejemplos y matices, y termina con una pequeña recapitulación final.");
  }
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

function systemPrompt(mode: TutorMode, language: TutorLanguage, style: TutorStyle = DEFAULT_STYLE): string {
  const va = language === "va";
  const base = va
    ? "Ets un company de la universitat que ajuda un altre estudiant a entendre els seus apunts. Respon sempre en valencià, amb un to proper, com un company que ajuda un altre, mai com un professor distant. Fes servir Markdown senzill: paràgrafs curts, llistes i negreta quan ajude. No inventes res que no estiga als apunts que et passen; si et pregunten alguna cosa que no hi apareix, digues-ho clarament en compte d'inventar-te-la."
    : "Eres un compañero de universidad que ayuda a otro estudiante a entender sus apuntes. Responde siempre en español, con un tono cercano, como un compañero que ayuda a otro, nunca como un profesor distante. Usa Markdown sencillo: párrafos cortos, listas y negrita cuando ayude. No inventes nada que no esté en los apuntes que te pasan; si te preguntan algo que no aparece en ellos, dilo claramente en vez de inventártelo."
  const extra: Record<TutorMode, [string, string]> = {
    explain: ["Explica lo que pregunta el alumno apoyándote solo en los apuntes que te pasa.", "Explica el que pregunta l'alumne recolzant-te només en els apunts que et passa."],
    summary: ["Haz un resumen claro y breve de los apuntes, con las ideas principales.", "Fes un resum clar i breu dels apunts, amb les idees principals."],
    keypoints: ["Extrae los puntos clave de los apuntes como una lista.", "Extrau els punts clau dels apunts com una llista."],
    chat: ["Mantén la conversación con el alumno respondiendo a su última pregunta, apoyándote en los apuntes y en lo hablado antes.", "Mantén la conversa amb l'alumne responent a la seua última pregunta, recolzant-te en els apunts i en el que s'ha parlat abans."],
    flashcards: ["Genera entre 12 y 20 tarjetas de estudio (término y definición) a partir de los apuntes, sin inventar términos que no estén en ellos.", "Genera entre 12 i 20 targetes d'estudi (terme i definició) a partir dels apunts, sense inventar termes que no hi estiguen."],
    quiz: ["Genera un cuestionario a partir de los apuntes, detectando entre 3 y 6 temas; cada pregunta debe usar uno de esos temas.", "Genera un qüestionari a partir dels apunts, detectant entre 3 i 6 temes; cada pregunta ha d'usar un d'eixos temes."],
  };
  return `${base} ${extra[mode][va ? 1 : 0]}${styleInstructions(style, language)}`;
}

function buildMessages(request: TutorRequest): Anthropic.MessageParam[] {
  const images = (request.images ?? []).map(img => ({
    type: "image" as const,
    source: { type: "base64" as const, media_type: img.media_type, data: img.data },
  }));

  if (request.mode === "chat") {
    const history = (request.history ?? []).slice(-MAX_HISTORY_TURNS);
    const turns: ChatTurn[] = [...history];
    const question = request.question?.trim();
    const last = turns[turns.length - 1];
    if (question && (!last || last.role !== "user" || last.text.trim() !== question)) {
      turns.push({ role: "user", text: question });
    }
    if (turns.length === 0) turns.push({ role: "user", text: modeFallbackQuestion("chat", request.language) });
    if (turns[0].role !== "user") turns.unshift({ role: "user", text: modeFallbackQuestion("chat", request.language) });

    const messages: Anthropic.MessageParam[] = turns.map((turn, index) => {
      const text = index === 0 ? `${notesBlock(request.notes)}\n\n${turn.text}` : turn.text;
      return {
        role: turn.role,
        content: index === 0 && images.length > 0 ? [...images, { type: "text" as const, text }] : text,
      };
    });
    return messages;
  }

  const question = request.mode === "explain" && request.question?.trim()
    ? request.question.trim()
    : modeFallbackQuestion(request.mode, request.language);
  const text = `${notesBlock(request.notes)}\n\n${question}`;
  const content = images.length > 0 ? [...images, { type: "text" as const, text }] : text;
  const messages: Anthropic.MessageParam[] = [{ role: "user", content }];
  return messages;
}

// --- Structured output schemas ------------------------------------------

function buildFlashcardsSchema() {
  return z.object({
    flashcards: z.array(z.object({ front: z.string().min(1), back: z.string().min(1) })).min(12).max(20),
  });
}

function buildQuizSchema(count: 5 | 10 | 20, kind: QuizKind, language: TutorLanguage) {
  const base = { id: z.string().min(1), topic: z.string().min(1), question: z.string().min(1), explanation: z.string().min(1) };
  let questionSchema: z.ZodTypeAny;
  if (kind === "test") {
    questionSchema = z.object({ ...base, options: z.array(z.string().min(1)).length(4), answer: z.number().int().min(0).max(3) });
  } else if (kind === "truefalse") {
    const trueFalseOptions: readonly [string, string] = language === "va" ? ["Vertader", "Fals"] : ["Verdadero", "Falso"];
    const [trueLabel, falseLabel] = trueFalseOptions;
    questionSchema = z.object({ ...base, options: z.tuple([z.literal(trueLabel), z.literal(falseLabel)]), answer: z.number().int().min(0).max(1) });
  } else {
    questionSchema = z.object({ ...base, answer: z.string().min(1) });
  }
  return z.object({
    topics: z.array(z.string().min(1)).min(3).max(6),
    quiz: z.array(questionSchema).length(count),
  });
}

// --- Errors ---------------------------------------------------------------

class RefusalError extends Error {}
class ParseFailureError extends Error {}

function refusalMessage(language: TutorLanguage): string {
  return language === "va"
    ? "El tutor no pot respondre a això. Prova a reformular la pregunta o revisa els apunts que has pujat."
    : "El tutor no puede responder a esto. Prueba a reformular la pregunta o revisa los apuntes que has subido.";
}

// Igual que handleError, pero devuelve el texto del mensaje (no una Response)
// para poder emitirlo como evento SSE `error` cuando el fallo ocurre a mitad
// de un stream, donde ya no se pueden enviar cabeceras ni un código HTTP.
function streamErrorMessage(error: unknown, language: TutorLanguage): string {
  const va = language === "va";
  if (error instanceof RefusalError || error instanceof ParseFailureError) return error.message;
  if (error instanceof Anthropic.AuthenticationError) {
    return va
      ? "El tutor d'IA no té la clau configurada correctament. Avisa a l'equip."
      : "El tutor de IA no tiene la clave configurada correctamente. Avisa al equipo.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return va
      ? "Massa peticions al tutor ara mateix. Prova-ho d'ací a un minut."
      : "Demasiadas peticiones al tutor ahora mismo. Prueba de nuevo en un minuto.";
  }
  if (error instanceof Anthropic.APIError) {
    return va
      ? `El tutor d'IA ha fallat (codi ${error.status ?? "desconegut"}).`
      : `El tutor de IA ha fallado (código ${error.status ?? "desconocido"}).`;
  }
  console.log("study-tutor: unexpected error", error instanceof Error ? error.message : String(error));
  return va ? "Hi ha hagut un error inesperat. Torna-ho a provar." : "Ha ocurrido un error inesperado. Inténtalo de nuevo.";
}

function parseFailureMessage(language: TutorLanguage): string {
  return language === "va"
    ? "El tutor no ha pogut generar una resposta amb el format esperat. Torna-ho a provar."
    : "El tutor no ha podido generar una respuesta con el formato esperado. Vuelve a intentarlo.";
}

function handleError(error: unknown): Response {
  if (error instanceof RefusalError) return json({ error: error.message }, 422);
  if (error instanceof ParseFailureError) return json({ error: error.message }, 502);
  if (error instanceof Anthropic.AuthenticationError) {
    return json({ error: "El tutor de IA no tiene la clave configurada correctamente. Avisa al equipo." }, 500);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return json({ error: "Demasiadas peticiones al tutor ahora mismo. Prueba de nuevo en un minuto." }, 429);
  }
  if (error instanceof Anthropic.APIError) {
    return json({ error: `El tutor de IA ha fallado (código ${error.status ?? "desconocido"}).` }, 502);
  }
  console.log("study-tutor: unexpected error", error instanceof Error ? error.message : String(error));
  return json({ error: "Ha ocurrido un error inesperado. Inténtalo de nuevo." }, 500);
}

// --- Usage logging (never the content) ------------------------------------

function logUsage(request: TutorRequest, usage: unknown): void {
  console.log(JSON.stringify({ mode: request.mode, language: request.language, notesLength: request.notes.length, usage }));
}

// --- Claude calls -----------------------------------------------------

// Thinking blocks (Opus 5 thinks by default) share the content array with
// text blocks; only the text ones carry the answer.
function extractText(content: Anthropic.Message["content"]): string {
  return content
    .map(block => (block.type === "text" ? block.text : null))
    .filter((value): value is string => value !== null)
    .join("\n\n")
    .trim();
}

async function handleTextMode(client: Anthropic, request: TutorRequest) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "low" },
    system: systemPrompt(request.mode, request.language, request.style ?? DEFAULT_STYLE),
    messages: buildMessages(request),
  });
  logUsage(request, response.usage);
  if (response.stop_reason === "refusal") throw new RefusalError(refusalMessage(request.language));
  return { mode: request.mode, text: extractText(response.content) };
}

// Igual que handleTextMode, pero devuelve directamente la Response SSE: cada
// trozo de texto que llega se emite como `data: {"delta":"…"}` y, al acabar,
// un evento `done` con la respuesta completa (mismo formato de TutorResponse
// que el modo no-streaming). Solo se usa para los modos de texto — flashcards
// y quiz son JSON estructurado y no se pueden trocear.
function streamTextMode(client: Anthropic, request: TutorRequest): Response {
  const encoder = new TextEncoder();
  // The browser may abort mid-stream («Parar»): after that, enqueue/close throw
  // on a cancelled controller. Track it and make every write a no-op instead.
  let closed = false;
  let messageStream: ReturnType<typeof client.messages.stream> | null = null;
  const send = (controller: ReadableStreamDefaultController<Uint8Array>, data: unknown) => {
    if (closed) return;
    try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch { closed = true; }
  };
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        messageStream = client.messages.stream({
          model: MODEL,
          max_tokens: 4000,
          output_config: { effort: "low" },
          system: systemPrompt(request.mode, request.language, request.style ?? DEFAULT_STYLE),
          messages: buildMessages(request),
        });
        for await (const event of messageStream) {
          if (closed) break;
          // Solo los bloques de texto llevan la respuesta al alumno; se
          // ignoran los de pensamiento (Opus 5 piensa por defecto).
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            send(controller, { delta: event.delta.text });
          }
        }
        if (closed) return;
        const final = await messageStream.finalMessage();
        logUsage(request, final.usage);
        if (final.stop_reason === "refusal") {
          send(controller, { error: refusalMessage(request.language) });
          return;
        }
        send(controller, { done: true, response: { mode: request.mode, text: extractText(final.content) } });
      } catch (error) {
        send(controller, { error: streamErrorMessage(error, request.language) });
      } finally {
        if (!closed) { closed = true; try { controller.close(); } catch { /* already closed by the client */ } }
      }
    },
    cancel() {
      closed = true;
      try { messageStream?.abort(); } catch { /* nothing left to stop */ }
    },
  });
  return new Response(stream, {
    headers: { ...CORS_HEADERS, "content-type": "text/event-stream", "cache-control": "no-cache", "x-accel-buffering": "no" },
  });
}

async function handleFlashcards(client: Anthropic, request: TutorRequest) {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: "medium", format: zodOutputFormat(buildFlashcardsSchema()) },
    system: systemPrompt("flashcards", request.language, request.style ?? DEFAULT_STYLE),
    messages: buildMessages(request),
  });
  logUsage(request, response.usage);
  if (response.stop_reason === "refusal") throw new RefusalError(refusalMessage(request.language));
  if (!response.parsed_output) throw new ParseFailureError(parseFailureMessage(request.language));
  return { mode: "flashcards", flashcards: response.parsed_output.flashcards };
}

async function handleQuiz(client: Anthropic, request: TutorRequest) {
  const count = request.count ?? 5;
  const kind = request.kind ?? "test";
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: "medium", format: zodOutputFormat(buildQuizSchema(count, kind, request.language)) },
    system: systemPrompt("quiz", request.language, request.style ?? DEFAULT_STYLE),
    messages: buildMessages(request),
  });
  logUsage(request, response.usage);
  if (response.stop_reason === "refusal") throw new RefusalError(refusalMessage(request.language));
  if (!response.parsed_output) throw new ParseFailureError(parseFailureMessage(request.language));
  return { mode: "quiz", topics: response.parsed_output.topics, quiz: response.parsed_output.quiz };
}

// --- Entry point -----------------------------------------------------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (request.method !== "POST") return json({ error: "Método no soportado." }, 405);

  // No JWT, no IA: the anon client only proves who is asking.
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return json({ error: "Falta la sesión. Inicia sesión para usar el tutor." }, 401);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return json({ error: "Sesión no válida. Vuelve a iniciar sesión." }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "El cuerpo de la petición no es JSON válido." }, 400);
  }
  const tutorRequest = parseRequest(body);
  if (!tutorRequest) return json({ error: "Petición no válida: revisa el modo, el idioma o los apuntes." }, 400);

  // Checked explicitly (rather than only relying on the SDK throwing) so a
  // missing secret always answers the same friendly 500, never an unhandled
  // exception that would skip CORS headers and the JSON error shape.
  if (!ANTHROPIC_API_KEY) {
    return json({ error: "El tutor de IA no tiene la clave configurada correctamente. Avisa al equipo." }, 500);
  }

  // Streaming solo tiene sentido en los modos de texto; flashcards y quiz son
  // JSON estructurado y siguen respondiendo de una pieza aunque `stream`
  // venga a true (el cliente lo entiende: askTutorStream cae a askTutor para
  // esos modos). El constructor va dentro del try: si algún día lanzara, la
  // respuesta seguiría siendo el JSON de error con sus cabeceras CORS.
  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    if (tutorRequest.stream && STREAMING_MODES.has(tutorRequest.mode)) {
      return streamTextMode(client, tutorRequest);
    }
    const response = tutorRequest.mode === "flashcards"
      ? await handleFlashcards(client, tutorRequest)
      : tutorRequest.mode === "quiz"
      ? await handleQuiz(client, tutorRequest)
      : await handleTextMode(client, tutorRequest);
    return json(response, 200);
  } catch (error) {
    return handleError(error);
  }
});
