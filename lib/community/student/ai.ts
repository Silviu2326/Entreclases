// Contrato entre las pantallas del estudiante y la función `study-tutor`.
// Las pantallas llaman a `askTutor` (respuesta completa) o `askTutorStream`
// (el texto va llegando); en la demo responde `demoTutor` sin red, y en cuentas
// reales la función de Supabase, que es la única que tiene la clave.

export type TutorLanguage = "es" | "va";
export type TutorMode = "explain" | "summary" | "keypoints" | "flashcards" | "quiz" | "chat";
export type QuizKind = "test" | "truefalse" | "short";

export type TutorImage = { media_type: "image/jpeg" | "image/png" | "image/webp"; data: string };
export type ChatTurn = { role: "user" | "assistant"; text: string };

/** Cómo quiere el alumno que le hablen. Va al system prompt; no cambia el modo. */
export type TutorStyle = {
  /** peer: un compañero que ayuda (por defecto). teacher: más formal y ordenado. simple: como para alguien que no sabe nada del tema. */
  tone: "peer" | "teacher" | "simple";
  /** short: lo justo. normal. long: con ejemplos y matices. */
  length: "short" | "normal" | "long";
};
export const defaultStyle: TutorStyle = { tone: "peer", length: "normal" };

export type TutorRequest = {
  mode: TutorMode;
  language: TutorLanguage;
  /** Apuntes en texto plano (ya extraídos del PDF o pegados). Hasta 60.000 caracteres. */
  notes: string;
  /** Fotos de apuntes, en base64 sin prefijo data:. Hasta 4. */
  images?: TutorImage[];
  /** Pregunta del alumno (modos explain y chat). */
  question?: string;
  /** Conversación previa (modo chat). Se envía entera; la función la recorta si hace falta. */
  history?: ChatTurn[];
  /** Modo quiz: cuántas preguntas y de qué tipo. */
  count?: 5 | 10 | 20;
  kind?: QuizKind;
  style?: TutorStyle;
  /** Solo lo pone askTutorStream. La función responde con SSE en los modos de texto. */
  stream?: boolean;
};

export type Flashcard = { front: string; back: string };
export type QuizQuestion = {
  id: string;
  topic: string;
  question: string;
  /** Solo en test y verdadero/falso. En verdadero/falso son exactamente ["Verdadero","Falso"] (o en valenciano). */
  options?: string[];
  /** Índice de la opción correcta (test, verdadero/falso) o respuesta modelo (desarrollo corto). */
  answer: number | string;
  explanation: string;
};

export type TutorResponse = {
  mode: TutorMode;
  /** Texto en Markdown sencillo (párrafos, listas, negritas). Modos explain, summary, keypoints y chat. */
  text?: string;
  flashcards?: Flashcard[];
  quiz?: QuizQuestion[];
  /** Temas detectados en los apuntes; sirven para agrupar la corrección del test. */
  topics?: string[];
  /** Aviso no bloqueante: texto recortado, imagen ilegible… */
  warning?: string;
};

/** Eventos SSE de la función en modo streaming: `data: {"delta":"…"}` varias veces y al final `data: {"done":true,"response":{…}}`. */
export type TutorStreamEvent = { delta: string } | { done: true; response: TutorResponse } | { error: string };

export class TutorUnavailableError extends Error {}

const LIMIT = 60_000;
export const STREAMING_MODES: ReadonlySet<TutorMode> = new Set(["explain", "summary", "keypoints", "chat"]);

function trim(request: TutorRequest): { payload: TutorRequest; cut: boolean } {
  const cut = request.notes.length > LIMIT;
  return { payload: { ...request, notes: cut ? request.notes.slice(0, LIMIT) : request.notes }, cut };
}
const cutWarning = (response: TutorResponse, cut: boolean): TutorResponse =>
  cut ? { ...response, warning: response.warning ?? "Solo se han usado los primeros 60.000 caracteres." } : response;

function unavailable(status: number | undefined) {
  return status === 404 || status === 503 || status === 401;
}

export async function askTutor(request: TutorRequest, options: { demo: boolean }): Promise<TutorResponse> {
  const { payload, cut } = trim({ ...request, stream: false });
  if (options.demo) {
    const { demoTutor } = await import("./demo-tutor");
    return cutWarning(await demoTutor(payload), cut);
  }
  const { getAuthClient } = await import("../../auth/client");
  const { data, error } = await getAuthClient().functions.invoke<TutorResponse>("study-tutor", { body: payload });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (unavailable(status)) throw new TutorUnavailableError("El tutor todavía no está activado para cuentas reales.");
    throw error;
  }
  if (!data) throw new Error("Respuesta vacía del tutor.");
  return cutWarning(data, cut);
}

/**
 * Igual que askTutor, pero en los modos de texto el contenido va llegando por
 * `onDelta` (texto acumulado hasta ese momento). Los modos estructurados
 * (flashcards, quiz) no se pueden trocear: llegan enteros al resolver.
 * `signal` cancela la petición (botón «Parar»).
 */
export async function askTutorStream(
  request: TutorRequest,
  options: { demo: boolean; onDelta: (accumulated: string) => void; signal?: AbortSignal },
): Promise<TutorResponse> {
  if (!STREAMING_MODES.has(request.mode)) return askTutor(request, { demo: options.demo });
  const { payload, cut } = trim({ ...request, stream: true });

  if (options.demo) {
    const { demoTutor } = await import("./demo-tutor");
    const full = cutWarning(await demoTutor({ ...payload, stream: false }), cut);
    const text = full.text ?? "";
    let shown = "";
    // Trozos de tamaño variable para que parezca escritura, no un contador.
    for (let i = 0; i < text.length;) {
      if (options.signal?.aborted) return { ...full, text: shown };
      const step = 6 + ((i * 7) % 18);
      shown = text.slice(0, Math.min(text.length, i + step));
      options.onDelta(shown);
      i += step;
      await new Promise(resolve => setTimeout(resolve, 18));
    }
    return full;
  }

  const [{ getAuthClient }, { authConfiguration }] = await Promise.all([import("../../auth/client"), import("../../auth/config")]);
  const session = await getAuthClient().auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new TutorUnavailableError("Hace falta iniciar sesión para usar el tutor.");

  const response = await fetch(`${authConfiguration.url.replace(/\/$/, "")}/functions/v1/study-tutor`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, apikey: authConfiguration.key, "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify(payload),
    signal: options.signal,
  });
  if (!response.ok) {
    if (unavailable(response.status)) throw new TutorUnavailableError("El tutor todavía no está activado para cuentas reales.");
    let message = `El tutor ha fallado (${response.status}).`;
    try { message = ((await response.json()) as { error?: string }).error ?? message; } catch { /* keep the generic message */ }
    throw new Error(message);
  }
  if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
    // La función puede contestar JSON de una pieza si el streaming no está desplegado todavía.
    return cutWarning((await response.json()) as TutorResponse, cut);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", accumulated = "", final: TutorResponse | null = null;
  const handle = (line: string) => {
    if (!line.startsWith("data:")) return;
    const raw = line.slice(5).trim();
    if (!raw) return;
    const event = JSON.parse(raw) as TutorStreamEvent;
    if ("error" in event) throw new Error(event.error);
    if ("done" in event) { final = event.response; return; }
    accumulated += event.delta;
    options.onDelta(accumulated);
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    lines.forEach(handle);
  }
  if (buffer.trim()) handle(buffer);
  return cutWarning(final ?? { mode: request.mode, text: accumulated }, cut);
}
