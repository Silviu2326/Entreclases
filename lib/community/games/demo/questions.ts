import { demoContext, type DemoContext } from "./store";
import { audienceLabel, audienceReach, sameAudience } from "../audience";
import { inHours, minAnonymousAudience, minutesLeft, nowIso, past, type Audience, type AudienceKind, type GamePerson, type GameWorld } from "../types";

/**
 * Sin dar la cara: anonymous questions. Two mechanics share one engine.
 * A "directed" question (to one person, or to each contact separately) sits
 * privately in a mailbox until the recipient answers. A "board" question is
 * public from the moment it is asked, and anyone in its audience can answer.
 * The asker is never revealed, in either case, to anyone but moderation.
 */

const DAILY_LIMIT = 5;
export const NOTE_MAX_LENGTH = 240;

export type QuestionStatus = "delivered" | "seen" | "answered_private" | "answered_public" | "discarded" | "expired";
/** The five choices for "quien puede preguntarme". Narrower than every AudienceKind: a single person is not a setting. */
export type AllowKind = "campus" | "degree" | "course" | "group" | "contacts";

type Answer = { id: string; text: string; anon: boolean; authorId: string; created_at: string };

/** A question sent to exactly one person's mailbox. `from` is hidden from every view the asker's target sees. */
type Directed = {
  id: string;
  kind: "directed";
  from: string;
  target: string;
  /** Shared by every message a single "mis contactos" send fanned out to. */
  batch?: string;
  text: string;
  status: QuestionStatus;
  created_at: string;
  expires: string;
  likes: string[];
  answer?: Answer & { public: boolean };
};

/** A question posted straight to a board, with no single recipient. */
type Board = {
  id: string;
  kind: "board";
  audience: Audience;
  mine: boolean;
  withdrawn: boolean;
  text: string;
  created_at: string;
  expires: string;
  likes: string[];
  answers: Answer[];
};

type Question = Directed | Board;

type Settings = { open: boolean; allow: AllowKind };

type Store = {
  onboarded: boolean;
  settings: Settings;
  questions: Question[];
  /** People who can no longer reach my mailbox. Never surfaced to anyone. */
  blocked: string[];
  reports: { text: string; from: string; at: string }[];
  day: number;
  askedToday: number;
};

// ---- view shapes, what the screen actually reads -------------------------

export type SentQuestion = {
  id: string;
  text: string;
  audienceLabel: string;
  status: QuestionStatus;
  createdAt: string;
  /** Days left before it can still resolve, or null once it is settled one way or another. */
  daysLeft: number | null;
  targets: number;
  answers: { text: string; public: boolean }[];
};

export type InboxCard = { id: string; text: string; createdAt: string; daysLeft: number };

export type BoardAnswerView = { id: string; text: string; anon: boolean; authorId?: string; authorName?: string; mine: boolean };
export type BoardQuestionView = {
  id: string;
  text: string;
  mine: boolean;
  createdAt: string;
  closesInDays: number;
  likes: number;
  likedByMe: boolean;
  canWithdraw: boolean;
  answers: BoardAnswerView[];
};
export type BoardView = { kind: AudienceKind; ref?: string; label: string; reach: number; questions: BoardQuestionView[] };

export type State = {
  onboarded: boolean;
  dailyLeft: number;
  dailyLimit: number;
  settings: Settings;
  sent: SentQuestion[];
  inbox: InboxCard[];
  boards: BoardView[];
};

// ---- helpers ---------------------------------------------------------------

const isDirected = (q: Question): q is Directed => q.kind === "directed";
const isBoard = (q: Question): q is Board => q.kind === "board";

function directedStatus(q: Directed): QuestionStatus {
  if (q.status === "discarded") return "discarded";
  if (q.answer) return q.answer.public ? "answered_public" : "answered_private";
  if (past(q.expires)) return "expired";
  return q.status;
}

function boardStatus(q: Board): QuestionStatus {
  if (q.withdrawn) return "discarded";
  if (q.answers.length > 0) return "answered_public";
  if (past(q.expires)) return "expired";
  return "delivered";
}

/** The most useful status to show when several messages of one send resolved differently. */
const STATUS_PRIORITY: QuestionStatus[] = ["answered_public", "answered_private", "seen", "delivered", "discarded", "expired"];
const bestStatus = (list: QuestionStatus[]): QuestionStatus => STATUS_PRIORITY.find(status => list.includes(status)) ?? "delivered";

