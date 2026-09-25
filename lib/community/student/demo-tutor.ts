import type { ChatTurn, Flashcard, QuizKind, QuizQuestion, TutorLanguage, TutorRequest, TutorResponse } from "./ai";

// Deterministic, offline stand-in for the real tutor: no network, no key, but
// it actually reads the notes the user pastes, so the whole flow — paste
// notes, get a summary, get a quiz — can be tried end to end in the demo.

const MIN_NOTES_LENGTH = 200;

const STOPWORDS: Record<TutorLanguage, ReadonlySet<string>> = {
  es: new Set(["el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al", "a", "en", "y", "o", "que", "es", "son", "se", "su", "sus", "por", "para", "con", "como", "más", "pero", "no", "sí", "lo", "le", "les", "este", "esta", "estos", "estas", "ese", "esa", "esos", "esas", "también", "muy", "sobre", "entre", "cuando", "donde", "porque", "si", "ya", "fue", "ser", "estar", "hay", "han", "ha", "he", "has", "eso", "esto"]),
  va: new Set(["el", "la", "els", "les", "un", "una", "uns", "unes", "de", "del", "al", "a", "en", "i", "o", "que", "és", "són", "se", "per", "amb", "com", "més", "però", "no", "sí", "ho", "li", "este", "esta", "estos", "estes", "eixe", "eixa", "també", "molt", "sobre", "entre", "quan", "on", "perquè", "si", "ja", "fon", "ser", "estar", "hi", "han", "ha", "he", "has", "això", "açò"]),
};

const KEY_TERMS: Record<TutorLanguage, readonly string[]> = {
  es: ["clave", "importante", "definición", "fórmula", "concepto", "principal"],
  va: ["clau", "important", "definició", "fórmula", "concepte", "principal"],
};

const FALLBACK_TOPIC: Record<TutorLanguage, string> = { es: "Apuntes", va: "Apunts" };

// --- Small deterministic string helpers -----------------------------------

function splitParagraphs(notes: string): string[] {
  return notes.split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean);
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑÀÈÌÒÙÇ0-9])/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function words(text: string): string[] {
  return text.toLowerCase().match(/\p{L}+/gu) ?? [];
}

