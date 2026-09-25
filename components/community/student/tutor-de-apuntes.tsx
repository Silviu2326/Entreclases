"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Plus, Search, Pencil, Trash2, Send, Square, Paperclip, Copy, RotateCcw, Layers, ClipboardCheck,
  ChevronLeft, ChevronRight, Shuffle, CheckCircle2, XCircle, Menu, PanelRight, Upload,
} from "lucide-react";
import { ToolShell, useTool, Notice } from "./shared";
import { Confirm } from "../controls";
import { toolPath } from "@/lib/community/student/catalog";
import { useNotesStore, notesStoreKey, combineNotes, gradeQuiz, wrongQuestionIds, renderMarkdown, type TopicLevel } from "@/lib/community/student/notes";
import { newId, readStore, writeStore } from "@/lib/community/student/storage";
import { ACCEPT, extractText } from "@/lib/community/student/extract";
import { askTutorStream, TutorUnavailableError, type TutorMode, type TutorStyle, type QuizKind, type QuizQuestion } from "@/lib/community/student/ai";
import {
  type Chat, type ChatMessage, type ChatsState, type Suggestion, emptyChats, chatsStoreKey,
  newChat, isDefaultTitle, titleFor, toHistory, appendMessage, updateMessage, pruneChats, suggestions, serializable,
} from "@/lib/community/student/chats";
import "./tutor-de-apuntes.css";

type Translate = (es: string, va: string) => string;

const COMPOSER_MODES: readonly TutorMode[] = ["chat", "explain", "summary", "keypoints", "flashcards", "quiz"];
const TONES: readonly TutorStyle["tone"][] = ["peer", "teacher", "simple"];
const LENGTHS: readonly TutorStyle["length"][] = ["short", "normal", "long"];
const QUIZ_COUNTS = [5, 10, 20] as const;

function modeChipLabel(mode: TutorMode, t: Translate): string {
  if (mode === "chat") return t("Preguntar", "Pregunta");
  if (mode === "explain") return t("Explicar", "Explica");
  if (mode === "summary") return t("Resumir", "Resumeix");
  if (mode === "keypoints") return t("Puntos clave", "Punts clau");
  if (mode === "flashcards") return t("Tarjetas", "Targetes");
  return t("Test", "Test");
}
function toneLabel(tone: TutorStyle["tone"], t: Translate): string {
  if (tone === "peer") return t("Compañero", "Company");
  if (tone === "teacher") return t("Profe", "Profe");
  return t("Muy simple", "Molt simple");
}
function lengthLabel(length: TutorStyle["length"], t: Translate): string {
  if (length === "short") return t("Corto", "Curt");
  if (length === "normal") return t("Normal", "Normal");
  return t("Largo", "Llarg");
}
function topicLevelLabel(level: TopicLevel, t: Translate): string {
  if (level === "strong") return t("Dominado", "Dominat");
  if (level === "ok") return t("Bien", "Bé");
  return t("Flojo", "Fluix");
}
function kindLabel(kind: QuizKind, t: Translate): string {
  if (kind === "test") return t("Test", "Test");
  if (kind === "truefalse") return t("V/F", "V/F");
  return t("Corto", "Curt");
}
function relativeTime(iso: string, t: Translate): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return t("ahora", "ara");
  if (minutes < 60) return t(`hace ${minutes} min`, `fa ${minutes} min`);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t(`hace ${hours} h`, `fa ${hours} h`);
  const days = Math.round(hours / 24);
  if (days < 7) return t(`hace ${days} d`, `fa ${days} d`);
  return new Date(iso).toLocaleDateString(t("es-ES", "ca-ES"));
}
function lastLine(chat: Chat): string {
  const last = chat.messages[chat.messages.length - 1];
  if (!last) return "";
  return last.text.replace(/\s+/g, " ").trim().slice(0, 60);
}

/**
 * Like `useToolStore`, but the value written to disk (pruned + serialized) is
 * allowed to differ from the live React value: a message mid-stream must stay
 * "streaming" in memory for the cursor to animate, while a stale "streaming"
 * message left over from a closed tab is exactly what `serializable` cleans
 * up when read back. `useToolStore` always writes the same object to both
 * places, so it can't express that split — hence this small variant, built
 * from the same `readStore`/`writeStore` primitives.
 */