const daysLeft = (expires: string) => Math.max(0, Math.ceil(minutesLeft(expires) / 1440));

/** Whether someone other than the person allowed to be talked about is named in the text. First names only: good enough for a demo. */
function namesSomeoneElse(text: string, world: GameWorld, allowedId?: string): boolean {
  const lower = text.toLocaleLowerCase();
  return world.people.some(person => {
    if (person.id === allowedId) return false;
    const first = person.name.trim().split(/\s+/)[0]?.toLocaleLowerCase();
    if (!first || first.length < 4) return false;
    const escaped = first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`).test(lower);
  });
}

/** Can this person ask me, under my current "quién puede preguntarme" setting? */
function canAsk(person: GamePerson, world: GameWorld, allow: AllowKind): boolean {
  switch (allow) {
    case "campus": return true;
    case "degree": return person.degree === world.me.degree;
    case "course": return person.degree === world.me.degree && person.year === world.me.year;
    case "group": return person.groups.some(id => world.me.groups.includes(id));
    case "contacts": return person.contact;
  }
}

// ---- seed content ------------------------------------------------------

function seed(ctx: DemoContext<Store>): Store {
  const store: Store = { onboarded: false, settings: { open: true, allow: "campus" }, questions: [], blocked: [], reports: [], day: Math.floor(ctx.now() / 86400000), askedToday: 0 };
  const senders = ctx.world.people.slice(0, 2);
  const inboxSeeds = [
    ctx.t("¿De verdad te apuntaste a esa optativa por el temario, o por quién la da?", "De veres et vas apuntar a eixa optativa pel temari, o per qui la fa?"),
    ctx.t("Si pudieras cambiar de carrera ahora mismo sin perder nada, ¿lo harías?", "Si pogueres canviar de carrera ara mateix sense perdre res, ho faries?"),
  ];
  senders.forEach((sender, index) => {
    store.questions.push({ id: ctx.id(), kind: "directed", from: sender.id, target: ctx.me.id, text: inboxSeeds[index] ?? inboxSeeds[0], status: "delivered", created_at: nowIso(), expires: inHours(24 * 14), likes: [] });
  });

  const boardSeeds: { text: string; answer?: string }[] = [
    { text: ctx.t("¿De verdad alguien entiende la práctica de esta semana?", "De veres algú entén la pràctica d'esta setmana?"), answer: ctx.t("Yo tampoco. Voy a preguntar en tutoría mañana.", "Jo tampoc. Aniré a preguntar en tutoria demà.") },
    { text: ctx.t("¿Café antes o después de la clase de las nueve?", "Cafè abans o després de la classe de les nou?"), answer: ctx.t("Antes, o no sobrevivo a la clase.", "Abans, o no sobrevisc a la classe.") },
    { text: ctx.t("¿Alguien más cree que deberíamos cambiar de grupo de trabajo?", "Algú més creu que hauríem de canviar de grup de treball?") },
  ];
  const answerers = ctx.world.people.slice(0, 2);
  boardSeeds.forEach((entry, index) => {
    const board: Board = { id: ctx.id(), kind: "board", audience: { kind: "course" }, mine: false, withdrawn: false, text: entry.text, created_at: nowIso(), expires: inHours(24 * 30), likes: index === 1 ? [answerers[0]?.id ?? ""].filter(Boolean) : [], answers: [] };
    const answerer = answerers[index % answerers.length];
    if (entry.answer && answerer) board.answers.push({ id: ctx.id(), text: entry.answer, anon: false, authorId: answerer.id, created_at: nowIso() });
    store.questions.push(board);
  });
  return store;
}

// ---- reading -------------------------------------------------------------

function view(ctx: DemoContext<Store>): State {
  const { world, store } = ctx;
  const day = Math.floor(ctx.now() / 86400000);
  if (store.day !== day) { store.day = day; store.askedToday = 0; }

  const directed = store.questions.filter(isDirected);
  const boards = store.questions.filter(isBoard);

  const mineDirected = directed.filter(q => q.from === world.me.id);
  const batches = new Map<string, Directed[]>();
  for (const q of mineDirected) { const key = q.batch ?? q.id; batches.set(key, [...(batches.get(key) ?? []), q]); }
  const sentDirected: SentQuestion[] = [...batches.values()].map(list => {
    const items = list.map(q => ({ q, status: directedStatus(q) }));
    const pending = items.filter(item => item.status === "delivered" || item.status === "seen");
    const first = list[0];
    const audience: Audience = first.batch ? { kind: "contacts" } : { kind: "person", ref: first.target };
    return {
      id: first.batch ?? first.id, text: first.text, audienceLabel: audienceLabel(audience, world),
      status: bestStatus(items.map(item => item.status)), createdAt: first.created_at,
      daysLeft: pending.length ? Math.max(...pending.map(item => daysLeft(item.q.expires))) : null,
      targets: list.length, answers: items.filter(item => item.q.answer).map(item => ({ text: item.q.answer!.text, public: item.q.answer!.public })),
    };
  });

  const sentBoards: SentQuestion[] = boards.filter(q => q.mine).map(q => {
    const status = boardStatus(q);
    return {
      id: q.id, text: q.text, audienceLabel: audienceLabel(q.audience, world), status, createdAt: q.created_at,
      daysLeft: status === "delivered" || status === "answered_public" ? daysLeft(q.expires) : null,
      targets: audienceReach(q.audience, world), answers: q.answers.map(answer => ({ text: answer.text, public: true })),
    };
  });

  const sent = [...sentDirected, ...sentBoards].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const inbox: InboxCard[] = directed
    .filter(q => q.target === world.me.id && (q.status === "delivered" || q.status === "seen") && !past(q.expires))
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    .map(q => ({ id: q.id, text: q.text, createdAt: q.created_at, daysLeft: daysLeft(q.expires) }));

  const boardSlots: { kind: AudienceKind; ref?: string }[] = [
    { kind: "course" }, { kind: "degree" }, { kind: "campus" },
    ...world.groups.filter(group => group.members.includes(world.me.id)).map(group => ({ kind: "group" as AudienceKind, ref: group.id })),
  ];
  const boardViews: BoardView[] = boardSlots
    .map(slot => ({ ...slot, audience: { kind: slot.kind, ref: slot.ref } as Audience }))
    .filter(slot => audienceReach(slot.audience, world) >= minAnonymousAudience)
    .map(slot => {
      const list = boards.filter(q => !q.withdrawn && sameAudience(q.audience, slot.audience))
        .sort((a, b) => b.likes.length - a.likes.length || Date.parse(b.created_at) - Date.parse(a.created_at));
      const questions: BoardQuestionView[] = list.map(q => ({
        id: q.id, text: q.text, mine: q.mine, createdAt: q.created_at, closesInDays: daysLeft(q.expires),
        likes: q.likes.length, likedByMe: q.likes.includes(world.me.id), canWithdraw: q.mine && !past(q.expires),
        answers: q.answers.map(answer => ({
          id: answer.id, text: answer.text, anon: answer.anon, mine: answer.authorId === world.me.id,
          authorId: answer.anon ? undefined : answer.authorId,
          authorName: answer.anon ? undefined : (answer.authorId === world.me.id ? world.me.name : world.people.find(person => person.id === answer.authorId)?.name),
        })),
      }));
      return { kind: slot.kind, ref: slot.ref, label: audienceLabel(slot.audience, world), reach: audienceReach(slot.audience, world), questions };
    });

  return { onboarded: store.onboarded, dailyLeft: Math.max(0, DAILY_LIMIT - store.askedToday), dailyLimit: DAILY_LIMIT, settings: { ...store.settings }, sent, inbox, boards: boardViews };
}

// ---- writing ---------------------------------------------------------------

export function play(world: GameWorld, command: string, input: Record<string, unknown>): State {
  const ctx = demoContext<Store>("questions", world, seed);
  const store = ctx.store;
  const day = Math.floor(ctx.now() / 86400000);
  if (store.day !== day) { store.day = day; store.askedToday = 0; }

  switch (command) {
    case "read": break;

    case "ask": {
      const kind = input.audienceKind as AudienceKind;
      const ref = typeof input.audienceRef === "string" ? input.audienceRef : undefined;
      const text = String(input.text ?? "").trim();
      if (!text) return ctx.fail("Escribe tu pregunta antes de enviarla.", "Escriu la teua pregunta abans d'enviar-la.");
      if (text.length > NOTE_MAX_LENGTH) return ctx.fail(`Que quepa en la nota: como mucho ${NOTE_MAX_LENGTH} caracteres.`, `Que càpiga a la nota: com a màxim ${NOTE_MAX_LENGTH} caràcters.`);
      if (store.askedToday >= DAILY_LIMIT) return ctx.fail("Hoy ya has hecho tus cinco preguntas. Vuelve mañana.", "Hui ja has fet les teues cinc preguntes. Torna demà.");
      if ((kind === "person" || kind === "group") && !ref) return ctx.fail("Elige a quién preguntar primero.", "Tria a qui preguntar primer.");
      const audience: Audience = { kind, ref };
      if (kind !== "person" && audienceReach(audience, world) < minAnonymousAudience) return ctx.fail(`Hacen falta ${minAnonymousAudience} personas para preguntar sin dar tu nombre.`, `Calen ${minAnonymousAudience} persones per a preguntar sense donar el teu nom.`);
      if (kind === "person" && !world.people.some(person => person.id === ref)) return ctx.fail("Esa persona ya no está disponible.", "Eixa persona ja no està disponible.");
      if (namesSomeoneElse(text, world, kind === "person" ? ref : undefined)) return ctx.fail("No nombres a nadie más en tu pregunta.", "No anomenes ningú més en la teua pregunta.");

      if (kind === "person") {
        const pending = store.questions.some(q => isDirected(q) && q.from === ctx.me.id && q.target === ref && (q.status === "delivered" || q.status === "seen"));
        if (pending) return ctx.fail("Ya tienes una pregunta esperando respuesta con esa persona.", "Ja tens una pregunta esperant resposta amb eixa persona.");
        store.questions.push({ id: ctx.id(), kind: "directed", from: ctx.me.id, target: ref!, text, status: "delivered", created_at: nowIso(), expires: inHours(24 * 14), likes: [] });
      } else if (kind === "contacts") {
        const pendingTargets = new Set(store.questions.filter(q => isDirected(q) && q.from === ctx.me.id && (q.status === "delivered" || q.status === "seen")).map(q => (q as Directed).target));
        const targets = world.people.filter(person => person.contact && !pendingTargets.has(person.id));
        if (!targets.length) return ctx.fail("Ya tienes preguntas pendientes con todos tus contactos.", "Ja tens preguntes pendents amb tots els teus contactes.");
        const batch = ctx.id();
        for (const person of targets) store.questions.push({ id: ctx.id(), kind: "directed", from: ctx.me.id, target: person.id, batch, text, status: "delivered", created_at: nowIso(), expires: inHours(24 * 14), likes: [] });
      } else {
        store.questions.push({ id: ctx.id(), kind: "board", audience, mine: true, withdrawn: false, text, created_at: nowIso(), expires: inHours(24 * 30), likes: [], answers: [] });
      }
      store.askedToday++;
      store.onboarded = true;
      break;
    }

    case "open": {
      const question = store.questions.find(q => q.id === input.id && isDirected(q) && q.target === ctx.me.id) as Directed | undefined;
      if (question && question.status === "delivered") question.status = "seen";
      break;
    }

    case "reply": {
      const text = String(input.text ?? "").trim();
      if (!text) return ctx.fail("Escribe algo antes de responder.", "Escriu alguna cosa abans de respondre.");
      const question = store.questions.find(q => q.id === input.id && isDirected(q) && q.target === ctx.me.id) as Directed | undefined;
      if (!question) return ctx.fail("Esa pregunta ya no está.", "Eixa pregunta ja no hi és.");
      if (question.status !== "delivered" && question.status !== "seen") return ctx.fail("Ya has resuelto esta pregunta.", "Ja has resolt esta pregunta.");
      if (past(question.expires)) return ctx.fail("Esta pregunta ha caducado.", "Esta pregunta ha caducat.");
      const isPublic = !!input.public;
      question.answer = { id: ctx.id(), text, anon: false, authorId: ctx.me.id, public: isPublic, created_at: nowIso() };
      question.status = isPublic ? "answered_public" : "answered_private";
      break;
    }

    case "pass":
    case "block":
    case "report": {
      const question = store.questions.find(q => q.id === input.id && isDirected(q) && q.target === ctx.me.id) as Directed | undefined;
      if (!question) return ctx.fail("Esa pregunta ya no está.", "Eixa pregunta ja no hi és.");
      if (question.status !== "delivered" && question.status !== "seen") return ctx.fail("Esa pregunta ya está resuelta.", "Eixa pregunta ja està resolta.");
      question.status = "discarded";
      if (command !== "pass" && !store.blocked.includes(question.from)) store.blocked.push(question.from);
      if (command === "report") store.reports.push({ text: question.text, from: question.from, at: nowIso() });
      break;
    }

    case "answer_board": {
      const text = String(input.text ?? "").trim();
      if (!text) return ctx.fail("Escribe algo antes de responder.", "Escriu alguna cosa abans de respondre.");
      const question = store.questions.find(q => q.id === input.id && isBoard(q)) as Board | undefined;
      if (!question) return ctx.fail("Ese tablón ya no está.", "Eixe tauler ja no hi és.");
      if (question.withdrawn || past(question.expires)) return ctx.fail("Este tablón ya se ha cerrado.", "Este tauler ja s'ha tancat.");
      question.answers.push({ id: ctx.id(), text, anon: !!input.anon, authorId: ctx.me.id, created_at: nowIso() });
      break;
    }

    case "like": {
      const question = store.questions.find(q => q.id === input.id);
      if (!question) return ctx.fail("Esa pregunta ya no está.", "Eixa pregunta ja no hi és.");
      if (isBoard(question) && (question.withdrawn || past(question.expires))) return ctx.fail("Este tablón ya se ha cerrado.", "Este tauler ja s'ha tancat.");
      const index = question.likes.indexOf(ctx.me.id);
      if (index >= 0) question.likes.splice(index, 1); else question.likes.push(ctx.me.id);
      break;
    }

    case "withdraw": {
      const question = store.questions.find(q => q.id === input.id && isBoard(q) && q.mine) as Board | undefined;
      if (!question) return ctx.fail("Esa pregunta ya no está.", "Eixa pregunta ja no hi és.");
      if (past(question.expires)) return ctx.fail("Este tablón ya se ha cerrado.", "Este tauler ja s'ha tancat.");
      question.withdrawn = true;
      break;
    }

    case "settings": {
      if (typeof input.open === "boolean") store.settings.open = input.open;
      if (typeof input.allow === "string" && ["campus", "degree", "course", "group", "contacts"].includes(input.allow)) store.settings.allow = input.allow as AllowKind;
      break;
    }

    case "demo_incoming": {
      if (!store.settings.open) return ctx.fail("Tu buzón está cerrado. Ábrelo para poder recibir preguntas.", "La teua bústia està tancada. Obri-la per a poder rebre preguntes.");
      const pendingFrom = new Set(store.questions.filter(q => isDirected(q) && q.target === ctx.me.id && (q.status === "delivered" || q.status === "seen")).map(q => (q as Directed).from));
      const candidates = world.people.filter(person => !store.blocked.includes(person.id) && !pendingFrom.has(person.id) && canAsk(person, world, store.settings.allow));
      if (!candidates.length) return ctx.fail("Ahora mismo nadie más puede preguntarte en la demo.", "Ara mateix ningú més et pot preguntar en la demo.");
      const sender = ctx.pick(candidates, `sender-${store.questions.length}`);
      const seeds = [
        ctx.t("¿Qué es lo más raro que has hecho por amor?", "Què és el més estrany que has fet per amor?"),
        ctx.t("¿Te arrepientes de algo que dijiste la semana pasada?", "Et penedeixes d'alguna cosa que vas dir la setmana passada?"),
        ctx.t("Si te fueras de Erasmus mañana, ¿a quién echarías más de menos?", "Si te n'anares d'Erasmus demà, a qui trobaries més a faltar?"),
        ctx.t("¿Cuál es tu opinión más impopular sobre esta universidad?", "Quina és la teua opinió més impopular sobre esta universitat?"),
      ];
      const text = ctx.pick(seeds, `text-${store.questions.length}`);
      store.questions.push({ id: ctx.id(), kind: "directed", from: sender.id, target: ctx.me.id, text, status: "delivered", created_at: nowIso(), expires: inHours(24 * 14), likes: [] });
      break;
    }

    default: return ctx.fail("Acción desconocida.", "Acció desconeguda.");
  }

  return view(ctx);
}
