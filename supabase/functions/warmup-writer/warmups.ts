// Las rondas de calentamiento del «juego del día» que propone la IA. Cada juego
// cambia solo lo que tiene sentido cambiar: frases en unos, el tema en otros. El
// equipo las revisa en el backoffice antes de que nadie las vea.
// Sin APIs de Deno: la aplicación y las pruebas lo importan también.

export type Pair = [string, string];
export type WarmupGame = "truth" | "questions" | "blind" | "debate" | "jury";
export type WarmupContent = { title?: Pair; options?: Pair[]; results: Pair[] };

type Shape = { title: boolean; options: number; results: number; brief: string };
export const warmupShapes: Record<WarmupGame, Shape> = {
 truth: { title: false, options: 3, results: 3, brief: "«Dos verdades y una trola». options: tres frases en primera persona sobre la vida universitaria en Valencia; dos plausibles y verdaderas, una trola graciosa pero creíble. results: lo que ve quien elige cada frase como la trola; la de la trola celebra el acierto y las otras revelan cuál era la trola." },
 questions: { title: false, options: 3, results: 3, brief: "«Sin dar la cara», preguntas anónimas a un compañero. options: tres preguntas cortas y amables que mandarías a quien se sienta a tu lado, sin nada íntimo, ofensivo ni sobre el físico. results: una reacción breve a cada elección." },
 blind: { title: false, options: 3, results: 3, brief: "«La cita empieza hablando», una conversación a ciegas de 48 horas. options: tres frases para romper el hielo, curiosas y ligeras, sin nada sexual ni sobre el físico. results: una reacción breve a cada elección." },
 debate: { title: true, options: 0, results: 2, brief: "«Defiende lo indefendible». title: una postura absurda y divertida sobre la vida cotidiana o universitaria, en una frase afirmativa (como «La pizza con piña es la mejor pizza.»), sin política, religión ni temas sensibles. results: primero la reacción a quien la defiende, después a quien la ataca." },
 jury: { title: true, options: 0, results: 2, brief: "«El jurado del campus». title: un dilema de convivencia universitaria corto y discutible (como «Salir de un grupo de clase sin avisar.»), sin señalar a nadie real. results: primero la reacción a quien vota a favor, después a quien vota en contra." },
};
export const warmupGames = Object.keys(warmupShapes) as WarmupGame[];

const pair = { type: "object", additionalProperties: false, required: ["es", "va"], properties: { es: { type: "string" }, va: { type: "string" } } } as const;
const list = (count: number) => ({ type: "array", minItems: count, maxItems: count, items: pair });

export function warmupSchema(game: WarmupGame) {
 const shape = warmupShapes[game];
 const properties: Record<string, unknown> = { results: list(shape.results) };
 if (shape.title) properties.title = pair;
 if (shape.options) properties.options = list(shape.options);
 const item = { type: "object", additionalProperties: false, required: Object.keys(properties), properties };
 return { type: "object", additionalProperties: false, required: ["items"], properties: { items: { type: "array", minItems: 1, maxItems: 5, items: item } } };
}

export function warmupInstructions(game: WarmupGame, count: number) {
 return [
  "Escribes rondas de calentamiento para Entreclases, una comunidad de estudiantes universitarios de Valencia.",
  `Juego: ${warmupShapes[game].brief}`,
  `Escribe ${count} rondas distintas entre sí. Cada texto va en castellano («es») y en valenciano normativo de la AVL («va»), con el mismo sentido.`,
  "Tono cercano, con humor y sin crueldad. Frases cortas: menos de 90 caracteres cada una. Sin emojis, sin Markdown, sin nombres de personas reales ni de profesores.",
  "Nada sexual, ofensivo, discriminatorio ni sobre alcohol o drogas.",
 ].join("\n");
}

const clean = (value: unknown, max = 140) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
const toPair = (value: unknown): Pair | null => {
 if (Array.isArray(value)) { const es = clean(value[0]), va = clean(value[1]); return es && va ? [es, va] : null; }
 if (!value || typeof value !== "object") return null;
 const item = value as Record<string, unknown>;
 const es = clean(item.es), va = clean(item.va);
 return es && va ? [es, va] : null;
};
const toPairs = (value: unknown, count: number) => {
 const pairs = Array.isArray(value) ? value.map(toPair) : [];
 return pairs.length === count && pairs.every(Boolean) ? pairs as Pair[] : null;
};

// Admite lo que devuelve el modelo ({es, va}) y lo que guarda la base de datos
// ([es, va]). Si algo no encaja con la forma del juego, se descarta entero.
export function normalizeWarmup(game: WarmupGame, raw: unknown): WarmupContent | null {
 const shape = warmupShapes[game];
 if (!shape || !raw || typeof raw !== "object") return null;
 const value = raw as Record<string, unknown>;
 const results = toPairs(value.results, shape.results);
 if (!results) return null;
 const content: WarmupContent = { results };
 if (shape.title) { const title = toPair(value.title); if (!title) return null; content.title = title; }
 if (shape.options) {
  const options = toPairs(value.options, shape.options);
  if (!options || new Set(options.map(option => option[0].toLowerCase())).size !== options.length) return null;
  content.options = options;
 }
 return content;
}

export const isWarmupGame = (value: unknown): value is WarmupGame => typeof value === "string" && value in warmupShapes;