function usePersistedChats(key: string): [ChatsState, (updater: ChatsState | ((current: ChatsState) => ChatsState)) => void, boolean] {
  const [state, setStateRaw] = useState<ChatsState>(emptyChats);
  const [ready, setReady] = useState(false);
  const emptyRef = useRef(emptyChats);
  useEffect(() => {
    setStateRaw(readStore(key, emptyRef.current));
    setReady(true);
  }, [key]);
  const setState = useCallback((updater: ChatsState | ((current: ChatsState) => ChatsState)) => {
    setStateRaw(current => {
      const resolved = typeof updater === "function" ? (updater as (current: ChatsState) => ChatsState)(current) : updater;
      writeStore(key, serializable(pruneChats(resolved)));
      return resolved;
    });
  }, [key]);
  return [state, setState, ready];
}

export default function TutorDeApuntes() {
  const { t, locale, demo, me } = useTool("notes");
  const notesKey = notesStoreKey({ demo, userId: me.user_id });
  const { docs, addDoc, removeDoc } = useNotesStore(notesKey);
  const [state, setState] = usePersistedChats(chatsStoreKey({ demo, userId: me.user_id }));

  // A brand-new conversation is never written to disk until the student
  // actually sends something — opening the tool should never touch storage.
  const [draft, setDraft] = useState<Chat>(() => newChat(locale, []));

  const active: Chat | null = state.activeId ? (state.chats.find(c => c.id === state.activeId) ?? null) : null;
  const chat: Chat = active ?? draft;
  const isDraft = active === null;
  // A fresh draft implicitly includes every note currently uploaded, without
  // ever writing that choice to state — it only becomes an explicit list the
  // moment the student deselects something, or the chat is first persisted.
  const effectiveDocIds = isDraft && chat.docIds.length === 0 ? docs.map(d => d.id) : chat.docIds;
  const includedDocs = docs.filter(d => effectiveDocIds.includes(d.id));

  const [composerMode, setComposerMode] = useState<TutorMode>("chat");
  const [quizCount, setQuizCount] = useState<5 | 10 | 20>(10);
  const [quizKind, setQuizKind] = useState<QuizKind>("test");
  const [draftText, setDraftText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showConversations, setShowConversations] = useState(false);
  const [showContext, setShowContext] = useState(false);

  const [reading, setReading] = useState(false);
  const [readWarning, setReadWarning] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [flashState, setFlashState] = useState<Record<string, { index: number; flipped: boolean }>>({});
  const [revealedShort, setRevealedShort] = useState<Set<string>>(new Set());
  const [corrected, setCorrected] = useState<Set<string>>(new Set());

  const threadRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);

  useEffect(() => {
    if (!pinnedToBottom) return;
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chat.messages, pinnedToBottom]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, [draftText]);

  useEffect(() => {
    if (!streaming) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") abortRef.current?.abort(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [streaming]);

  function handleScroll() {
    const el = threadRef.current;
    if (!el) return;
    setPinnedToBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 120);
  }

  // ---- Chat-level updates (title, style, language, doc selection) ----
  function patchChat(patch: Partial<Chat>) {
    const now = new Date().toISOString();
    if (isDraft) {
      setDraft(current => ({ ...current, ...patch, updatedAt: now }));
    } else {
      setState(current => ({ ...current, chats: current.chats.map(c => (c.id === chat.id ? { ...c, ...patch, updatedAt: now } : c)) }));
    }
  }
  function patchMessage(messageId: string, patch: Partial<ChatMessage>) {
    if (isDraft) {
      setDraft(current => updateMessage(current, messageId, patch));
    } else {
      setState(current => ({ ...current, chats: current.chats.map(c => (c.id === chat.id ? updateMessage(c, messageId, patch) : c)) }));
    }
  }
  function toggleDoc(id: string) {
    const next = effectiveDocIds.includes(id) ? effectiveDocIds.filter(x => x !== id) : [...effectiveDocIds, id];
    patchChat({ docIds: next });
  }

  // ---- Conversation list actions ----
  function startNewChat() {
    setDraft(newChat(chat.language, []));
    setState(current => ({ ...current, activeId: null }));
    setShowConversations(false);
  }
  function selectChat(id: string) {
    setState(current => ({ ...current, activeId: id }));
    setShowConversations(false);
  }
  function startRename(target: Chat) {
    setRenamingId(target.id);
    setRenameValue(target.title);
  }
  function commitRename(target: Chat) {
    const value = renameValue.trim();
    setRenamingId(null);
    if (!value || value === target.title) return;
    setState(current => ({ ...current, chats: current.chats.map(c => (c.id === target.id ? { ...c, title: value, updatedAt: new Date().toISOString() } : c)) }));
  }
  function deleteChat(id: string) {
    setState(current => ({ chats: current.chats.filter(c => c.id !== id), activeId: current.activeId === id ? null : current.activeId }));
  }

  // ---- Uploading / pasting notes ----
  async function ingest(files: FileList | File[]) {
    setReading(true); setReadError(null);
    const addedIds: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const extracted = await extractText(file);
        const text = extracted.text ?? "";
        const id = newId();
        addDoc({ id, name: file.name, text, images: extracted.images ?? [], chars: text.length, addedAt: new Date().toISOString() });
        addedIds.push(id);
        if (extracted.warning) setReadWarning(extracted.warning);
      } catch {
        setReadError(t("No se ha podido leer un archivo.", "No s’ha pogut llegir un arxiu."));
      }
    }
    setReading(false);
    if (addedIds.length > 0) patchChat({ docIds: [...effectiveDocIds, ...addedIds] });
  }

  // ---- Sending / streaming a request ----
  function priorQuestionFor(message: ChatMessage): string {
    const idx = chat.messages.findIndex(m => m.id === message.id);
    for (let i = idx - 1; i >= 0; i--) if (chat.messages[i].role === "user") return chat.messages[i].text;
    return "";
  }

  async function runRequest(opts: { mode: TutorMode; question: string; quiz?: { count: 5 | 10 | 20; kind: QuizKind }; regenerateId?: string }) {
    if (streaming) return;
    const targetChat = chat;
    const targetId = targetChat.id;
    const now = new Date().toISOString();
    const assistantId = opts.regenerateId ?? newId();
    const historySource = opts.regenerateId
      ? targetChat.messages.slice(0, Math.max(0, targetChat.messages.findIndex(m => m.id === assistantId)))
      : targetChat.messages;
    const userMessage: ChatMessage | null = opts.regenerateId
      ? null
      : { id: newId(), role: "user", mode: opts.mode, text: opts.question, at: now, status: "done" };

    setState(current => {
      const existing = current.chats.find(c => c.id === targetId);
      let base = existing ?? { ...targetChat, docIds: effectiveDocIds };
      if (userMessage) base = appendMessage(base, userMessage);
      base = opts.regenerateId
        ? updateMessage(base, assistantId, { text: "", status: "streaming", flashcards: undefined, quiz: undefined, topics: undefined, answers: undefined, error: undefined, mode: opts.mode })
        : appendMessage(base, { id: assistantId, role: "assistant", mode: opts.mode, text: "", at: now, status: "streaming" });
      const chats = existing ? current.chats.map(c => (c.id === targetId ? base : c)) : [...current.chats, base];
      return pruneChats({ chats, activeId: targetId });
    });

    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const applyToTarget = (updater: (c: Chat) => Chat) => {
      setState(current => ({ ...current, chats: current.chats.map(c => (c.id === targetId ? updater(c) : c)) }));
    };

    try {
      const { notes, images } = combineNotes(docs, effectiveDocIds);
      const response = await askTutorStream(
        {
          mode: opts.mode, language: targetChat.language, notes, images,
          question: opts.question || undefined,
          history: opts.mode === "chat" ? toHistory(historySource) : undefined,
          count: opts.quiz?.count, kind: opts.quiz?.kind, style: targetChat.style,
        },
        { demo, signal: controller.signal, onDelta: accumulated => applyToTarget(c => updateMessage(c, assistantId, { text: accumulated })) },
      );
      applyToTarget(c => {
        const text = (response.text ?? "") + (response.warning ? `\n\n${response.warning}` : "");
        let updated = updateMessage(c, assistantId, { text, flashcards: response.flashcards, quiz: response.quiz, topics: response.topics, status: "done" });
        if (isDefaultTitle(updated.title)) updated = { ...updated, title: titleFor(updated) };
        return updated;
      });
    } catch (error) {
      if (controller.signal.aborted) {
        applyToTarget(c => updateMessage(c, assistantId, { status: "done" }));
      } else if (error instanceof TutorUnavailableError) {
        applyToTarget(c => updateMessage(c, assistantId, { status: "error", error: "unavailable" }));
      } else {
        applyToTarget(c => updateMessage(c, assistantId, { status: "error", error: error instanceof Error ? error.message : String(error) }));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  const needsText = composerMode === "chat" || composerMode === "explain";
  const canSend = !streaming && (draftText.trim().length > 0 || !needsText);
  async function sendFromComposer() {
    if (!canSend) return;
    const mode = composerMode;
    const text = draftText.trim();
    setDraftText("");
    await runRequest({ mode, question: text, quiz: mode === "quiz" ? { count: quizCount, kind: quizKind } : undefined });
  }
  function sendSuggestion(suggestion: Suggestion) {
    setComposerMode(suggestion.mode);
    void runRequest({ mode: suggestion.mode, question: suggestion.text, quiz: suggestion.mode === "quiz" ? { count: quizCount, kind: quizKind } : undefined });
  }

  // ---- Per-message ephemeral UI state (flashcard position, quiz reveal/grade) ----
  function flashOf(messageId: string) { return flashState[messageId] ?? { index: 0, flipped: false }; }
  function setFlash(messageId: string, patch: Partial<{ index: number; flipped: boolean }>) {
    setFlashState(current => ({ ...current, [messageId]: { ...flashOf(messageId), ...patch } }));
  }
  function retryFails(message: ChatMessage, quiz: QuizQuestion[], answers: Record<string, number | string>) {
    const wrongIds = wrongQuestionIds(quiz, answers);
    patchMessage(message.id, { quiz: quiz.filter(q => wrongIds.includes(q.id)), answers: {} });
    setCorrected(current => { const next = new Set(current); next.delete(message.id); return next; });
    setRevealedShort(current => new Set([...current].filter(key => !key.startsWith(`${message.id}:`))));
  }

  function renderFlashcards(message: ChatMessage) {
    const cards = message.flashcards ?? [];
    if (cards.length === 0) return null;
    const raw = flashOf(message.id);
    const index = ((raw.index % cards.length) + cards.length) % cards.length;
    const card = cards[index];
    return (
      <div className="nt-flash">
        <button type="button" className={raw.flipped ? "nt-flash-card flipped" : "nt-flash-card"} aria-pressed={raw.flipped} onClick={() => setFlash(message.id, { flipped: !raw.flipped })}>
          <span>{raw.flipped ? card.back : card.front}</span>
        </button>
        <div className="nt-flash-row">
          <button type="button" className="nt-flash-icon" aria-label={t("Anterior", "Anterior")} onClick={() => setFlash(message.id, { index: index - 1, flipped: false })}><ChevronLeft aria-hidden="true" /></button>
          <span className="nt-flash-count">{index + 1} / {cards.length}</span>
          <button type="button" className="nt-flash-icon" aria-label={t("Siguiente", "Següent")} onClick={() => setFlash(message.id, { index: index + 1, flipped: false })}><ChevronRight aria-hidden="true" /></button>
          <button type="button" className="nt-flash-icon" aria-label={t("Barajar", "Barreja")} onClick={() => setFlash(message.id, { index: Math.floor(Math.random() * cards.length), flipped: false })}><Shuffle aria-hidden="true" /></button>
          <button type="button" className="st-button-ghost st-button" onClick={() => void navigator.clipboard?.writeText(cards.map(c => `${c.front} → ${c.back}`).join("\n"))}>
            <Copy aria-hidden="true" />{t("Copiar todas", "Copia-les totes")}
          </button>
        </div>
      </div>
    );
  }

  function renderQuiz(message: ChatMessage) {
    const quiz = message.quiz ?? [];
    if (quiz.length === 0) return null;
    const answers = message.answers ?? {};
    const isGraded = corrected.has(message.id);
    const grade = isGraded ? gradeQuiz(quiz, answers, t) : null;
    return (
      <div className="nt-quiz">
        {quiz.map(question => {
          const key = `${message.id}:${question.id}`;
          const revealed = revealedShort.has(key);
          return (
            <div key={question.id} className="nt-quiz-q">
              <div className="nt-quiz-q-head"><span>{question.topic}</span></div>
              <p className="nt-quiz-q-text">{question.question}</p>
              {question.options && (
                <div className="nt-quiz-options" role="group" aria-label={t("Opciones", "Opcions")}>
                  {question.options.map((option, i) => {
                    const picked = answers[question.id] === i;
                    const right = isGraded && i === question.answer;
                    const wrong = isGraded && picked && i !== question.answer;
                    return (
                      <button key={i} type="button" className={`nt-quiz-option${right ? " right" : ""}${wrong ? " wrong" : ""}`}
                        aria-pressed={picked} disabled={isGraded} onClick={() => patchMessage(message.id, { answers: { ...answers, [question.id]: i } })}>
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}
              {!question.options && (
                <div className="st-stack">
                  {!revealed && !isGraded && (
                    <>
                      <textarea className="st-textarea" placeholder={t("Escribe tu respuesta…", "Escriu la teua resposta…")} />
                      <button type="button" className="st-button st-button-secondary"
                        onClick={() => setRevealedShort(current => new Set(current).add(key))}>
                        {t("Ver respuesta modelo", "Veure resposta model")}
                      </button>
                    </>
                  )}
                  {(revealed || isGraded) && (
                    <div className="nt-quiz-short-answer">
                      <p className="st-muted">{t("Respuesta modelo:", "Resposta model:")}</p>
                      <p>{String(question.answer)}</p>
                      {!isGraded && (
                        <div className="st-row">
                          <button type="button" className="st-button" onClick={() => patchMessage(message.id, { answers: { ...answers, [question.id]: 1 } })}>
                            <CheckCircle2 aria-hidden="true" />{t("Lo sabía", "Ho sabia")}
                          </button>
                          <button type="button" className="st-button st-button-secondary" onClick={() => patchMessage(message.id, { answers: { ...answers, [question.id]: 0 } })}>
                            <XCircle aria-hidden="true" />{t("No lo sabía", "No ho sabia")}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {isGraded && <p className="nt-quiz-explain">{question.explanation}</p>}
            </div>
          );
        })}
        <div className="nt-quiz-actions">
          {!isGraded && <button type="button" className="st-button" onClick={() => setCorrected(current => new Set(current).add(message.id))}>{t("Corregir", "Corregix")}</button>}
          {isGraded && grade && (
            <>
              <div className="nt-grade">
                <strong>{grade.score} %</strong>
                <span className="st-muted">{t(`${grade.correct} de ${grade.total} correctas.`, `${grade.correct} de ${grade.total} correctes.`)}</span>
              </div>
              {grade.byTopic.length > 0 && (
                <ul className="nt-topics">
                  {grade.byTopic.map(topic => (
                    <li key={topic.topic} className="nt-topic-row">
                      <span>{topic.topic}</span>
                      <span className={`nt-topic-badge nt-tone-${topic.level}`}>{topicLevelLabel(topic.level, t)} · {topic.correct}/{topic.total}</span>
                    </li>
                  ))}
                </ul>
              )}
              {grade.review.length > 0 && (
                <button type="button" className="st-button st-button-secondary" onClick={() => retryFails(message, quiz, answers)}>
                  <RotateCcw aria-hidden="true" />{t("Repetir solo los fallos", "Repetir només les errades")}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  function renderActions(message: ChatMessage) {
    if (message.role !== "assistant" || message.status !== "done") return null;
    return (
      <div className="nt-msg-actions">
        <button type="button" className="nt-msg-action" onClick={() => { if (message.text) void navigator.clipboard?.writeText(message.text); }}>
          <Copy aria-hidden="true" />{t("Copiar", "Copia")}
        </button>
        <button type="button" className="nt-msg-action" onClick={() => void runRequest({ mode: message.mode, question: priorQuestionFor(message), regenerateId: message.id, quiz: message.mode === "quiz" ? { count: quizCount, kind: quizKind } : undefined })}>
          <RotateCcw aria-hidden="true" />{t("Regenerar", "Regenera")}
        </button>
        <button type="button" className="nt-msg-action" onClick={() => void runRequest({ mode: "flashcards", question: t("Sobre tu respuesta anterior: hazme tarjetas de esto.", "Sobre la teua resposta anterior: fes-me targetes d’això.") })}>
          <Layers aria-hidden="true" />{t("Hazme tarjetas de esto", "Fes-me targetes d’això")}
        </button>
        <button type="button" className="nt-msg-action" onClick={() => void runRequest({ mode: "quiz", question: t("Sobre tu respuesta anterior: hazme un test de esto.", "Sobre la teua resposta anterior: fes-me un test d’això."), quiz: { count: quizCount, kind: quizKind } })}>
          <ClipboardCheck aria-hidden="true" />{t("Hazme un test de esto", "Fes-me un test d’això")}
        </button>
      </div>
    );
  }

  function renderBody(message: ChatMessage) {
    if (message.role === "user") return <div className="nt-bubble">{message.text}</div>;
    if (message.status === "error") {
      if (message.error === "unavailable") {
        return (
          <div className="nt-bubble error">
            <p>
              {t("El tutor todavía no está activado en cuentas reales. ", "El tutor encara no està activat en comptes reals. ")}
              <Link href={toolPath(locale, true, "notes")}>{t("Pruébalo en la demo", "Prova-ho en la demo")}</Link>
            </p>
          </div>
        );
      }
      return (
        <div className="nt-bubble error">
          <p>{t("Algo ha fallado al responder.", "Alguna cosa ha fallat en respondre.")}</p>
          <button type="button" className="st-button st-button-secondary"
            onClick={() => void runRequest({ mode: message.mode, question: priorQuestionFor(message), regenerateId: message.id })}>
            {t("Reintentar", "Reintenta")}
          </button>
        </div>
      );
    }
    // A "done" message with no text (a pure flashcards/quiz reply) skips the
    // bubble entirely instead of showing an empty box above the cards.
    if (!message.text && message.status === "done") return null;
    return (
      <div className="nt-bubble">
        {message.text ? renderMarkdown(message.text) : <span className="st-muted">{t("Pensando…", "Pensant…")}</span>}
        {message.status === "streaming" && <span className="nt-cursor" aria-hidden="true" />}
      </div>
    );
  }

  const chars = includedDocs.reduce((sum, d) => sum + d.chars, 0);
  const photos = includedDocs.reduce((sum, d) => sum + d.images.length, 0);
  const contextSummary = t(
    `Contexto: ${includedDocs.length} documento${includedDocs.length === 1 ? "" : "s"} · ${chars.toLocaleString("es-ES")} caracteres${photos > 0 ? ` · ${photos} foto${photos === 1 ? "" : "s"}` : ""}`,
    `Context: ${includedDocs.length} document${includedDocs.length === 1 ? "" : "s"} · ${chars.toLocaleString("ca-ES")} caràcters${photos > 0 ? ` · ${photos} foto${photos === 1 ? "" : "s"}` : ""}`,
  );

  const sortedChats = [...state.chats].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  const query = search.trim().toLowerCase();
  const filteredChats = query
    ? sortedChats.filter(c => c.title.toLowerCase().includes(query) || lastLine(c).toLowerCase().includes(query))
    : sortedChats;

  return (
    <ToolShell id="notes" local={false}>
      <div className="nt-topbar">
        <button type="button" className="st-button st-button-secondary nt-conv-toggle" onClick={() => setShowConversations(true)}>
          <Menu aria-hidden="true" />{t("Conversaciones", "Converses")}
        </button>
        <button type="button" className="st-button st-button-secondary nt-context-toggle" onClick={() => setShowContext(true)}>
          <PanelRight aria-hidden="true" />{t("Contexto", "Context")}
        </button>
      </div>

      <div className="nt-studio">
        <aside className={showConversations ? "nt-side open" : "nt-side"}>
          <div className="nt-side-head">
            <button type="button" className="st-button nt-new" onClick={startNewChat}><Plus aria-hidden="true" />{t("Nueva conversación", "Nova conversa")}</button>
            <label className="nt-search">
              <Search aria-hidden="true" />
              <input className="st-input" value={search} onChange={event => setSearch(event.target.value)} placeholder={t("Buscar…", "Busca…")} aria-label={t("Buscar conversaciones", "Busca converses")} />
            </label>
          </div>
          {filteredChats.length === 0 ? (
            <p className="nt-side-empty">{state.chats.length === 0 ? t("Todavía no tienes conversaciones.", "Encara no tens converses.") : t("Sin resultados.", "Sense resultats.")}</p>
          ) : (
            <ul className="nt-conversations">
              {filteredChats.map(item => (
                <li key={item.id} className={item.id === state.activeId ? "nt-conversation active" : "nt-conversation"}>
                  {renamingId === item.id ? (
                    <input className="nt-rename-input" autoFocus value={renameValue}
                      onChange={event => setRenameValue(event.target.value)}
                      onBlur={() => commitRename(item)}
                      onKeyDown={event => { if (event.key === "Enter") commitRename(item); if (event.key === "Escape") setRenamingId(null); }} />
                  ) : (
                    <button type="button" className="nt-conversation-btn" onDoubleClick={() => startRename(item)} onClick={() => selectChat(item.id)}>
                      <span className="nt-conversation-title">{item.title}</span>
                      <span className="nt-conversation-meta"><span>{relativeTime(item.updatedAt, t)}</span><span>{lastLine(item)}</span></span>
                    </button>
                  )}
                  {renamingId !== item.id && (
                    <div className="nt-conversation-actions">
                      <button type="button" className="nt-conversation-icon" aria-label={t("Renombrar", "Reanomena")} onClick={() => startRename(item)}><Pencil aria-hidden="true" /></button>
                      <Confirm title={t("Borrar conversación", "Esborra la conversa")}
                        description={t("Esta conversación se borrará de este navegador. No se puede deshacer.", "Esta conversa s’esborrarà d’este navegador. No es pot desfer.")}
                        onConfirm={() => { deleteChat(item.id); return Promise.resolve(true); }}>
                        <button type="button" className="nt-conversation-icon" aria-label={t("Borrar", "Esborra")}><Trash2 aria-hidden="true" /></button>
                      </Confirm>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="st-local-note">{t("Tus conversaciones se guardan en este navegador.", "Les teues converses es guarden en este navegador.")}</p>
        </aside>

        <div className="nt-thread-col">
          <div className="nt-thread" ref={threadRef} onScroll={handleScroll} aria-live="polite">
            {chat.messages.length === 0 ? (
              <div className="nt-empty">
                <h3>{t("¿Por dónde empezamos?", "Per on comencem?")}</h3>
                {includedDocs.length === 0 && (
                  <Notice tone="warn">
                    {t("Aún no has adjuntado apuntes: puedes preguntar igual, pero el tutor responde mucho mejor con ellos. ", "Encara no has adjuntat apunts: pots preguntar igualment, però el tutor respon molt millor amb ells. ")}
                    <button type="button" className="st-button-ghost st-button" onClick={() => setShowContext(true)}>{t("Adjuntar", "Adjuntar")}</button>
                  </Notice>
                )}
                <div className="nt-suggestions">
                  {suggestions(chat.language).map((suggestion, index) => (
                    <button key={index} type="button" className="nt-suggestion" onClick={() => sendSuggestion(suggestion)}>{suggestion.text}</button>
                  ))}
                </div>
              </div>
            ) : (
              chat.messages.map(message => (
                <div key={message.id} className={message.role === "user" ? "nt-msg nt-msg-user" : "nt-msg nt-msg-assistant"}>
                  {message.role === "assistant" && (
                    <span className="nt-msg-mark" aria-hidden="true"><Image src="/brand/entreclase-mark.png" alt="" width={20} height={20} /></span>
                  )}
                  <div className="nt-msg-body">
                    {renderBody(message)}
                    {message.status === "done" && renderFlashcards(message)}
                    {message.status === "done" && renderQuiz(message)}
                    {renderActions(message)}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className={dragOver ? "nt-composer dragover" : "nt-composer"}
            onDragOver={event => { event.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={event => { event.preventDefault(); setDragOver(false); if (event.dataTransfer.files.length) void ingest(event.dataTransfer.files); }}>
            <div className="nt-modes" role="group" aria-label={t("Qué le pides", "Què li demanes")}>
              {COMPOSER_MODES.map(mode => (
                <button key={mode} type="button" className="nt-mode-chip" aria-pressed={composerMode === mode} onClick={() => setComposerMode(mode)}>
                  {modeChipLabel(mode, t)}
                </button>
              ))}
            </div>
            {composerMode === "quiz" && (
              <div className="nt-quiz-opts">
                <select value={quizCount} onChange={event => setQuizCount(Number(event.target.value) as 5 | 10 | 20)} aria-label={t("Número de preguntas", "Nombre de preguntes")}>
                  {QUIZ_COUNTS.map(count => <option key={count} value={count}>{count}</option>)}
                </select>
                <select value={quizKind} onChange={event => setQuizKind(event.target.value as QuizKind)} aria-label={t("Tipo de preguntas", "Tipus de preguntes")}>
                  <option value="test">{kindLabel("test", t)}</option>
                  <option value="truefalse">{kindLabel("truefalse", t)}</option>
                  <option value="short">{kindLabel("short", t)}</option>
                </select>
              </div>
            )}
            <div className="nt-composer-row">
              <label className="nt-composer-icon" title={t("Adjuntar apuntes", "Adjuntar apunts")}>
                <Paperclip aria-hidden="true" />
                <input type="file" multiple accept={ACCEPT} className="nt-file-input" disabled={reading}
                  onChange={event => { if (event.target.files?.length) void ingest(event.target.files); event.target.value = ""; }} />
              </label>
              <textarea ref={textareaRef} className="nt-textarea" rows={1} value={draftText}
                onChange={event => setDraftText(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendFromComposer(); }
                  if (event.key === "Escape" && streaming) abortRef.current?.abort();
                }}
                placeholder={needsText ? t("Escribe tu pregunta…", "Escriu la teua pregunta…") : t("Añade una instrucción si quieres (opcional)…", "Afig una instrucció si vols (opcional)…")} />
              {streaming ? (
                <button type="button" className="st-button nt-composer-send" onClick={() => abortRef.current?.abort()}>
                  <Square aria-hidden="true" />{t("Parar", "Para")}
                </button>
              ) : (
                <button type="button" className="st-button nt-composer-send" disabled={!canSend} onClick={() => void sendFromComposer()} aria-label={t("Enviar", "Envia")}>
                  <Send aria-hidden="true" />
                </button>
              )}
            </div>
            {readWarning && <Notice tone="warn">{readWarning}</Notice>}
            {readError && <Notice tone="error">{readError}</Notice>}
            <div className="nt-composer-foot"><span>{contextSummary}</span></div>
          </div>
        </div>

        <aside className={showContext ? "nt-aside open" : "nt-aside"}>
          <button type="button" className="nt-drawer-close st-button-ghost st-button" onClick={() => setShowContext(false)}>{t("Cerrar", "Tanca")}</button>
          {demo && <Notice>{t("En la demo el tutor responde con reglas en tu navegador; con cuenta real responde la IA.", "En la demo el tutor respon amb regles en el teu navegador; amb compte real respon la IA.")}</Notice>}

          <div>
            <h3>{t("Apuntes adjuntos", "Apunts adjunts")}</h3>
            {docs.length === 0 ? (
              <p className="st-muted">{t("Todavía no has subido apuntes.", "Encara no has pujat apunts.")}</p>
            ) : (
              <ul className="nt-context-list">
                {docs.map(doc => (
                  <li key={doc.id} className="nt-context-doc">
                    <label>
                      <input type="checkbox" checked={effectiveDocIds.includes(doc.id)} onChange={() => toggleDoc(doc.id)} />
                      <span className="name">{doc.name}</span>
                    </label>
                    <span className="size">{doc.chars.toLocaleString(locale === "va" ? "ca-ES" : "es-ES")}</span>
                    <Confirm title={t("Quitar de tus apuntes", "Lleva dels teus apunts")}
                      description={t("Se borrará de tu almacén de apuntes compartido; las conversaciones que lo usaban dejarán de incluirlo.", "S’esborrarà del teu magatzem d’apunts compartit; les converses que l’usaven deixaran d’incloure’l.")}
                      onConfirm={() => { removeDoc(doc.id); return Promise.resolve(true); }}>
                      <button type="button" className="nt-context-remove" aria-label={t("Quitar", "Lleva")}><Trash2 aria-hidden="true" /></button>
                    </Confirm>
                  </li>
                ))}
              </ul>
            )}
            <div className="nt-context-drop" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (event.dataTransfer.files.length) void ingest(event.dataTransfer.files); }}>
              <Upload aria-hidden="true" />
              <label className="st-button st-button-secondary nt-file-label">
                {t("Añadir apuntes", "Afig apunts")}
                <input type="file" multiple accept={ACCEPT} className="nt-file-input" disabled={reading}
                  onChange={event => { if (event.target.files?.length) void ingest(event.target.files); event.target.value = ""; }} />
              </label>
            </div>
            <p className="st-muted">{t("Las fotos no se guardan al cerrar; el texto sí.", "Les fotos no es guarden en tancar; el text sí.")}</p>
          </div>

          <div className="nt-style-group">
            <h3>{t("Estilo", "Estil")}</h3>
            <span className="nt-style-label">{t("Tono", "To")}</span>
            <div className="nt-chips" role="group" aria-label={t("Tono", "To")}>
              {TONES.map(tone => (
                <button key={tone} type="button" className="nt-chip" aria-pressed={chat.style.tone === tone} onClick={() => patchChat({ style: { ...chat.style, tone } })}>
                  {toneLabel(tone, t)}
                </button>
              ))}
            </div>
            <span className="nt-style-label">{t("Extensión", "Extensió")}</span>
            <div className="nt-chips" role="group" aria-label={t("Extensión", "Extensió")}>
              {LENGTHS.map(length => (
                <button key={length} type="button" className="nt-chip" aria-pressed={chat.style.length === length} onClick={() => patchChat({ style: { ...chat.style, length } })}>
                  {lengthLabel(length, t)}
                </button>
              ))}
            </div>
            <span className="nt-style-label">{t("Idioma de la respuesta", "Idioma de la resposta")}</span>
            <div className="nt-chips" role="group" aria-label={t("Idioma de la respuesta", "Idioma de la resposta")}>
              <button type="button" className="nt-chip" aria-pressed={chat.language === "es"} onClick={() => patchChat({ language: "es" })}>{t("Español", "Espanyol")}</button>
              <button type="button" className="nt-chip" aria-pressed={chat.language === "va"} onClick={() => patchChat({ language: "va" })}>{t("Valencià", "Valencià")}</button>
            </div>
          </div>
        </aside>
      </div>

      {(showConversations || showContext) && (
        <button type="button" className="nt-scrim" aria-label={t("Cerrar", "Tanca")} onClick={() => { setShowConversations(false); setShowContext(false); }} />
      )}
    </ToolShell>
  );
}
