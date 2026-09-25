// Pure model + logic for the Tutor de apuntes workspace: saved conversations,
// their messages (including inline flashcards/quiz blocks) and the small
// helpers the screen needs to build requests, title chats and persist them.
// No React, no browser APIs — everything here is a plain function so it can
// be unit-tested without mounting anything.
import type { ChatTurn, Flashcard, QuizQuestion, TutorLanguage, TutorMode, TutorStyle } from "./ai";
import { defaultStyle } from "./ai";
import { newId, storageKey } from "./storage";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  mode: TutorMode;
  text: string;
  flashcards?: Flashcard[];
  quiz?: QuizQuestion[];
  topics?: string[];
  /** Quiz answers keyed by question id, only ever set on the message that carries that quiz. */
  answers?: Record<string, number | string>;
  at: string; // ISO timestamp
  status: "done" | "streaming" | "error";
  error?: string;
};

export type Chat = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  /** Which of the shared notes documents this conversation uses as context. */
  docIds: string[];
  style: TutorStyle;
  language: TutorLanguage;
  messages: ChatMessage[];
};

export type ChatsState = { chats: Chat[]; activeId: string | null };
export const emptyChats: ChatsState = { chats: [], activeId: null };

/** Same key namespace as the rest of the student tools; kept as its own helper for symmetry with `notesStoreKey`. */
export function chatsStoreKey(scope: { demo: boolean; userId: string }): string {
  return storageKey(scope, "tutor-chats");
}

const DEFAULT_TITLE: Record<TutorLanguage, string> = { es: "Nueva conversación", va: "Nova conversa" };
const TITLE_LENGTH = 48;

export function newChat(language: TutorLanguage, docIds: string[] = []): Chat {
  const now = new Date().toISOString();
  return { id: newId(), title: DEFAULT_TITLE[language], createdAt: now, updatedAt: now, docIds, style: defaultStyle, language, messages: [] };
}

export function isDefaultTitle(title: string): boolean {
  return title === DEFAULT_TITLE.es || title === DEFAULT_TITLE.va;
}

/** The first user question, trimmed to `TITLE_LENGTH` chars, or the default title while the chat is still empty. */
export function titleFor(chat: Chat): string {
  const firstQuestion = chat.messages.find(message => message.role === "user" && message.text.trim().length > 0);
  if (!firstQuestion) return DEFAULT_TITLE[chat.language];
  const text = firstQuestion.text.trim().replace(/\s+/g, " ");
  return text.length > TITLE_LENGTH ? `${text.slice(0, TITLE_LENGTH).trimEnd()}…` : text;
}

/**
 * The conversation history `askTutor` expects for mode "chat": only the plain
 * text of finished messages, in order. Streaming/error messages and anything
 * that only carries flashcards or a quiz (no real text) are left out, so a
 * half-arrived answer or a wall of quiz questions never pollutes the prompt.
 */
export function toHistory(messages: ChatMessage[]): ChatTurn[] {
  return messages
    .filter(message => message.status === "done" && message.text.trim().length > 0)
    .map(message => ({ role: message.role, text: message.text }));
}

export function appendMessage(chat: Chat, message: ChatMessage): Chat {
  return { ...chat, messages: [...chat.messages, message], updatedAt: message.at };
}

export function updateMessage(chat: Chat, id: string, patch: Partial<ChatMessage>): Chat {
  return {
    ...chat,
    updatedAt: new Date().toISOString(),
    messages: chat.messages.map(message => (message.id === id ? { ...message, ...patch } : message)),
  };
}

/**
 * Keeps at most `max` conversations, always keeping the active one even if it
 * is not among the most recently updated — deleting the chat the student is
 * looking at would be more surprising than going slightly over the limit.
 */
export function pruneChats(state: ChatsState, max = 30): ChatsState {
  if (state.chats.length <= max) return state;
  const active = state.activeId ? state.chats.find(chat => chat.id === state.activeId) : undefined;
  const others = state.chats.filter(chat => chat.id !== state.activeId).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  const slotsForOthers = active ? max - 1 : max;
  const kept = active ? [active, ...others.slice(0, Math.max(0, slotsForOthers))] : others.slice(0, slotsForOthers);
  return { ...state, chats: kept };
}

export type Suggestion = { mode: TutorMode; text: string };

/** The six starter prompts shown on the empty-conversation screen. */
export function suggestions(language: TutorLanguage): Suggestion[] {
  const va = language === "va";
  return [
    { mode: "explain", text: va ? "Explica-m’ho com si tinguera dotze anys" : "Explícamelo como si tuviera doce años" },
    { mode: "summary", text: va ? "Resumeix-ho en deu punts" : "Resúmelo en diez puntos" },
    { mode: "explain", text: va ? "Què és el més probable que caiga a l’examen?" : "¿Qué es lo más probable que caiga en el examen?" },
    { mode: "quiz", text: va ? "Fes-me deu preguntes tipus test" : "Hazme diez preguntas tipo test" },
    { mode: "flashcards", text: va ? "Fes-me targetes dels conceptes" : "Hazme tarjetas de los conceptos" },
    { mode: "chat", text: va ? "Pregunta’m fins que m’ho sàpiga" : "Pregúntame hasta que me lo sepa" },
  ];
}

/**
 * What actually reaches localStorage. A message stuck in "streaming" only
 * happens if the tab was closed or crashed mid-answer — the stream can never
 * resume, so it is turned into a gentle error instead of a spinner that never
 * stops. Flashcards and quiz blocks are kept: they are cheap text and the
 * whole point of saving the conversation is to find them again later.
 */
export function serializable(state: ChatsState): ChatsState {
  return {
    ...state,
    chats: state.chats.map(chat => ({
      ...chat,
      messages: chat.messages.map(message =>
        message.status === "streaming"
          ? { ...message, status: "error" as const, error: chat.language === "va" ? "S’ha interromput en tancar la pestanya." : "Se interrumpió al cerrar la pestaña." }
          : message,
      ),
    })),
  };
}