function capitalize(word: string): string {
  return word.length === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// A tiny seeded generator: same notes → same "random" choices, every time.
// No Math.random, no Date.now() — the demo must be reproducible for tests.
function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededPick<T>(items: readonly T[], seed: number, count: number): T[] {
  const pool = [...items];
  const picked: T[] = [];
  let s = seed >>> 0;
  while (picked.length < count && pool.length > 0) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const index = s % pool.length;
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

function shuffleWithAnswer(items: readonly string[], seed: number): { items: string[]; answerIndex: number } {
  const correct = items[0];
  const shuffled = seededPick(items, seed, items.length);
  return { items: shuffled, answerIndex: shuffled.indexOf(correct) };
}

// --- Topics -----------------------------------------------------------

function detectTopics(notes: string, language: TutorLanguage): string[] {
  const stop = STOPWORDS[language];
  const freq = new Map<string, number>();
  for (const w of words(notes)) {
    if (w.length <= 3 || stop.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = sorted.slice(0, 5).map(([w]) => capitalize(w));
  return top.length > 0 ? top : [FALLBACK_TOPIC[language]];
}

// --- Summary / key points -----------------------------------------------

function buildSummary(paragraphs: string[], language: TutorLanguage): string {
  const firsts = paragraphs.map(p => splitSentences(p)[0]).filter((s): s is string => Boolean(s)).slice(0, 10);
  if (firsts.length === 0) return language === "va" ? "No hi ha prou text per a fer un resum." : "No hay texto suficiente para hacer un resumen.";
  return firsts.map(s => `- ${s}`).join("\n");
}

function isKeypoint(sentence: string, language: TutorLanguage): boolean {
  const lower = sentence.toLowerCase();
  if (KEY_TERMS[language].some(term => lower.includes(term))) return true;
  if (/\d/.test(sentence)) return true;
  const tokens = sentence.split(/\s+/);
  return tokens.slice(1).some(token => /^[A-ZÁÉÍÓÚÑÀÈÌÒÙÇ][a-zà-ÿ]+/.test(token));
}

function buildKeypoints(sentences: string[], language: TutorLanguage): string {
  const points = sentences.filter(s => isKeypoint(s, language)).slice(0, 12);
  const chosen = points.length > 0 ? points : sentences.slice(0, 6);
  return chosen.map(s => `- ${s}`).join("\n");
}

// --- Explain / chat --------------------------------------------------

function relevantSentences(sentences: string[], question: string, language: TutorLanguage, limit: number): string[] {
  const qWords = new Set(words(question).filter(w => w.length > 2 && !STOPWORDS[language].has(w)));
  if (qWords.size === 0) return sentences.slice(0, limit);
  const scored = sentences.map(s => ({ s, overlap: words(s).filter(w => qWords.has(w)).length }));
  const relevant = scored.filter(x => x.overlap > 0).sort((a, b) => b.overlap - a.overlap).map(x => x.s);
  return (relevant.length > 0 ? relevant : sentences).slice(0, limit);
}

function lastQuestion(request: TutorRequest): string {
  if (request.question && request.question.trim()) return request.question.trim();
  const history: ChatTurn[] = request.history ?? [];
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user" && history[i].text.trim()) return history[i].text.trim();
  }
  return "";
}

function buildExplain(sentences: string[], question: string, language: TutorLanguage): string {
  const chosen = relevantSentences(sentences, question, language, 5);
  const body = chosen.map(s => `- ${s}`).join("\n");
  const closing = language === "va"
    ? "Això és el que trobe més relacionat amb el que preguntes, tot basat en els teus apunts."
    : "Esto es lo que encuentro más relacionado con lo que preguntas, todo basado en tus apuntes.";
  return `${body}\n\n${closing}`;
}

// --- Flashcards -----------------------------------------------------

const DEFINITION_PATTERN = /^(.{2,60}?)\s+(es|son|és|són|se define como|se defineix com)\s+(.+)$/i;

function extractDefinition(sentence: string): Flashcard | null {
  const colonIndex = sentence.indexOf(":");
  if (colonIndex > 0 && colonIndex < sentence.length - 1) {
    const front = sentence.slice(0, colonIndex).trim();
    const back = sentence.slice(colonIndex + 1).trim();
    if (front.length > 0 && front.length < 60 && back.length > 0) return { front, back };
  }
  const match = sentence.match(DEFINITION_PATTERN);
  if (match) {
    const front = match[1].trim();
    const back = capitalize(`${match[2]} ${match[3]}`.trim());
    return { front, back };
  }
  return null;
}

function buildFlashcards(sentences: string[]): Flashcard[] {
  const cards: Flashcard[] = [];
  const seenFronts = new Set<string>();
  for (const sentence of sentences) {
    const definition = extractDefinition(sentence);
    if (!definition || seenFronts.has(definition.front.toLowerCase())) continue;
    seenFronts.add(definition.front.toLowerCase());
    cards.push(definition);
  }
  if (cards.length < 12) {
    for (const sentence of sentences) {
      if (cards.length >= 20) break;
      if (extractDefinition(sentence)) continue; // already used above
      const front = sentence.split(/\s+/).slice(0, 4).join(" ").replace(/[.,;:]+$/, "");
      if (front.length === 0 || seenFronts.has(front.toLowerCase())) continue;
      seenFronts.add(front.toLowerCase());
      cards.push({ front, back: sentence });
    }
  }
  return cards.slice(0, 20);
}

// --- Quiz ------------------------------------------------------------

function pickTerm(sentence: string, topics: string[]): string | null {
  const lowerSentence = sentence.toLowerCase();
  for (const topic of topics) {
    if (lowerSentence.includes(topic.toLowerCase())) return topic;
  }
  const tokens = sentence.match(/\p{L}+/gu) ?? [];
  const capitalized = tokens.find((t, i) => i > 0 && /^[A-ZÁÉÍÓÚÑÀÈÌÒÙÇ]/.test(t));
  if (capitalized) return capitalized;
  const longest = [...tokens].filter(t => t.length > 4).sort((a, b) => b.length - a.length)[0];
  return longest ?? null;
}

function blankTerm(sentence: string, term: string): string {
  const pattern = new RegExp(escapeRegExp(term), "i");
  return pattern.test(sentence) ? sentence.replace(pattern, "____") : `${sentence} (____)`;
}

function buildQuiz(sentences: string[], topics: string[], language: TutorLanguage, count: number, kind: QuizKind, seed: number): QuizQuestion[] {
  const va = language === "va";
  const pool = (sentences.filter(s => words(s).length >= 4).length > 0 ? sentences.filter(s => words(s).length >= 4) : sentences);
  const allTerms = [...new Set(pool.map(s => pickTerm(s, topics)).filter((t): t is string => Boolean(t)))];
  const quiz: QuizQuestion[] = [];

  for (let i = 0; i < count; i++) {
    const sentence = pool[i % pool.length];
    const term = pickTerm(sentence, topics) ?? allTerms[i % Math.max(allTerms.length, 1)] ?? (va ? "concepte" : "concepto");
    const topic = topics[i % topics.length] ?? FALLBACK_TOPIC[language];
    const id = `q${i + 1}`;

    if (kind === "test") {
      const distractorPool = allTerms.filter(t => t.toLowerCase() !== term.toLowerCase());
      const distractors = seededPick(distractorPool, seed + i * 31, 3);
      let filler = 1;
      while (distractors.length < 3) {
        distractors.push(va ? `opció ${filler}` : `opción ${filler}`);
        filler += 1;
      }
      const shuffled = shuffleWithAnswer([term, ...distractors], seed + i * 7 + 1);
      quiz.push({
        id, topic, question: blankTerm(sentence, term), options: shuffled.items, answer: shuffled.answerIndex,
        explanation: va ? `La resposta és «${term}», tal com apareix als teus apunts.` : `La respuesta es «${term}», tal como aparece en tus apuntes.`,
      });
    } else if (kind === "truefalse") {
      const makeFalse = i % 2 === 1;
      const distractorPool = allTerms.filter(t => t.toLowerCase() !== term.toLowerCase());
      const swap = seededPick(distractorPool, seed + i * 13, 1)[0];
      const useFalse = makeFalse && Boolean(swap);
      const statement = useFalse ? blankTerm(sentence, term).replace("____", swap) : sentence;
      quiz.push({
        id, topic, question: statement, options: va ? ["Vertader", "Fals"] : ["Verdadero", "Falso"], answer: useFalse ? 1 : 0,
        explanation: useFalse
          ? (va ? `Fals: als apunts diu «${term}», no «${swap}».` : `Falso: en tus apuntes pone «${term}», no «${swap}».`)
          : (va ? "Vertader, tal com apareix als teus apunts." : "Verdadero, tal como aparece en tus apuntes."),
      });
    } else {
      quiz.push({
        id, topic, question: va ? `Defineix amb les teues paraules: ${term}.` : `Define con tus palabras: ${term}.`, answer: sentence,
        explanation: va ? "Compara la teua resposta amb el que diuen els apunts." : "Compara tu respuesta con lo que dicen los apuntes.",
      });
    }
  }
  return quiz;
}

// --- Entry point -----------------------------------------------------

export async function demoTutor(request: TutorRequest): Promise<TutorResponse> {
  const notes = request.notes.trim();
  const seed = hashSeed(`${request.mode}:${notes}`);
  const delay = 500 + (seed % 401); // 500-900ms, deterministic per request
  await new Promise(resolve => setTimeout(resolve, delay));

  const va = request.language === "va";
  const warning = notes.length < MIN_NOTES_LENGTH
    ? (va ? "Necessite més text per a treballar bé: enganxa uns quants paràgrafs més dels teus apunts." : "Necesito más texto para trabajar bien: pega unos cuantos párrafos más de tus apuntes.")
    : undefined;

  const paragraphs = splitParagraphs(notes);
  const sentences = paragraphs.flatMap(p => splitSentences(p));

  if (sentences.length === 0) {
    return {
      mode: request.mode,
      text: va ? "Encara no hi ha apunts per a treballar." : "Todavía no hay apuntes con los que trabajar.",
      warning: warning ?? (va ? "Enganxa el teu text per a continuar." : "Pega tu texto para continuar."),
    };
  }

  const topics = detectTopics(notes, request.language);

  switch (request.mode) {
    case "summary":
      return { mode: "summary", text: buildSummary(paragraphs, request.language), warning };
    case "keypoints":
      return { mode: "keypoints", text: buildKeypoints(sentences, request.language), topics, warning };
    case "explain":
      return { mode: "explain", text: buildExplain(sentences, request.question ?? "", request.language), warning };
    case "chat":
      return { mode: "chat", text: buildExplain(sentences, lastQuestion(request), request.language), warning };
    case "flashcards": {
      const flashcards = buildFlashcards(sentences);
      const shortWarning = flashcards.length < 6 ? (va ? "Pocs apunts: algunes targetes es repeteixen." : "Pocos apuntes: algunas tarjetas se repiten.") : undefined;
      return { mode: "flashcards", flashcards, warning: warning ?? shortWarning };
    }
    case "quiz": {
      const count = request.count ?? 5;
      const kind = request.kind ?? "test";
      const quiz = buildQuiz(sentences, topics, request.language, count, kind, seed);
      return { mode: "quiz", quiz, topics, warning };
    }
  }
}
