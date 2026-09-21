import { demoContext, type DemoContext } from "./store";
import type { GamePerson, GameWorld } from "../types";

// "La cita empieza hablando": two people talk for 48 hours behind an alias,
// then decide in private whether to reveal, meet, extend once, or stop.
// See docs/juegos/02-la-cita-empieza-hablando.md for the full design.

const HOUR = 3600000;
const CONVERSATION_HOURS = 48;
const DECISION_HOURS = 24;
const SILENCE_HOURS = 12;

export type Looking = "meet" | "date" | "open";
export type Prefs = { looking: Looking; avoidCourse: boolean; avoidGroups: boolean };
export type Decision = "reveal" | "meet" | "more" | "stop";
type HintKey = "site" | "interest" | "year";
const HINT_KEYS: HintKey[] = ["site", "interest", "year"];
const HINT_OFFSET_H: Record<HintKey, number> = { site: 12, interest: 24, year: 36 };
const ICEBREAKER_OFFSET_H = [0, 12, 24, 36];

type Hint = { mine: boolean; theirs: boolean };
type ChatMessage = { id: string; from: "me" | "them"; text: string; at: string };

type Conversation = {
  id: string;
  partnerId: string;
  myAliasWord: number; myAliasColor: number;
  partnerAliasWord: number; partnerAliasColor: number;
  startedAt: string;
  endsAt: string;
  /** Total span of the current phase, in ms: 48h to start, 24h after the one extension. */
  phaseTotalMs: number;
  extended: boolean;
  icebreakerBank: number[];
  messages: ChatMessage[];
  hints: Record<HintKey, Hint>;
  decisionDeadline: string;
  myDecision: Decision | null;
  theirDecision: Decision | null;
  closed: boolean;
  outcome: "match" | "none" | null;
  closedReason: "left" | "reported" | "silence" | "no-match" | null;
  meet: boolean;
};

type Store = {
  signup: { adult: boolean; prefs: Prefs } | null;
  round: { confirmed: boolean; nextRoundAt: string };
  conversation: Conversation | null;
  /** People I already talked to, so a rematch never happens. */
  history: string[];
  blocked: string[];
  leftStreak: number;
  restingUntilRound: boolean;
};

// --- content banks -----------------------------------------------------

const ALIAS_WORDS: readonly [string, string][] = [
  ["Mandarina", "Mandarina"], ["Kiwi", "Kiwi"], ["Nectarina", "Nectarina"], ["Membrillo", "Codony"],
  ["Higo", "Figa"], ["Caqui", "Caqui"], ["Granada", "Magrana"], ["Papaya", "Papaia"],
  ["Maracuyá", "Maracujà"], ["Pomelo", "Aranja"], ["Boniato", "Moniato"], ["Chirimoya", "Xirimoia"],
];
const ALIAS_COLORS = 8;

const ICEBREAKERS: readonly [string, string][] = [
  ["Si tuvieras la tarde libre ahora mismo, ¿qué harías?", "Si tingueres la vesprada lliure ara mateix, què faries?"],
  ["¿Serie que ves cuando no quieres pensar, y serie que ves cuando sí?", "Sèrie que veus quan no vols pensar, i sèrie que veus quan sí?"],
  ["¿Qué comida no falla nunca?", "Quin menjar no falla mai?"],
  ["¿Un plan perfecto de sábado en el campus o fuera de él?", "Un pla perfecte de dissabte, al campus o fora?"],
  ["¿Algo que se te da bien y casi nadie sabe?", "Alguna cosa que se't dona bé i quasi ningú sap?"],
  ["¿Ventana o pasillo, y por qué?", "Finestra o passadís, i per què?"],
  ["¿Qué canción no puede faltar en un viaje largo?", "Quina cançó no pot faltar en un viatge llarg?"],
  ["¿Mañana o noche para tener buenas ideas?", "Matí o nit per a tindre bones idees?"],
  ["¿Qué harías con un día extra a la semana?", "Què faries amb un dia extra a la setmana?"],
  ["Una cosa pequeña que te alegra el día.", "Una cosa xicoteta que t'alegra el dia."],
];

