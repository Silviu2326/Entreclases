// Lo que la IA prepara de un apunte y cómo se comprueba antes de guardarlo.
// Sin APIs de Deno: las pruebas lo importan desde Node.

export type Card = { front: string; back: string };
export type Question = { question: string; options: string[]; answer: number; why: string };
export type Study = { language: "es" | "va" | "en" | "other"; summary: string[]; cards: Card[]; quiz: Question[] };

// Un PDF con menos texto que esto es casi seguro un escaneo o una foto.
export const minCharacters = 400;
export const maxPages = 80;
export const maxCharacters = 240_000;

// El modo estricto de OpenAI no admite maxLength: la longitud la recorta normalizeStudy.
const text = { type: "string" } as const;
export const studySchema = {
 type: "object",
 additionalProperties: false,
 required: ["language", "summary", "cards", "quiz"],
 properties: {
  language: { type: "string", enum: ["es", "va", "en", "other"] },
  summary: { type: "array", minItems: 3, maxItems: 8, items: text },
  cards: {
   type: "array", minItems: 6, maxItems: 15,
   items: { type: "object", additionalProperties: false, required: ["front", "back"], properties: { front: text, back: text } },
  },
  quiz: {
   type: "array", minItems: 5, maxItems: 10,
   items: {
    type: "object", additionalProperties: false, required: ["question", "options", "answer", "why"],
    properties: { question: text, options: { type: "array", minItems: 4, maxItems: 4, items: text }, answer: { type: "integer", minimum: 0, maximum: 3 }, why: text },
   },
  },
 },
} as const;

export const studyInstructions = [
 "Preparas material de estudio a partir de los apuntes de un estudiante universitario de Valencia.",
 "Usa solo lo que dicen los apuntes. No añadas datos, fechas ni fórmulas que no aparezcan en ellos.",
 "Escribe en el mismo idioma que los apuntes. Si están en valenciano o catalán, escribe en valenciano normativo (AVL). Indica ese idioma en «language».",
 "summary: entre 3 y 8 ideas clave, una frase clara cada una, en el orden de los apuntes.",
 "cards: entre 6 y 15 tarjetas. «front» es una pregunta o un concepto; «back», la respuesta breve.",
 "quiz: 10 preguntas de opción múltiple (menos si los apuntes no dan para tanto, nunca menos de 5). Cuatro opciones plausibles, una sola correcta; «answer» es su posición empezando en 0. Reparte la posición de la correcta. «why» explica en una frase por qué es la correcta, según los apuntes.",
 "No uses Markdown. Tono directo, sin relleno.",
].join("\n");

export const askInstructions = [
 "Respondes dudas de un estudiante sobre sus apuntes, que tienes a continuación.",
 "Responde solo con lo que dicen los apuntes. Si la respuesta no está en ellos, dilo en una frase y sugiere qué parte revisar.",
 "Contesta en el idioma de la pregunta. Si es valenciano, usa valenciano normativo (AVL).",
 "Máximo 120 palabras, sin Markdown.",
].join("\n");

const clean = (value: unknown, max: number) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

// Lo que devuelve el modelo pasa por aquí aunque el esquema sea estricto: si algo
// no encaja, se descarta la pieza en vez de enseñarla rota.
export function normalizeStudy(raw: unknown): Study | null {
 if (!raw || typeof raw !== "object") return null;
 const value = raw as Record<string, unknown>;
 const language = (["es", "va", "en", "other"] as const).find(code => code === value.language) ?? "other";
 const summary = (Array.isArray(value.summary) ? value.summary : []).map(item => clean(item, 400)).filter(Boolean).slice(0, 8);
 const cards = (Array.isArray(value.cards) ? value.cards : []).flatMap(item => {
  const card = item as Record<string, unknown>;
  const front = clean(card?.front, 200), back = clean(card?.back, 400);
  return front && back ? [{ front, back }] : [];
 }).slice(0, 15);
 const quiz = (Array.isArray(value.quiz) ? value.quiz : []).flatMap(item => {
  const entry = item as Record<string, unknown>;
  const question = clean(entry?.question, 300), why = clean(entry?.why, 400);
  const options = Array.isArray(entry?.options) ? entry.options.map(option => clean(option, 200)) : [];
  const answer = entry?.answer;
  const valid = question && options.length === 4 && options.every(Boolean) && new Set(options).size === 4 && Number.isInteger(answer) && (answer as number) >= 0 && (answer as number) <= 3;
  return valid ? [{ question, options, answer: answer as number, why }] : [];
 }).slice(0, 10);
 if (summary.length < 3 || cards.length < 4 || quiz.length < 5) return null;
 return { language, summary, cards, quiz };
}

// El texto extraído del PDF, compacto y con los saltos de página marcados.
export function tidySource(pages: string[]): string {
 return pages.map(page => page.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()).filter(Boolean).join("\n\n---\n\n");
}

export function sourceVerdict(pages: number, source: string): "ok" | "unreadable" | "too_long" {
 if (pages > maxPages || source.length > maxCharacters) return "too_long";
 if (source.replace(/\s/g, "").length < minCharacters) return "unreadable";
 return "ok";
}
