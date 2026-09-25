"use client";
// Shared note store used by both "Tutor de apuntes" and "Examíname", plus the
// pure logic (quiz grading, share text, tiny Markdown renderer) that either
// screen — or a plain test — can call without mounting React.
import { createElement, useCallback, useMemo, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n/routes";
import { formatGrade } from "./grades";
import { storageKey, useToolStore } from "./storage";
import type { QuizQuestion, TutorImage } from "./ai";

export type NoteDoc = {
  id: string;
  name: string;
  text: string;
  /** Never persisted: see the in-memory cache below. */
  images: TutorImage[];
  chars: number;
  addedAt: string; // ISO timestamp
};

export type NotesState = { docs: NoteDoc[] };
export const emptyNotes: NotesState = { docs: [] };

/** The store key both screens must use so they see the same uploaded notes. */
export function notesStoreKey(scope: { demo: boolean; userId: string }): string {
  return storageKey(scope, "notes");
}

// ---- Images: kept in memory only ----
// A photo of a page of notes, base64-encoded, is heavy enough that a handful
// of them can blow past the ~5MB localStorage quota and silently break the
// whole tool. So only `text` is written to disk; images live in this
// module-level registry (not React state, so it survives navigating between
// the two screens, but not a reload — the UI says so).
const imageRegistry = new Map<string, TutorImage[]>();

function cacheImages(docId: string, images: TutorImage[]) {
  if (images.length) imageRegistry.set(docId, images);
  else imageRegistry.delete(docId);
}
function cachedImages(docId: string): TutorImage[] {
  return imageRegistry.get(docId) ?? [];
}

/**
 * Reads/writes the shared notes store. `docs` always carries whatever images
 * are still cached for this tab; what actually reaches localStorage never
 * does (see `imageRegistry` above).
 */
export function useNotesStore(key: string) {
  const [state, setState, ready] = useToolStore<NotesState>(key, emptyNotes);
  const docs = useMemo(() => state.docs.map(doc => ({ ...doc, images: cachedImages(doc.id) })), [state.docs]);

  const addDoc = useCallback((doc: NoteDoc) => {
    cacheImages(doc.id, doc.images);
    setState(current => ({ docs: [...current.docs, { ...doc, images: [] }] }));
  }, [setState]);

  const removeDoc = useCallback((id: string) => {
    imageRegistry.delete(id);
    setState(current => ({ docs: current.docs.filter(doc => doc.id !== id) }));
  }, [setState]);

  return { docs, addDoc, removeDoc, ready };
}

/** Concatenates the selected documents into one notes blob for `askTutor`, capped at 4 images. */
export function combineNotes(docs: NoteDoc[], selectedIds: string[]): { notes: string; images: TutorImage[] } {
  const selected = docs.filter(doc => selectedIds.includes(doc.id));
  const notes = selected.map(doc => `## ${doc.name}\n\n${doc.text}`).join("\n\n");
  const images = selected.flatMap(doc => doc.images).slice(0, 4);
  return { notes, images };
}

// ---- Quiz grading ----

export type Translate = (es: string, va: string) => string;
export type TopicLevel = "strong" | "ok" | "weak";
export type TopicResult = { topic: string; correct: number; total: number; level: TopicLevel };
export type ReviewItem = { id: string; question: string; yours: string; right: string; explanation: string };
export type QuizResult = { score: number; correct: number; total: number; byTopic: TopicResult[]; review: ReviewItem[] };

function levelOf(correct: number, total: number): TopicLevel {
  if (total === 0) return "ok";
  const ratio = correct / total;
  if (ratio >= 0.8) return "strong";
  if (ratio >= 0.5) return "ok";
  return "weak";
}

/**
 * `short` questions cannot be auto-graded: the screen shows the model answer
 * and asks "¿Lo sabías?", then records that self-assessment as 1 (right) or
 * 0 (wrong) in `answers`. Everything else is an option index.
 */
export function isCorrectAnswer(question: QuizQuestion, given: number | string | undefined): boolean {
  if (question.options) return typeof given === "number" && given === question.answer;
  return given === 1 || given === "1";
}

export function gradeQuiz(quiz: QuizQuestion[], answers: Record<string, number | string>, t: Translate): QuizResult {
  const topics = new Map<string, { correct: number; total: number }>();
  const review: ReviewItem[] = [];
  let correctCount = 0;

  for (const question of quiz) {
    const given = answers[question.id];
    const right = isCorrectAnswer(question, given);
    if (right) correctCount++;
    const bucket = topics.get(question.topic) ?? { correct: 0, total: 0 };
    bucket.total++;
    if (right) bucket.correct++;
    topics.set(question.topic, bucket);

    if (!right) {
      const rightLabel = question.options ? (question.options[question.answer as number] ?? "—") : String(question.answer);
      const yoursLabel = question.options
        ? (typeof given === "number" ? question.options[given] ?? t("Sin responder", "Sense respondre") : t("Sin responder", "Sense respondre"))
        : t("Autoevaluación: no lo sabías", "Autoavaluació: no ho sabies");
      review.push({ id: question.id, question: question.question, yours: yoursLabel, right: rightLabel, explanation: question.explanation });
    }
  }

  const byTopic: TopicResult[] = [...topics.entries()].map(([topic, { correct, total }]) => ({ topic, correct, total, level: levelOf(correct, total) }));
  const total = quiz.length;
  const score = total === 0 ? 0 : Math.round((correctCount / total) * 100);
  return { score, correct: correctCount, total, byTopic, review };
}

/** Ids of the questions answered wrong, for "Repetir solo los fallos". */
export function wrongQuestionIds(quiz: QuizQuestion[], answers: Record<string, number | string>): string[] {
  return quiz.filter(question => !isCorrectAnswer(question, answers[question.id])).map(question => question.id);
}

/** Ready-to-paste bragging text: "He sacado 8,4 en el simulacro de Derecho Penal de Entreclases. ¿Lo superas?" */
export function shareText(result: QuizResult, subjectName: string, locale: Locale): string {
  const grade = formatGrade(result.score / 10, locale);
  const subject = subjectName.trim();
  if (locale === "va") {
    return subject
      ? `He tret un ${grade} en el simulacre de ${subject} d’Entreclases. El superes?`
      : `He tret un ${grade} en el simulacre d’Entreclases. El superes?`;
  }
  return subject
    ? `He sacado un ${grade} en el simulacro de ${subject} de Entreclases. ¿Lo superas?`
    : `He sacado un ${grade} en el simulacro de Entreclases. ¿Lo superas?`;
}

// ---- Tiny Markdown renderer ----
// Just enough for what the tutor answers with: paragraphs, **bold**, "- "/"1. "
// lists and "#" headings. Anything else stays as plain, escaped text — there
// is no HTML parsing involved, so nothing here can inject markup.

function renderInline(text: string, keyBase: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(part => part.length > 0);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return createElement("strong", { key: `${keyBase}-${index}` }, part.slice(2, -2));
    }
    return part;
  });
}