const REPLIES: readonly [string, string][] = [
  ["Jaja buena pregunta, déjame pensarlo un momento.", "Jaja bona pregunta, deixa'm pensar-ho un moment."],
  ["La verdad es que no me lo esperaba, me gusta.", "La veritat és que no m'ho esperava, m'agrada."],
  ["Yo creo que nos llevaríamos bien en persona.", "Crec que ens portaríem bé en persona."],
  ["Cuéntame más, tengo curiosidad.", "Conta'm més, tinc curiositat."],
  ["Eso mismo pensaba yo, qué casualidad.", "Això mateix pensava jo, quina casualitat."],
  ["Hoy ha sido un día raro pero esto lo mejora.", "Hui ha sigut un dia rar però açò el millora."],
];

// --- small pure helpers --------------------------------------------------

function hashIndex(seed: string, length: number): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index++) hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  return length ? hash % length : 0;
}

/** Four distinct indexes into a bank, stable for a given seed. */
function pickFour(seed: string, length: number): number[] {
  const out: number[] = [];
  for (let attempt = 0; out.length < 4 && attempt < length * 4; attempt++) {
    const index = hashIndex(`${seed}:${attempt}`, length);
    if (!out.includes(index)) out.push(index);
  }
  for (let index = 0; out.length < 4 && index < length; index++) if (!out.includes(index)) out.push(index);
  return out;
}

const iso = (ms: number) => new Date(ms).toISOString();

/** The next Thursday 19:30 from `now`; today's if it has not happened yet. */
function nextThursday1930(now: number): string {
  const at = new Date(now);
  const target = new Date(now);
  target.setHours(19, 30, 0, 0);
  let deltaDays = (4 - at.getDay() + 7) % 7;
  if (deltaDays === 0 && target.getTime() <= now) deltaDays = 7;
  target.setDate(at.getDate() + deltaDays);
  return target.toISOString();
}

function seed(): Store {
  return { signup: null, round: { confirmed: false, nextRoundAt: nextThursday1930(Date.now()) }, conversation: null, history: [], blocked: [], leftStreak: 0, restingUntilRound: false };
}

// --- matching --------------------------------------------------------------

/**
 * The profile does not carry gender or who someone is looking for (open design
 * question in the doc). The demo can only honour MY exclusions: my course and
 * my groups, plus never repeating a person I already talked to or blocked.
 */
function pickPartner(ctx: DemoContext<Store>): GamePerson | null {
  const { world, store } = ctx;
  const prefs = store.signup?.prefs;
  const excluded = new Set([...store.history, ...store.blocked]);
  const fits = (person: GamePerson) => {
    if (prefs?.avoidCourse && person.degree === world.me.degree && person.year === world.me.year) return false;
    if (prefs?.avoidGroups && person.groups.some(group => world.me.groups.includes(group))) return false;
    return true;
  };
  const strict = world.people.filter(person => !excluded.has(person.id) && fits(person));
  const relaxed = strict.length ? strict : world.people.filter(person => !excluded.has(person.id));
  const pool = relaxed.length ? relaxed : world.people;
  if (!pool.length) return null;
  return pool[hashIndex(ctx.id(), pool.length)];
}

