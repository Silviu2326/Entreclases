import { demoContext, type DemoContext } from "./store";
import { sameAudience } from "../audience";
import type { Audience, AudienceKind, GamePerson, GameRoom, GameWorld } from "../types";

// Public shape the screen renders. See docs/juegos/04-dos-verdades-y-una-trola.md.
export type TruthCard = { text: string; lie?: boolean; picked?: boolean; share?: number };
export type TruthRound = GameRoom & {
  cards: TruthCard[];
  /** Owner-relative label, since Audience alone does not say "his degree" vs "mine". */
  audienceLabel: string;
  played: boolean;
  correct?: boolean;
  playedCount: number;
  deceived: number;
  groupRound?: string;
};
export type GroupRoundView = {
  id: string;
  group: string;
  groupName: string;
  active: boolean;
  finished: boolean;
  expires: string;
  members: number;
  posted: number;
  myRound?: string;
  summary: { mostDeceiving: string; mostAccurate: string } | null;
};
export type State = {
  streak: number;
  deck: TruthRound[];
  mine: TruthRound[];
  groups: GroupRoundView[];
  audienceKinds: AudienceKind[];
};

type StoredCard = { text: string; lie: boolean };
type PlayRecord = { player: string; guess: number; at: number };
type StoredRound = {
  id: string;
  owner: string;
  audience: Audience;
  cards: StoredCard[];
  createdAt: number;
  expiresAt: number;
  plays: PlayRecord[];
  groupRound?: string;
};
type StoredGroupRound = { id: string; group: string; createdAt: number; expiresAt: number };
type Store = { rounds: StoredRound[]; groupRounds: StoredGroupRound[] };

const DAY = 24 * 60 * 60 * 1000;
const SEVEN_DAYS = 7 * DAY;
const THREE_DAYS = 3 * DAY;
export const truthAudienceKinds: AudienceKind[] = ["campus", "degree", "course", "group", "contacts", "person"];

// Only campus, degree, course, group, contacts and person are offered here: this
// game never uses "site" (mi sede is not one of the destinations in the design).
type Phrase = { es: string; va: string };
type PhraseSet = { phrases: readonly [Phrase, Phrase, Phrase]; lie: 0 | 1 | 2 };

