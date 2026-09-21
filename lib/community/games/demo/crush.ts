import { demoContext, type DemoContext } from "./store";
import type { GamePerson, GameWorld } from "../types";

// See docs/juegos/03-me-lio.md. The three gestures form a scale: a match
// happens at the lower of the two choices, so nobody ever learns the other
// person wanted more than they got.
export const levels = ["coffee", "date", "crush"] as const;
export type Level = typeof levels[number];
const levelIndex = (level: Level) => levels.indexOf(level);
const lowerLevel = (a: Level, b: Level): Level => levels[Math.min(levelIndex(a), levelIndex(b))];

const DAY_MS = 86400000;
const THIRTY_DAYS_MS = 30 * DAY_MS;
const DAILY_CAP = 20;
const dayKey = (now: number) => Math.floor(now / DAY_MS);

type Visibility = {
  seeMe: "campus" | "site" | "degree";
  hideCourse: boolean;
  hideGroups: boolean;
  hidePeople: string[];
};

type Choice = { level: Level; at: number };
type Match = { level: Level; at: number };

type Store = {
  joined: boolean;
  paused: boolean;
  visibility: Visibility;
  line: string;
  /** My own choices, keyed by the other person's id. Removed once matched. */
  choices: Record<string, Choice>;
  /** When I passed on someone, so they can come back after thirty days. */
  passed: Record<string, number>;
  /** The other side's choice, only ever set by the "Demo" action here: there is
   * nobody else at the other end of the demo. */
  incoming: Record<string, Level>;
  matches: Record<string, Match>;
  /** Matches not yet shown on the celebration screen. */
  pendingMatches: string[];
  daily: { day: number; count: number };
  searchQuery: string;
};

const defaultVisibility = (): Visibility => ({ seeMe: "campus", hideCourse: true, hideGroups: false, hidePeople: [] });
const defaultStore = (): Store => ({
  joined: false, paused: false, visibility: defaultVisibility(), line: "",
  choices: {}, passed: {}, incoming: {}, matches: {}, pendingMatches: [],
  daily: { day: 0, count: 0 }, searchQuery: "",
});

export type CardPerson = { id: string; name: string; campus: string; degree: string; year: number; line: string };
export type ChoiceView = { id: string; name: string; degree: string; year: number; level: Level; at: number };
export type MatchView = { id: string; name: string; degree: string; level: Level };

export type State = {
  joined: boolean;
  paused: boolean;
  visibility: Visibility;
  line: string;
  /** Set right after a match, so the screen can show the celebration once. */
  celebrate: MatchView | null;
  deck: { person: CardPerson | null; position: number; total: number };
  remainingToday: number;
  choices: ChoiceView[];
  matches: MatchView[];
  search: { query: string; result: CardPerson | null };
};

function isVisible(ctx: DemoContext<Store>, person: GamePerson): boolean {
  const v = ctx.store.visibility, me = ctx.world.me;
  if (v.seeMe === "site" && person.campus !== me.campus) return false;
  if (v.seeMe === "degree" && person.degree !== me.degree) return false;
  if (v.hideCourse && person.degree === me.degree && person.year === me.year) return false;
  if (v.hideGroups && person.groups.some(group => me.groups.includes(group))) return false;
  if (v.hidePeople.includes(person.id)) return false;
  return true;
}

const recentlyPassed = (store: Store, id: string, now: number) => store.passed[id] !== undefined && now - store.passed[id] < THIRTY_DAYS_MS;

/** People I could still be shown, in a stable order. Already chosen, matched or hidden people never appear here. */
function pool(ctx: DemoContext<Store>): GamePerson[] {
  const now = ctx.now();
  return ctx.world.people.filter(person => isVisible(ctx, person) && !ctx.store.choices[person.id] && !ctx.store.matches[person.id] && !recentlyPassed(ctx.store, person.id, now));
}

const topOfDeck = (ctx: DemoContext<Store>) => pool(ctx)[0];

function toCard(ctx: DemoContext<Store>, person: GamePerson): CardPerson {
  const line = person.bio.trim() || ctx.t("Todavía no ha escrito nada.", "Encara no ha escrit res.");
  return { id: person.id, name: person.name, campus: person.campus, degree: person.degree, year: person.year, line };
}