function startConversation(ctx: DemoContext<Store>, strict: boolean): boolean {
  const { store } = ctx;
  const partner = pickPartner(ctx);
  if (!partner) { if (strict) ctx.fail("No hay nadie compatible ahora mismo. Prueba de nuevo en un momento.", "No hi ha ningú compatible ara mateix. Prova de nou en un moment."); return false; }
  store.history.push(partner.id);
  const now = ctx.now();
  const conv: Conversation = {
    id: ctx.id(), partnerId: partner.id,
    myAliasWord: hashIndex(`${partner.id}:me:${now}`, ALIAS_WORDS.length), myAliasColor: hashIndex(`${partner.id}:me:c:${now}`, ALIAS_COLORS),
    partnerAliasWord: hashIndex(`${partner.id}:them`, ALIAS_WORDS.length), partnerAliasColor: hashIndex(`${partner.id}:them:c`, ALIAS_COLORS),
    startedAt: iso(now), endsAt: iso(now + CONVERSATION_HOURS * HOUR), phaseTotalMs: CONVERSATION_HOURS * HOUR, extended: false,
    icebreakerBank: pickFour(`${partner.id}:${now}`, ICEBREAKERS.length),
    messages: [],
    hints: { site: { mine: false, theirs: false }, interest: { mine: false, theirs: false }, year: { mine: false, theirs: false } },
    decisionDeadline: iso(now + (CONVERSATION_HOURS + DECISION_HOURS) * HOUR),
    myDecision: null, theirDecision: null, closed: false, outcome: null, closedReason: null, meet: false,
  };
  store.conversation = conv;
  return true;
}

// --- state transitions ------------------------------------------------------

/** Reaching the decision outcome, whatever it is, is not an early abandonment. */
function closeForDecision(store: Store, conv: Conversation, outcome: "match" | "none", meet: boolean) {
  conv.closed = true; conv.outcome = outcome; conv.closedReason = outcome === "match" ? null : "no-match"; conv.meet = meet;
  store.leftStreak = 0;
}

function resolveIfBothDecided(store: Store, conv: Conversation) {
  if (!conv.myDecision || !conv.theirDecision) return;
  const good = (d: Decision) => d === "reveal" || d === "meet";
  if (conv.myDecision === "stop" || conv.theirDecision === "stop") { closeForDecision(store, conv, "none", false); return; }
  if (good(conv.myDecision) && good(conv.theirDecision)) { closeForDecision(store, conv, "match", conv.myDecision === "meet" || conv.theirDecision === "meet"); return; }
  if (!conv.extended) {
    const now = Date.parse(conv.endsAt);
    conv.endsAt = iso(now + DECISION_HOURS * HOUR);
    conv.phaseTotalMs = DECISION_HOURS * HOUR;
    conv.decisionDeadline = iso(now + DECISION_HOURS * HOUR + DECISION_HOURS * HOUR);
    conv.extended = true; conv.myDecision = null; conv.theirDecision = null;
    return;
  }
  // The extension was already used and someone still asked for one more: treat as no match.
  closeForDecision(store, conv, "none", false);
}

function endEarly(store: Store, conv: Conversation, reason: "left" | "reported" | "silence") {
  conv.closed = true; conv.outcome = "none"; conv.closedReason = reason;
  if (reason === "reported") return;
  store.leftStreak += 1;
  if (store.leftStreak >= 3) { store.restingUntilRound = true; store.leftStreak = 0; }
}

function tick(ctx: DemoContext<Store>) {
  const { store } = ctx, now = ctx.now();
  const conv = store.conversation;
  if (conv && !conv.closed && now >= Date.parse(conv.decisionDeadline) && !(conv.myDecision && conv.theirDecision)) closeForDecision(store, conv, "none", false);
  if (!store.conversation && store.signup && store.round.confirmed && now >= Date.parse(store.round.nextRoundAt) && !store.restingUntilRound) {
    if (startConversation(ctx, false)) { store.round.confirmed = false; store.round.nextRoundAt = nextThursday1930(now); }
  }
}

function ensureCanStartRound(ctx: DemoContext<Store>) {
  const { store } = ctx;
  if (!store.signup) ctx.fail("Tienes que apuntarte primero.", "T'has d'apuntar primer.");
  if (store.conversation && !store.conversation.closed) ctx.fail("Ya tienes una conversación en marcha.", "Ja tens una conversa en marxa.");
  if (store.restingUntilRound) { store.restingUntilRound = false; ctx.fail("Has salido de varias conversaciones seguidas. Descansas esta ronda.", "Has eixit de diverses converses seguides. Descanses esta ronda."); }
}