const SET_A: PhraseSet = { lie: 2, phrases: [
  { es: "He dormido en la biblioteca hasta que me han echado los de seguridad.", va: "He dormit a la biblioteca fins que m'han fet fora els de seguretat." },
  { es: "Sé resolver un cubo de Rubik en menos de un minuto.", va: "Sé resoldre un cub de Rubik en menys d'un minut." },
  { es: "Una vez gané un concurso de comer picante.", va: "Una vegada vaig guanyar un concurs de menjar picant." },
] };
const SET_B: PhraseSet = { lie: 1, phrases: [
  { es: "Nunca he visto ninguna película de Star Wars.", va: "Mai he vist cap pel·lícula de Star Wars." },
  { es: "Tengo un hermano gemelo.", va: "Tinc un germà bessó." },
  { es: "He aprobado un examen sin haber ido a ninguna clase.", va: "He aprovat un examen sense haver anat a cap classe." },
] };
const SET_C: PhraseSet = { lie: 2, phrases: [
  { es: "Sé tocar la guitarra de oído, sin partitura.", va: "Sé tocar la guitarra d'oïda, sense partitura." },
  { es: "Una vez me quedé encerrado en el ascensor de la facultad.", va: "Una vegada em vaig quedar tancat a l'ascensor de la facultat." },
  { es: "Tengo el récord de mi pueblo en cien metros lisos.", va: "Tinc el rècord del meu poble en cent metres llisos." },
] };
const SET_D: PhraseSet = { lie: 1, phrases: [
  { es: "Nunca he probado el café.", va: "Mai he tastat el cafè." },
  { es: "Tengo tres idiomas nativos.", va: "Tinc tres idiomes natius." },
  { es: "He viajado en autoestop hasta otro país.", va: "He viatjat a dit fins a un altre país." },
] };
const SET_E: PhraseSet = { lie: 2, phrases: [
  { es: "Una vez perdí una apuesta y tuve que ir a clase disfrazado.", va: "Una vegada vaig perdre una aposta i vaig haver d'anar a classe disfressat." },
  { es: "Sé preparar una paella entera yo solo.", va: "Sé preparar una paella sencera jo tot sol." },
  { es: "Tengo el carné de piloto de avioneta.", va: "Tinc el carnet de pilot d'avioneta." },
] };
const SET_MINE: PhraseSet = { lie: 2, phrases: [
  { es: "He cruzado los Pirineos en bicicleta.", va: "He travessat els Pirineus en bicicleta." },
  { es: "Tengo un tatuaje que no le he enseñado a mis padres.", va: "Tinc un tatuatge que no els he ensenyat als meus pares." },
  { es: "Una vez actué de extra en una serie de televisión.", va: "Una vegada vaig actuar d'extra en una sèrie de televisió." },
] };
const SET_MINE2: PhraseSet = { lie: 2, phrases: [
  { es: "Nunca me he roto un hueso.", va: "Mai m'he trencat cap os." },
  { es: "Sé decir «gracias» en seis idiomas.", va: "Sé dir «gràcies» en sis idiomes." },
  { es: "Tengo un póster firmado por mi grupo de música favorito.", va: "Tinc un pòster firmat pel meu grup de música preferit." },
] };
const SET_GROUP: PhraseSet = { lie: 2, phrases: [
  { es: "Sé hacer nudos de escalada.", va: "Sé fer nucs d'escalada." },
  { es: "Una vez dormí en un aeropuerto.", va: "Una vegada vaig dormir en un aeroport." },
  { es: "Tengo miedo a las palomas.", va: "Tinc por dels coloms." },
] };
const SET_GDONE1: PhraseSet = { lie: 2, phrases: [
  { es: "Una vez me perdí en mi propio barrio.", va: "Una vegada em vaig perdre al meu propi barri." },
  { es: "Sé silbar con dos dedos.", va: "Sé xiular amb dos dits." },
  { es: "Tengo doble titulación.", va: "Tinc doble titulació." },
] };
const SET_GDONE2: PhraseSet = { lie: 2, phrases: [
  { es: "Nunca he cocinado sin quemar algo.", va: "Mai he cuinat sense cremar alguna cosa." },
  { es: "Tengo el carné de socorrista.", va: "Tinc el carnet de socorrisme." },
  { es: "Una vez gané una beca de intercambio.", va: "Una vegada vaig guanyar una beca d'intercanvi." },
] };

function cardsFrom(world: GameWorld, set: PhraseSet): StoredCard[] {
  return set.phrases.map((phrase, index) => ({ text: world.t(phrase.es, phrase.va), lie: index === set.lie }));
}

function personOf(world: GameWorld, id: string): GamePerson {
  if (id === world.me.id) return world.me;
  return world.people.find(person => person.id === id) ?? world.me;
}

/** A named person to seed with, falling back by position so the demo still works if the roster changes. */
function seedPerson(world: GameWorld, id: string, fallbackIndex: number): GamePerson {
  return world.people.find(person => person.id === id) ?? world.people[fallbackIndex] ?? world.me;
}

function lieIndex(round: StoredRound): number {
  return round.cards.findIndex(card => card.lie);
}

function playedBy(round: StoredRound, personId: string): boolean {
  return round.plays.some(play => play.player === personId);
}

/** Whether the round's audience, defined from its owner's point of view, reaches me. */
function ownerIncludesMe(world: GameWorld, owner: GamePerson, audience: Audience): boolean {
  switch (audience.kind) {
    case "campus": return true;
    case "site": return world.me.campus === owner.campus;
    case "degree": return world.me.degree === owner.degree;
    case "course": return world.me.degree === owner.degree && world.me.year === owner.year;
    case "group": return !!audience.ref && world.me.groups.includes(audience.ref);
    case "contacts": return owner.contact;
    case "person": return audience.ref === world.me.id;
  }
}