function searchResult(ctx: DemoContext<Store>): CardPerson | null {
  const query = ctx.store.searchQuery.trim().toLocaleLowerCase();
  if (!query) return null;
  const person = ctx.world.people.find(candidate => candidate.name.toLocaleLowerCase().includes(query));
  if (!person || !isVisible(ctx, person) || ctx.store.matches[person.id]) return null;
  return toCard(ctx, person);
}

function ensureDay(store: Store, now: number) {
  const day = dayKey(now);
  if (store.daily.day !== day) store.daily = { day, count: 0 };
}

function requireJoined(ctx: DemoContext<Store>) {
  if (!ctx.store.joined) ctx.fail("Todavía no has entrado al juego.", "Encara no has entrat al joc.");
}
function requireActive(ctx: DemoContext<Store>) {
  requireJoined(ctx);
  if (ctx.store.paused) ctx.fail("Estás en pausa. Vuelve a jugar primero.", "Estàs en pausa. Torna a jugar primer.");
}

function sanitizeVisibility(raw: Record<string, unknown>, world: GameWorld, base: Visibility): Visibility {
  const seeMe = raw.seeMe === "site" || raw.seeMe === "degree" || raw.seeMe === "campus" ? raw.seeMe : base.seeMe;
  const known = new Set(world.people.map(person => person.id));
  const hidePeople = Array.isArray(raw.hidePeople) ? raw.hidePeople.filter((id): id is string => typeof id === "string" && known.has(id)) : base.hidePeople;
  return {
    seeMe,
    hideCourse: typeof raw.hideCourse === "boolean" ? raw.hideCourse : base.hideCourse,
    hideGroups: typeof raw.hideGroups === "boolean" ? raw.hideGroups : base.hideGroups,
    hidePeople,
  };
}
const sanitizeLine = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 140) : "";

function runMatch(ctx: DemoContext<Store>, id: string) {
  const store = ctx.store;
  if (store.matches[id]) return;
  const mine = store.choices[id], theirs = store.incoming[id];
  if (!mine || !theirs) return;
  store.matches[id] = { level: lowerLevel(mine.level, theirs), at: ctx.now() };
  delete store.choices[id];
  store.pendingMatches.push(id);
}

function doJoin(ctx: DemoContext<Store>, input: Record<string, unknown>) {
  if (input.adult !== true) ctx.fail("Hace falta declarar que tienes 18 años o más.", "Cal declarar que tens 18 anys o més.");
  const visibility = sanitizeVisibility(input, ctx.world, defaultVisibility());
  Object.assign(ctx.store, defaultStore(), { joined: true, visibility, line: sanitizeLine(input.line), daily: { day: dayKey(ctx.now()), count: 0 } });
}

function doSettings(ctx: DemoContext<Store>, input: Record<string, unknown>) {
  requireJoined(ctx);
  const store = ctx.store;
  store.visibility = sanitizeVisibility(input, ctx.world, store.visibility);
  if (typeof input.line === "string") store.line = sanitizeLine(input.line);
}

function readLevel(ctx: DemoContext<Store>, input: Record<string, unknown>): Level {
  const level = input.level;
  if (level !== "coffee" && level !== "date" && level !== "crush") ctx.fail("Elige un café, una cita o me lío.", "Tria un cafè, una cita o m'embolique.");
  return level;
}

function findTarget(ctx: DemoContext<Store>, id: string): GamePerson {
  const person = ctx.world.people.find(candidate => candidate.id === id);
  if (!person || !isVisible(ctx, person) || ctx.store.matches[id]) ctx.fail("No está en el juego o no puedes verla.", "No està en el joc o no la pots veure.");
  return person;
}

function doChoose(ctx: DemoContext<Store>, input: Record<string, unknown>) {
  requireActive(ctx);
  const id = String(input.id ?? "");
  const level = readLevel(ctx, input);
  findTarget(ctx, id);
  const wasTop = topOfDeck(ctx)?.id === id;
  ctx.store.choices[id] = { level, at: ctx.now() };
  delete ctx.store.passed[id];
  if (wasTop) ctx.store.daily.count++;
  runMatch(ctx, id);
}

function doPass(ctx: DemoContext<Store>, input: Record<string, unknown>) {
  requireActive(ctx);
  const id = String(input.id ?? "");
  findTarget(ctx, id);
  const wasTop = topOfDeck(ctx)?.id === id;
  ctx.store.passed[id] = ctx.now();
  delete ctx.store.choices[id];
  if (wasTop) ctx.store.daily.count++;
}