function requireOpenChat(ctx: DemoContext<Store>): Conversation {
  const conv = ctx.store.conversation;
  if (!conv || conv.closed) ctx.fail("No tienes una conversación abierta.", "No tens una conversa oberta.");
  if (ctx.now() >= Date.parse(conv.endsAt)) ctx.fail("El chat está cerrado. Toca decidir.", "El xat està tancat. Toca decidir.");
  return conv;
}

function requireActiveConversation(ctx: DemoContext<Store>): Conversation {
  const conv = ctx.store.conversation;
  if (!conv || conv.closed) ctx.fail("No tienes una conversación activa.", "No tens una conversa activa.");
  return conv;
}

function requireDecisionPhase(ctx: DemoContext<Store>): Conversation {
  const conv = ctx.store.conversation;
  if (!conv || conv.closed) ctx.fail("No tienes una conversación en decisión.", "No tens una conversa en decisió.");
  if (ctx.now() < Date.parse(conv.endsAt)) ctx.fail("Todavía podéis seguir hablando.", "Encara podeu seguir parlant.");
  return conv;
}

function validateChoice(ctx: DemoContext<Store>, raw: unknown, conv: Conversation): Decision {
  const choice = raw as Decision;
  if (!["reveal", "meet", "more", "stop"].includes(choice)) ctx.fail("Elige una opción.", "Tria una opció.");
  if (choice === "more" && conv.extended) ctx.fail("Ya habéis usado vuestra prórroga.", "Ja heu usat la vostra pròrroga.");
  return choice;
}

/** Hides links, phone numbers and social handles from a chat line. */
function sanitize(text: string, t: (es: string, va: string) => string): string {
  let out = text;
  out = out.replace(/\b(https?:\/\/|www\.)\S+/gi, t("[enlace oculto]", "[enllaç ocultat]"));
  out = out.replace(/@[a-z0-9_.]{2,}/gi, t("[usuario oculto]", "[usuari ocultat]"));
  out = out.replace(/\b(instagram|whatsapp|telegram|tiktok|snapchat|snap|discord)\b[:\s]*[\w.]*/gi, t("[red oculta]", "[xarxa ocultada]"));
  out = out.replace(/(\+?\d[\d\s.-]{6,}\d)/g, t("[teléfono oculto]", "[telèfon ocultat]"));
  return out;
}

// --- view --------------------------------------------------------------

export type Stage = "signup" | "round" | "confirmed" | "chat" | "decision" | "done";

export type BubbleView = { id: string; from: "me" | "them" | "system"; text: string; at: string; icebreaker: boolean };
export type HintView = { key: HintKey; label: string; offered: boolean; mine: boolean; theirs: boolean; revealed: boolean; value: string | null };
export type ConversationView = {
  partnerAlias: string; partnerAliasColor: number; myAlias: string; myAliasColor: number;
  endsAt: string; totalMs: number; extended: boolean;
  messages: BubbleView[]; hints: HintView[];
  silence: boolean;
};
export type DecisionView = { deadline: string; totalMs: number; mine: Decision | null; waiting: boolean; canExtend: boolean };
export type ResultView = { kind: "match" | "closed"; reason: "left" | "reported" | "silence" | "no-match" | null; meet: boolean; partnerId: string | null };

export type State = {
  stage: Stage;
  prefs: Prefs | null;
  round: { confirmed: boolean; nextRoundAt: string };
  resting: boolean;
  conversation: ConversationView | null;
  decision: DecisionView | null;
  result: ResultView | null;
};

function alias(word: number, world: GameWorld): string {
  const [es, va] = ALIAS_WORDS[word];
  const number = 10 + (word * 7) % 90;
  return `${world.t(es, va)} ${number}`;
}