function roundLabel(world: GameWorld, owner: GamePerson, audience: Audience): string {
  const t = world.t;
  switch (audience.kind) {
    case "campus": return t("Todo el campus", "Tot el campus");
    case "site": return owner.campus;
    case "degree": return owner.degree;
    case "course": return `${owner.degree} · ${owner.year}º`;
    case "contacts": return t("Contactos", "Contactes");
    case "group": return world.groups.find(group => group.id === audience.ref)?.name ?? t("Un grupo", "Un grup");
    case "person": return audience.ref === world.me.id ? t("Reto directo", "Repte directe") : world.people.find(person => person.id === audience.ref)?.name ?? owner.name;
  }
}

function cardsView(round: StoredRound, world: GameWorld, reveal: boolean): TruthCard[] {
  const total = round.plays.length;
  const myGuess = round.plays.find(play => play.player === world.me.id)?.guess;
  return round.cards.map((card, index) => {
    if (!reveal) return { text: card.text };
    const share = total ? round.plays.filter(play => play.guess === index).length / total : 0;
    return { text: card.text, lie: card.lie, share, picked: myGuess === index };
  });
}

function roundView(round: StoredRound, world: GameWorld, owner: GamePerson, reveal: boolean): TruthRound {
  const total = round.plays.length;
  const correctGuesses = round.plays.filter(play => play.guess === lieIndex(round)).length;
  const myPlay = round.plays.find(play => play.player === world.me.id);
  return {
    id: round.id, owner: round.owner, owner_name: owner.name, mine: round.owner === world.me.id,
    audience: round.audience, anon: false,
    created_at: new Date(round.createdAt).toISOString(), expires: new Date(round.expiresAt).toISOString(),
    cards: cardsView(round, world, reveal), audienceLabel: roundLabel(world, owner, round.audience),
    played: !!myPlay, correct: myPlay ? myPlay.guess === lieIndex(round) : undefined,
    playedCount: total, deceived: total - correctGuesses, groupRound: round.groupRound,
  };
}

/** My run of correct guesses, most recent first, across every round I have played. */
function myStreak(world: GameWorld, rounds: StoredRound[]): number {
  const plays = rounds.flatMap(round => round.plays.filter(play => play.player === world.me.id).map(play => ({ at: play.at, correct: play.guess === lieIndex(round) })));
  plays.sort((a, b) => a.at - b.at);
  let streak = 0;
  for (let index = plays.length - 1; index >= 0; index--) { if (plays[index].correct) streak++; else break; }
  return streak;
}