function doChange(ctx: DemoContext<Store>, input: Record<string, unknown>) {
  requireJoined(ctx);
  const id = String(input.id ?? "");
  const level = readLevel(ctx, input);
  if (ctx.store.matches[id]) ctx.fail("Ya hay una coincidencia: no se puede cambiar.", "Ja hi ha una coincidència: no es pot canviar.");
  if (!ctx.store.choices[id]) ctx.fail("Todavía no habías elegido a esta persona.", "Encara no havies triat esta persona.");
  ctx.store.choices[id] = { level, at: ctx.now() };
  runMatch(ctx, id);
}

function doWithdraw(ctx: DemoContext<Store>, input: Record<string, unknown>) {
  requireJoined(ctx);
  const id = String(input.id ?? "");
  if (ctx.store.matches[id]) ctx.fail("Ya hay una coincidencia: no se puede retirar.", "Ja hi ha una coincidència: no es pot retirar.");
  if (!ctx.store.choices[id]) ctx.fail("No tenías ninguna elección para retirar.", "No tenies cap elecció per a retirar.");
  delete ctx.store.choices[id];
}

function doDemoMatch(ctx: DemoContext<Store>, input: Record<string, unknown>) {
  requireActive(ctx);
  const id = String(input.id ?? "");
  const mine = ctx.store.choices[id];
  if (!mine) ctx.fail("Elige algo para esta persona antes de simular su respuesta.", "Tria alguna cosa per a esta persona abans de simular la seua resposta.");
  const level = input.level === "coffee" || input.level === "date" || input.level === "crush" ? input.level : mine.level;
  ctx.store.incoming[id] = level;
  runMatch(ctx, id);
}

function doAck(ctx: DemoContext<Store>, input: Record<string, unknown>) {
  requireJoined(ctx);
  const id = String(input.id ?? "");
  ctx.store.pendingMatches = ctx.store.pendingMatches.filter(pending => pending !== id);
}

function view(ctx: DemoContext<Store>): State {
  const store = ctx.store, world = ctx.world;
  const candidates = pool(ctx);
  const remaining = Math.max(0, DAILY_CAP - store.daily.count);
  const currentPerson = remaining > 0 ? candidates[0] : undefined;
  const total = Math.min(DAILY_CAP, store.daily.count + candidates.length);
  const choices: ChoiceView[] = Object.entries(store.choices)
    .map(([id, choice]) => { const person = world.people.find(candidate => candidate.id === id); return { id, name: person?.name ?? "—", degree: person?.degree ?? "", year: person?.year ?? 0, level: choice.level, at: choice.at }; })
    .sort((a, b) => b.at - a.at);
  const matches: MatchView[] = Object.entries(store.matches)
    .map(([id, match]) => { const person = world.people.find(candidate => candidate.id === id); return { id, name: person?.name ?? "—", degree: person?.degree ?? "", level: match.level }; });
  const celebrateId = store.pendingMatches[0];
  const celebrate = celebrateId ? matches.find(match => match.id === celebrateId) ?? null : null;
  return {
    joined: store.joined, paused: store.paused, visibility: store.visibility, line: store.line,
    celebrate,
    deck: { person: currentPerson ? toCard(ctx, currentPerson) : null, position: store.daily.count, total },
    remainingToday: remaining,
    choices, matches,
    search: { query: store.searchQuery, result: searchResult(ctx) },
  };
}

export function play(world: GameWorld, command: string, input: Record<string, unknown>): State {
  const ctx = demoContext<Store>("crush", world, () => defaultStore());
  ensureDay(ctx.store, ctx.now());
  switch (command) {
    case "read": break;
    case "join": doJoin(ctx, input); break;
    case "settings": doSettings(ctx, input); break;
    case "choose": doChoose(ctx, input); break;
    case "pass": doPass(ctx, input); break;
    case "change": doChange(ctx, input); break;
    case "withdraw": doWithdraw(ctx, input); break;
    case "search": requireJoined(ctx); ctx.store.searchQuery = String(input.query ?? "").slice(0, 60); break;
    case "pause": requireJoined(ctx); ctx.store.paused = true; break;
    case "resume": requireJoined(ctx); ctx.store.paused = false; break;
    case "leave": Object.assign(ctx.store, defaultStore()); break;
    case "ack-match": doAck(ctx, input); break;
    case "demo-match": doDemoMatch(ctx, input); break;
    default: ctx.fail("Acción desconocida.", "Acció desconeguda.");
  }
  return view(ctx);
}