function hintValue(key: HintKey, world: GameWorld, partner: GamePerson): string {
  if (key === "site") return partner.campus;
  if (key === "year") return world.t(`Año ${partner.year} de carrera`, `Any ${partner.year} de carrera`);
  const shared = partner.interests.find(interest => world.me.interests.includes(interest));
  return shared ?? world.t("Sin intereses en común todavía", "Sense interessos en comú encara");
}

function hintLabel(key: HintKey, t: (es: string, va: string) => string): string {
  if (key === "site") return t("Sede", "Seu");
  if (key === "year") return t("Año de carrera", "Any de carrera");
  return t("Interés en común", "Interés en comú");
}

function buildConversationView(conv: Conversation, world: GameWorld, now: number): ConversationView {
  const t = world.t;
  const started = Date.parse(conv.startedAt);
  const icebreakers: BubbleView[] = conv.icebreakerBank.map((bankIndex, position) => {
    const [es, va] = ICEBREAKERS[bankIndex];
    return { id: `ib-${position}`, from: "system" as const, icebreaker: true, text: t(es, va), at: iso(started + ICEBREAKER_OFFSET_H[position] * HOUR) };
  }).filter(entry => Date.parse(entry.at) <= now);
  const messages: BubbleView[] = [...icebreakers, ...conv.messages.map(message => ({ ...message, icebreaker: false }))]
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const partner = world.people.find(person => person.id === conv.partnerId);
  const hints: HintView[] = HINT_KEYS.map(key => {
    const offered = now >= started + HINT_OFFSET_H[key] * HOUR;
    const state = conv.hints[key];
    const revealed = state.mine && state.theirs;
    return { key, label: hintLabel(key, t), offered, mine: state.mine, theirs: state.theirs, revealed, value: revealed && partner ? hintValue(key, world, partner) : null };
  });
  const silence = conv.messages.every(message => message.from !== "them") && now - started >= SILENCE_HOURS * HOUR;
  return { partnerAlias: alias(conv.partnerAliasWord, world), partnerAliasColor: conv.partnerAliasColor, myAlias: alias(conv.myAliasWord, world), myAliasColor: conv.myAliasColor, endsAt: conv.endsAt, totalMs: conv.phaseTotalMs, extended: conv.extended, messages, hints, silence };
}

function view(ctx: DemoContext<Store>): State {
  const { world, store } = ctx, now = ctx.now();
  const conv = store.conversation;
  const prefs = store.signup?.prefs ?? null;
  if (!store.signup) return { stage: "signup", prefs, round: store.round, resting: store.restingUntilRound, conversation: null, decision: null, result: null };
  if (conv) {
    if (!conv.closed) {
      const inDecision = now >= Date.parse(conv.endsAt);
      if (inDecision) {
        const decision: DecisionView = { deadline: conv.decisionDeadline, totalMs: DECISION_HOURS * HOUR, mine: conv.myDecision, waiting: conv.myDecision !== null, canExtend: !conv.extended };
        return { stage: "decision", prefs, round: store.round, resting: store.restingUntilRound, conversation: null, decision, result: null };
      }
      return { stage: "chat", prefs, round: store.round, resting: store.restingUntilRound, conversation: buildConversationView(conv, world, now), decision: null, result: null };
    }
    const result: ResultView = conv.outcome === "match"
      ? { kind: "match", reason: null, meet: conv.meet, partnerId: conv.partnerId }
      : { kind: "closed", reason: conv.closedReason, meet: false, partnerId: null };
    return { stage: "done", prefs, round: store.round, resting: store.restingUntilRound, conversation: null, decision: null, result };
  }
  return { stage: store.round.confirmed ? "confirmed" : "round", prefs, round: store.round, resting: store.restingUntilRound, conversation: null, decision: null, result: null };
}

// --- entry point ------------------------------------------------------------