function groupView(entry: StoredGroupRound, world: GameWorld, store: Store, now: number): GroupRoundView {
  const group = world.groups.find(candidate => candidate.id === entry.group);
  const related = store.rounds.filter(round => round.groupRound === entry.id);
  const active = now < entry.expiresAt;
  const mine = related.find(round => round.owner === world.me.id);
  let summary: GroupRoundView["summary"] = null;
  if (!active) {
    const deceivedBy = new Map<string, number>();
    const correctBy = new Map<string, number>();
    for (const round of related) {
      const lie = lieIndex(round);
      let deceivedHere = 0;
      for (const play of round.plays) {
        if (play.guess === lie) correctBy.set(play.player, (correctBy.get(play.player) ?? 0) + 1);
        else deceivedHere++;
      }
      if (deceivedHere) deceivedBy.set(round.owner, (deceivedBy.get(round.owner) ?? 0) + deceivedHere);
    }
    const top = (counts: Map<string, number>) => [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const mostDeceiving = top(deceivedBy), mostAccurate = top(correctBy);
    summary = { mostDeceiving: mostDeceiving ? personOf(world, mostDeceiving[0]).name : "", mostAccurate: mostAccurate ? personOf(world, mostAccurate[0]).name : "" };
  }
  return {
    id: entry.id, group: entry.group, groupName: group?.name ?? "", active, finished: !active,
    expires: new Date(entry.expiresAt).toISOString(),
    members: group?.members.length ?? 0, posted: related.length, myRound: mine?.id, summary,
  };
}

function seed(ctx: DemoContext<Store>): Store {
  const { world } = ctx;
  const now = ctx.now();
  const laia = seedPerson(world, "demo-laia", 2);
  const marc = seedPerson(world, "demo-marc", 1);
  const paula = seedPerson(world, "demo-paula", 0);
  const nico = seedPerson(world, "demo-nico", 3);
  const aina = seedPerson(world, "demo-aina", 4);
  const myGroup = world.groups.find(group => group.members.includes(world.me.id));

  const rounds: StoredRound[] = [
    { id: "seed-laia", owner: laia.id, audience: { kind: "campus" }, cards: cardsFrom(world, SET_A), createdAt: now - 2 * DAY, expiresAt: now - 2 * DAY + SEVEN_DAYS, plays: [] },
    { id: "seed-marc", owner: marc.id, audience: { kind: "campus" }, cards: cardsFrom(world, SET_B), createdAt: now - 3 * DAY, expiresAt: now - 3 * DAY + SEVEN_DAYS, plays: [{ player: world.me.id, guess: 1, at: now - 1 * DAY }] },
    { id: "seed-paula", owner: paula.id, audience: { kind: "contacts" }, cards: cardsFrom(world, SET_C), createdAt: now - 1 * DAY, expiresAt: now - 1 * DAY + SEVEN_DAYS, plays: [] },
    { id: "seed-nico", owner: nico.id, audience: { kind: "person", ref: world.me.id }, cards: cardsFrom(world, SET_D), createdAt: now - 0.5 * DAY, expiresAt: now - 0.5 * DAY + SEVEN_DAYS, plays: [] },
    { id: "seed-aina", owner: aina.id, audience: { kind: "campus" }, cards: cardsFrom(world, SET_E), createdAt: now - 4 * DAY, expiresAt: now - 4 * DAY + SEVEN_DAYS, plays: [] },
    { id: "mine-active", owner: world.me.id, audience: { kind: "degree" }, cards: cardsFrom(world, SET_MINE), createdAt: now - 1 * DAY, expiresAt: now - 1 * DAY + SEVEN_DAYS, plays: [
      { player: laia.id, guess: 2, at: now - 20 * 3600000 },
      { player: marc.id, guess: 0, at: now - 18 * 3600000 },
      { player: paula.id, guess: 1, at: now - 10 * 3600000 },
      { player: nico.id, guess: 0, at: now - 6 * 3600000 },
      { player: aina.id, guess: 2, at: now - 2 * 3600000 },
    ] },
    { id: "mine-finished", owner: world.me.id, audience: { kind: "campus" }, cards: cardsFrom(world, SET_MINE2), createdAt: now - 9 * DAY, expiresAt: now - 2 * DAY, plays: [
      { player: laia.id, guess: 0, at: now - 8 * DAY },
      { player: marc.id, guess: 2, at: now - 8 * DAY },
      { player: paula.id, guess: 1, at: now - 7 * DAY },
      { player: nico.id, guess: 2, at: now - 7 * DAY },
    ] },
  ];

  const groupRounds: StoredGroupRound[] = [];
  if (myGroup) {
    groupRounds.push({ id: "group-active", group: myGroup.id, createdAt: now - 1 * DAY, expiresAt: now + 2 * DAY });
    groupRounds.push({ id: "group-done", group: myGroup.id, createdAt: now - 10 * DAY, expiresAt: now - 7 * DAY });
    rounds.push({ id: "seed-group-laia", owner: laia.id, audience: { kind: "group", ref: myGroup.id }, cards: cardsFrom(world, SET_GROUP), createdAt: now - 1 * DAY, expiresAt: now + 2 * DAY, plays: [], groupRound: "group-active" });
    rounds.push({ id: "group-done-laia", owner: laia.id, audience: { kind: "group", ref: myGroup.id }, cards: cardsFrom(world, SET_GDONE1), createdAt: now - 9 * DAY, expiresAt: now - 7 * DAY, plays: [{ player: world.me.id, guess: 0, at: now - 8 * DAY }], groupRound: "group-done" });
    rounds.push({ id: "group-done-me", owner: world.me.id, audience: { kind: "group", ref: myGroup.id }, cards: cardsFrom(world, SET_GDONE2), createdAt: now - 9 * DAY, expiresAt: now - 7 * DAY, plays: [{ player: laia.id, guess: 2, at: now - 8 * DAY }], groupRound: "group-done" });
  }

  return { rounds, groupRounds };
}

function doCreate(ctx: DemoContext<Store>, input: Record<string, unknown>) {
  const world = ctx.world, store = ctx.store, now = ctx.now();
  const rawCards = input.cards;
  if (!Array.isArray(rawCards) || rawCards.length !== 3) ctx.fail("Escribe tres frases.", "Escriu tres frases.");
  const cards = (rawCards as Array<{ text?: unknown; lie?: unknown }>).map(card => ({ text: typeof card?.text === "string" ? card.text.trim() : "", lie: card?.lie === true }));
  if (cards.some(card => !card.text || card.text.length > 180)) ctx.fail("Cada frase necesita texto, hasta 180 caracteres.", "Cada frase necessita text, fins a 180 caràcters.");
  if (new Set(cards.map(card => card.text.toLocaleLowerCase())).size !== 3) ctx.fail("Las tres frases deben ser distintas.", "Les tres frases han de ser diferents.");
  if (cards.filter(card => card.lie).length !== 1) ctx.fail("Da la vuelta a la carta que es mentira.", "Gira la carta que és mentida.");

  const rawAudience = input.audience as Audience | undefined;
  if (!rawAudience || !truthAudienceKinds.includes(rawAudience.kind)) ctx.fail("Elige para quién es la ronda.", "Tria per a qui és la ronda.");
  if (rawAudience.kind === "group" && (!rawAudience.ref || !world.me.groups.includes(rawAudience.ref))) ctx.fail("Elige un grupo del que formes parte.", "Tria un grup del qual formes part.");
  if (rawAudience.kind === "person" && (!rawAudience.ref || rawAudience.ref === world.me.id || !world.people.some(person => person.id === rawAudience.ref))) ctx.fail("Elige a quién retas.", "Tria a qui reptes.");
  const audience: Audience = { kind: rawAudience.kind, ref: rawAudience.ref };
  if (store.rounds.some(round => round.owner === world.me.id && now < round.expiresAt && sameAudience(round.audience, audience))) ctx.fail("Ya tienes una ronda activa para ese destinatario.", "Ja tens una ronda activa per a eixe destinatari.");

  let expiresAt = now + SEVEN_DAYS, groupRound: string | undefined;
  if (audience.kind === "group") {
    const active = store.groupRounds.find(entry => entry.group === audience.ref && now < entry.expiresAt);
    if (active) { groupRound = active.id; expiresAt = active.expiresAt; }
  }
  store.rounds.push({ id: ctx.id(), owner: world.me.id, audience, cards, createdAt: now, expiresAt, plays: [], groupRound });
}

function doPlay(ctx: DemoContext<Store>, input: Record<string, unknown>) {
  const world = ctx.world, store = ctx.store, now = ctx.now();
  const round = store.rounds.find(candidate => candidate.id === input.round);
  if (!round) ctx.fail("Esa ronda ya no existe.", "Eixa ronda ja no existix.");
  if (round.owner === world.me.id) ctx.fail("No puedes jugar tu propia ronda.", "No pots jugar la teua pròpia ronda.");
  if (now >= round.expiresAt) ctx.fail("Esta ronda ya ha terminado.", "Esta ronda ja ha acabat.");
  if (playedBy(round, world.me.id)) ctx.fail("Ya has jugado esta ronda.", "Ja has jugat esta ronda.");
  const guess = input.guess;
  if (typeof guess !== "number" || ![0, 1, 2].includes(guess)) ctx.fail("Toca una de las tres cartas.", "Toca una de les tres cartes.");
  round.plays.push({ player: world.me.id, guess, at: now });
}

function doStartGroupRound(ctx: DemoContext<Store>, input: Record<string, unknown>) {
  const world = ctx.world, store = ctx.store, now = ctx.now();
  const groupId = input.group;
  if (typeof groupId !== "string" || !world.me.groups.includes(groupId)) ctx.fail("Elige un grupo del que formes parte.", "Tria un grup del qual formes part.");
  if (store.groupRounds.some(entry => entry.group === groupId && now < entry.expiresAt)) ctx.fail("Este grupo ya tiene una ronda en marcha.", "Este grup ja té una ronda en marxa.");
  store.groupRounds.push({ id: ctx.id(), group: groupId, createdAt: now, expiresAt: now + THREE_DAYS });
}

/** Demo: since there is nobody on the other side, this simulates one more person playing one of my rounds. */
function doDemoPlay(ctx: DemoContext<Store>, input: Record<string, unknown>) {
  const world = ctx.world, store = ctx.store, now = ctx.now();
  const round = store.rounds.find(candidate => candidate.id === input.round && candidate.owner === world.me.id);
  if (!round) ctx.fail("Esa ronda no es tuya o ya no existe.", "Eixa ronda no és teua o ja no existix.");
  if (now >= round.expiresAt) ctx.fail("Esta ronda ya ha terminado.", "Esta ronda ja ha acabat.");
  const eligible = world.people.filter(person => !playedBy(round, person.id));
  if (!eligible.length) ctx.fail("Ya ha jugado todo el mundo disponible en la demo.", "Ja ha jugat tot el món disponible en la demo.");
  const player = ctx.pick(eligible, `${round.id}-${round.plays.length}`);
  const lie = lieIndex(round);
  const others = [0, 1, 2].filter(index => index !== lie);
  const guess = ctx.pick([lie, lie, others[0], others[1]], `${round.id}-${now}`);
  round.plays.push({ player: player.id, guess, at: now });
}

export function play(world: GameWorld, command: string, input: Record<string, unknown>): State {
  const ctx = demoContext<Store>("truth", world, context => seed(context));
  switch (command) {
    case "read": break;
    case "create": doCreate(ctx, input); break;
    case "play": doPlay(ctx, input); break;
    case "startGroupRound": doStartGroupRound(ctx, input); break;
    case "demoPlay": doDemoPlay(ctx, input); break;
    default: ctx.fail("Acción desconocida.", "Acció desconeguda.");
  }
  const { world: w, store } = ctx, now = ctx.now();
  const deck = store.rounds
    .filter(round => round.owner !== w.me.id && now < round.expiresAt && ownerIncludesMe(w, personOf(w, round.owner), round.audience))
    // Keep the deck order stable after a guess. The screen must keep showing
    // the answered round until the player explicitly advances to the next one.
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(round => roundView(round, w, personOf(w, round.owner), playedBy(round, w.me.id)));
  const mine = store.rounds
    .filter(round => round.owner === w.me.id)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(round => roundView(round, w, w.me, true));
  const groups = store.groupRounds
    .filter(entry => w.me.groups.includes(entry.group))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(entry => groupView(entry, w, store, now));
  return { streak: myStreak(w, store.rounds), deck, mine, groups, audienceKinds: truthAudienceKinds };
}