function renderLines(lines: string[], keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  lines.forEach((line, index) => {
    if (index > 0) nodes.push(createElement("br", { key: `${keyBase}-br${index}` }));
    nodes.push(...renderInline(line, `${keyBase}-${index}`));
  });
  return nodes;
}

export function renderMarkdown(text: string): ReactNode {
  const blocks = text.trim().split(/\n{2,}/).filter(block => block.trim().length > 0);
  return createElement(
    "div",
    { className: "nt-markdown" },
    blocks.map((block, blockIndex) => {
      const lines = block.split("\n").map(line => line.trim()).filter(line => line.length > 0);
      if (lines.length === 0) return null;
      const key = `b${blockIndex}`;

      const heading = lines.length === 1 ? /^(#{1,6})\s+(.*)$/.exec(lines[0]) : null;
      if (heading) {
        const tag = `h${Math.min(Number(heading[1].length) + 3, 6)}`;
        return createElement(tag, { key }, renderInline(heading[2], key));
      }

      if (lines.every(line => /^[-*]\s+/.test(line))) {
        return createElement("ul", { key }, lines.map((line, i) => createElement("li", { key: `${key}-${i}` }, renderInline(line.replace(/^[-*]\s+/, ""), `${key}-${i}`))));
      }

      if (lines.every(line => /^\d+[.)]\s+/.test(line))) {
        return createElement("ol", { key }, lines.map((line, i) => createElement("li", { key: `${key}-${i}` }, renderInline(line.replace(/^\d+[.)]\s+/, ""), `${key}-${i}`))));
      }

      return createElement("p", { key }, renderLines(lines, key));
    }),
  );
}