export function play(world: GameWorld, command: string, input: Record<string, unknown>): State {
  const ctx = demoContext<Store>("blind", world, seed);
  const store = ctx.store;
  tick(ctx);
  switch (command) {
    case "read": break;
    case "signup": {
      if (input.adult !== true) ctx.fail("Hace falta declarar que eres mayor de edad.", "Cal declarar que ets major d'edat.");
      const looking = input.looking as Looking;
      if (!["meet", "date", "open"].includes(looking)) ctx.fail("Elige qué buscas.", "Tria què busques.");
      store.signup = { adult: true, prefs: { looking, avoidCourse: input.avoidCourse !== false, avoidGroups: input.avoidGroups !== false } };
      break;
    }
    case "confirm": { ensureCanStartRound(ctx); store.round.confirmed = true; break; }
    case "demoStart": { ensureCanStartRound(ctx); startConversation(ctx, true); break; }
    case "send": {
      const conv = requireOpenChat(ctx);
      const raw = String(input.text ?? "").trim();
      if (!raw) ctx.fail("Escribe algo antes de enviar.", "Escriu alguna cosa abans d'enviar.");
      conv.messages.push({ id: ctx.id(), from: "me", text: sanitize(raw, ctx.t), at: iso(ctx.now()) });
      break;
    }
    case "demoReply": {
      const conv = requireOpenChat(ctx);
      const count = conv.messages.filter(message => message.from === "them").length;
      const [es, va] = REPLIES[hashIndex(`${conv.id}:reply:${count}`, REPLIES.length)];
      conv.messages.push({ id: ctx.id(), from: "them", text: ctx.t(es, va), at: iso(ctx.now()) });
      break;
    }
    case "acceptHint": {
      const conv = requireOpenChat(ctx);
      const key = input.hint as HintKey;
      if (!HINT_KEYS.includes(key)) ctx.fail("Pista desconocida.", "Pista desconeguda.");
      if (ctx.now() < Date.parse(conv.startedAt) + HINT_OFFSET_H[key] * HOUR) ctx.fail("Todavía no toca esta pista.", "Encara no toca esta pista.");
      conv.hints[key].mine = true;
      break;
    }
    case "demoAcceptHint": {
      const conv = requireOpenChat(ctx);
      const key = input.hint as HintKey;
      if (!HINT_KEYS.includes(key)) ctx.fail("Pista desconocida.", "Pista desconeguda.");
      conv.hints[key].theirs = true;
      break;
    }
    case "leave": {
      const conv = requireActiveConversation(ctx);
      const silence = conv.messages.every(message => message.from !== "them") && ctx.now() - Date.parse(conv.startedAt) >= SILENCE_HOURS * HOUR && ctx.now() < Date.parse(conv.endsAt);
      endEarly(store, conv, silence ? "silence" : "left");
      break;
    }
    case "report": {
      const conv = requireActiveConversation(ctx);
      store.blocked.push(conv.partnerId);
      endEarly(store, conv, "reported");
      break;
    }
    case "demoFastForward": {
      const conv = store.conversation;
      if (!conv || conv.closed) ctx.fail("No tienes una conversación en marcha.", "No tens una conversa en marxa.");
      else if (ctx.now() < Date.parse(conv.endsAt)) { conv.endsAt = iso(ctx.now()); conv.decisionDeadline = iso(ctx.now() + DECISION_HOURS * HOUR); }
      break;
    }
    case "decide": {
      const conv = requireDecisionPhase(ctx);
      conv.myDecision = validateChoice(ctx, input.choice, conv);
      resolveIfBothDecided(store, conv);
      break;
    }
    case "demoDecide": {
      const conv = requireDecisionPhase(ctx);
      conv.theirDecision = validateChoice(ctx, input.choice, conv);
      resolveIfBothDecided(store, conv);
      break;
    }
    case "dismiss": {
      if (store.conversation?.closed) {
        store.conversation = null;
        store.round.confirmed = false;
        if (Date.parse(store.round.nextRoundAt) <= ctx.now()) store.round.nextRoundAt = nextThursday1930(ctx.now());
      }
      break;
    }
    default: ctx.fail("Acción desconocida.", "Acció desconeguda.");
  }
  return view(ctx);
}
