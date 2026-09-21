import { demoContext, type DemoContext } from "./store";
import { audienceLabel, audienceReach } from "../audience";
import { nowIso, inHours, inMinutes, past, type Audience, type AudienceKind, type GamePerson, type GameWorld } from "../types";

/**
 * Defiende lo indefendible: a claim, two rivals with drawn stances, three
 * timed turns each and a public that claps live and votes once it is over.
 * See docs/juegos/05-defiende-lo-indefendible.md for the full design.
 */

export type DebateStance = "defends" | "attacks";
export type DebateStatus = "open" | "pending" | "coin" | "live" | "voting" | "verdict" | "abandoned";
export type DebateMode = "open" | "direct" | "group";
type Outcome = "declined" | "cancelled" | "timeout" | "forfeit";

type RawTurn = { by: string; text: string; at: string; claps: number; clappedBy: string[]; expired?: boolean };

type Debate = {
  id: string; owner: string; owner_name: string; mine: boolean; audience: Audience; anon: boolean; created_at: string; expires: string | null;
  kind: DebateMode; claim: string; pace: "live" | "calm"; coinToss: boolean; status: DebateStatus;
  opponent: string | null; targetId?: string;
  proposerStance: DebateStance | null;
  turns: RawTurn[]; turnUser: string | null; turnDeadline: string | null; skipped: Record<string, number>;
  coinRevealAt: string | null;
  votingDeadline: string | null; votes: Record<string, string>; winner: string | "tie" | null;
  reported: boolean; rematchOf: string | null; outcome?: Outcome;
};

type Store = { debates: Debate[] };

export type TurnView = { index: number; by: string; byName: string; mine: boolean; text: string; at: string; claps: number; clapped: boolean; expired: boolean };

export type DebateCard = {
  id: string; claim: string; createdAt: string; mode: DebateMode;
  audienceLabel: string; reach: number;
  pace: "live" | "calm"; coinToss: boolean; status: DebateStatus; outcome?: Outcome;
  amProposer: boolean; amOpponent: boolean; amRival: boolean;
  proposer: { id: string; name: string; stance: DebateStance | null };
  opponent: { id: string; name: string; stance: DebateStance | null } | null;
  targetName?: string;
  expires: string | null;
  turns: TurnView[];
  turnUser: string | null; turnUserName?: string; isMyTurn: boolean;
  turnDeadline: string | null; turnSeconds: number; turnsLeftMine?: number;
  coinRevealAt: string | null;
  votingDeadline: string | null; myVote: string | null; canVote: boolean;
  votesClosed: boolean; winner: string | "tie" | null; winnerName?: string; winnerShare?: number; totalVotes?: number;
  bestTurn?: TurnView;
  reported: boolean; canReport: boolean; canRematch: boolean;
  canAcceptDirect: boolean; canAcceptOpen: boolean; canCancel: boolean;
  canDemoAccept: boolean; canDemoTurn: boolean; canDemoClap: boolean; canDemoVotes: boolean;
};

export type State = { canPropose: boolean; suggestions: string[]; mine: DebateCard | null; others: DebateCard[] };

// ---- helpers over the shared world ----------------------------------------

function personById(world: GameWorld, id: string): GamePerson | undefined {
  return id === world.me.id ? world.me : world.people.find(person => person.id === id);
}

/** Same rules as audience.ts's inAudience, but relative to an arbitrary creator instead of always world.me. */
function inAudienceOf(person: GamePerson, audience: Audience, creator: GamePerson): boolean {
  switch (audience.kind) {
    case "campus": return true;
    case "site": return person.campus === creator.campus;
    case "degree": return person.degree === creator.degree;
    case "course": return person.degree === creator.degree && person.year === creator.year;
    case "group": return !!audience.ref && person.groups.includes(audience.ref);
    case "contacts": return person.contact;
    case "person": return person.id === audience.ref;
  }
}

function meCanSee(d: Debate, world: GameWorld): boolean {
  if (d.kind === "direct" && d.targetId === world.me.id) return true;
  const proposer = personById(world, d.owner);
  return !!proposer && inAudienceOf(world.me, d.audience, proposer);
}

const normalize = (text: string) => text.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const sensitiveWords = ["politic", "partido", "gobierno", "president", "psoe", " pp ", "vox", "podemos", "sumar", "religio", "dios", "iglesia", "catolic", "musulm", "islam", "judio", "biblia", "coran", "ateo", "aborto", "genero", "transexual", "transgenero", "orientacion sexual", "gay", "lesbiana", "feminis", "machis", "racis", "monarqu"];

/** The same light check the design asks for: no politics, religion, identity or named classmates. */
function looksSensitive(text: string, world: GameWorld, excludeIds: string[]): { es: string; va: string } | null {
  const plain = normalize(text);
  for (const word of sensitiveWords) if (plain.includes(word)) return { es: "Nada de política, religión o identidad: el debate tiene que ser una tontería sin importancia.", va: "Res de política, religió o identitat: el debat ha de ser una ximpleria sense importància." };
  for (const person of world.people) {
    if (excludeIds.includes(person.id)) continue;
    const first = normalize(person.name.split(/\s+/)[0] ?? "");
    if (first.length > 2 && new RegExp(`\\b${first}\\b`).test(plain)) return { es: "No metas a gente real del campus en la afirmación.", va: "No fiques gent real del campus en l'afirmació." };
  }
  return null;
}

const claimPairs: [string, string][] = [
  ["El cereal se come mejor sin leche.", "Els cereals es mengen millor sense llet."],
  ["La tortilla de patata está mejor sin cebolla.", "La truita de creïlles està millor sense ceba."],
  ["Los lunes deberían ser festivos.", "Els dilluns haurien de ser festius."],
  ["La siesta después de comer debería ser obligatoria en clase.", "La migdiada després de dinar hauria de ser obligatòria a classe."],
  ["El chándal es la prenda más elegante que existe.", "El xandall és la peça més elegant que existix."],
  ["Las películas se disfrutan más sin subtítulos, aunque no entiendas el idioma.", "Les pel·lícules es gaudixen més sense subtítols, encara que no entengues l'idioma."],
  ["El wifi de la biblioteca debería ser un derecho fundamental.", "El wifi de la biblioteca hauria de ser un dret fonamental."],
  ["La piña en la pizza es una genialidad.", "La pinya a la pizza és una genialitat."],
  ["Los apuntes a mano valen más que cualquier PDF.", "Els apunts a mà valen més que qualsevol PDF."],
  ["Media hora tarde ya no es llegar tarde, es llegar a tu ritmo.", "Mitja hora tard ja no és arribar tard, és arribar al teu ritme."],
];
const claimSuggestions = (world: GameWorld) => claimPairs.map(([es, va]) => world.t(es, va));

const rebuttalPairs: [string, string][] = [
  ["Eso lo dices porque nunca lo has probado en condiciones.", "Això ho dius perquè mai ho has provat en condicions."],
  ["Con esa lógica también defenderías comer sopa con tenedor.", "Amb eixa lògica també defendries menjar sopa amb forquilla."],
  ["Todo el mundo que lo prueba acaba dándome la razón, dame un minuto.", "Tot el món que ho prova acaba donant-me la raó, dona'm un minut."],
  ["Vale, pero eso no explica por qué sigues perdiendo este debate.", "Val, però això no explica per què continues perdent este debat."],
  ["Interesante teoría. Totalmente equivocada, pero interesante.", "Interessant teoria. Totalment equivocada, però interessant."],
  ["Si tan mala idea fuera, no estarías tan nervioso defendiéndola.", "Si tan mala idea fóra, no estaries tan nerviós defenent-la."],
];
const demoRebuttals = (world: GameWorld) => rebuttalPairs.map(([es, va]) => world.t(es, va));

const turnSecondsFor = (pace: "live" | "calm") => pace === "live" ? 180 : 43200;
function startTurn(d: Debate) { d.turnDeadline = d.pace === "live" ? inMinutes(3) : inHours(12); }
const otherRival = (d: Debate, id: string) => id === d.owner ? d.opponent! : d.owner;

function beginContest(d: Debate, ctx: DemoContext<Store>) {
  d.proposerStance = d.coinToss ? ctx.pick(["defends", "attacks"] as const, d.id) : "defends";
  d.turnUser = d.owner;
  if (d.coinToss) { d.status = "coin"; d.coinRevealAt = inMinutes(0.05); d.turnDeadline = null; }
  else { d.status = "live"; startTurn(d); }
}

function finishVoting(d: Debate) {
  let forOwner = 0, forOpponent = 0;
  for (const choice of Object.values(d.votes)) { if (choice === d.owner) forOwner++; else if (choice === d.opponent) forOpponent++; }
  const total = forOwner + forOpponent;
  d.winner = total === 0 || forOwner === forOpponent ? "tie" : forOwner > forOpponent ? d.owner : d.opponent!;
  d.status = "verdict";
}

/** Catches every room up to now: expired invitations, expired turns and closed votes. Pure function of time. */
function tick(d: Debate) {
  if ((d.status === "open" || d.status === "pending") && past(d.expires)) { d.status = "abandoned"; d.outcome = "timeout"; return; }
  if (d.status === "coin" && past(d.coinRevealAt)) { d.status = "live"; startTurn(d); }
  let guard = 0;
  while (d.status === "live" && past(d.turnDeadline) && guard++ < 8) {
    const loser = d.turnUser!;
    d.skipped[loser] = (d.skipped[loser] ?? 0) + 1;
    d.turns.push({ by: loser, text: "", at: nowIso(), claps: 0, clappedBy: [], expired: true });
    if (d.skipped[loser] >= 2) { d.status = "abandoned"; d.winner = otherRival(d, loser); d.outcome = "forfeit"; break; }
    if (d.turns.length >= 6) { d.status = "voting"; d.votingDeadline = inHours(24); d.turnUser = null; d.turnDeadline = null; break; }
    d.turnUser = otherRival(d, loser); startTurn(d);
  }
  if (d.status === "voting" && past(d.votingDeadline)) finishVoting(d);
}

// ---- view --------------------------------------------------------------

function cardFor(d: Debate, ctx: DemoContext<Store>): DebateCard {
  const world = ctx.world, t = world.t;
  const proposer = personById(world, d.owner)!;
  const opponentPerson = d.opponent ? personById(world, d.opponent) : undefined;
  const amProposer = d.owner === ctx.me.id, amOpponent = d.opponent === ctx.me.id, amRival = amProposer || amOpponent;
  const showStances = d.status !== "open" && d.status !== "pending" && d.status !== "coin";
  const proposerStance = showStances ? d.proposerStance : null;
  const opponentStance = showStances && d.proposerStance ? (d.proposerStance === "defends" ? "attacks" : "defends") : null;
  const turns: TurnView[] = d.turns.map((turn, index) => ({
    index, by: turn.by, byName: personById(world, turn.by)?.name ?? "—", mine: turn.by === ctx.me.id,
    text: turn.text, at: turn.at, claps: turn.claps, clapped: turn.clappedBy.includes(ctx.me.id), expired: !!turn.expired,
  }));
  const bestTurn = turns.filter(turn => !turn.expired && turn.text).reduce<TurnView | undefined>((best, turn) => (!best || turn.claps > best.claps) ? turn : best, undefined);
  const totalVotes = Object.keys(d.votes).length;
  const proposerVotes = Object.values(d.votes).filter(vote => vote === d.owner).length;
  let winnerShare: number | undefined;
  if (d.status === "verdict" && totalVotes > 0 && d.winner && d.winner !== "tie") {
    const winnerVotes = d.winner === d.owner ? proposerVotes : totalVotes - proposerVotes;
    winnerShare = Math.round((winnerVotes / totalVotes) * 100);
  }
  const myTurnsUsed = d.turns.filter(turn => turn.by === ctx.me.id && !turn.expired).length;
  return {
    id: d.id, claim: d.claim, createdAt: d.created_at, mode: d.kind,
    audienceLabel: audienceLabel(d.audience, world), reach: audienceReach(d.audience, world),
    pace: d.pace, coinToss: d.coinToss, status: d.status, outcome: d.outcome,
    amProposer, amOpponent, amRival,
    proposer: { id: proposer.id, name: proposer.name, stance: proposerStance },
    opponent: opponentPerson ? { id: opponentPerson.id, name: opponentPerson.name, stance: opponentStance } : null,
    targetName: d.targetId ? personById(world, d.targetId)?.name : undefined,
    expires: d.expires,
    turns, turnUser: d.turnUser, turnUserName: d.turnUser ? personById(world, d.turnUser)?.name : undefined,
    isMyTurn: d.turnUser === ctx.me.id,
    turnDeadline: d.turnDeadline, turnSeconds: turnSecondsFor(d.pace), turnsLeftMine: amRival ? Math.max(0, 3 - myTurnsUsed) : undefined,
    coinRevealAt: d.coinRevealAt, votingDeadline: d.votingDeadline,
    myVote: d.votes[ctx.me.id] ?? null,
    canVote: d.status === "voting" && !amRival && !(ctx.me.id in d.votes),
    votesClosed: d.status === "verdict",
    winner: d.winner, winnerName: d.winner === "tie" ? t("Empate", "Empat") : d.winner ? personById(world, d.winner)?.name : undefined,
    winnerShare, totalVotes: d.status === "verdict" ? totalVotes : undefined,
    bestTurn: d.status === "verdict" ? bestTurn : undefined,
    reported: d.reported, canReport: !d.reported,
    canRematch: d.status === "verdict" && amRival && !!d.opponent,
    canAcceptDirect: d.kind === "direct" && d.status === "pending" && d.targetId === ctx.me.id,
    canAcceptOpen: d.status === "open" && d.kind !== "direct" && !amRival && inAudienceOf(ctx.me, d.audience, proposer),
    canCancel: amProposer && (d.status === "open" || d.status === "pending"),
    canDemoAccept: amProposer && (d.status === "open" || d.status === "pending"),
    canDemoTurn: d.status === "live" && amRival && !!d.turnUser && d.turnUser !== ctx.me.id,
    canDemoClap: (d.status === "live" || d.status === "voting") && d.turns.length > 0,
    canDemoVotes: d.status === "voting",
  };
}

function buildState(ctx: DemoContext<Store>): State {
  const world = ctx.world;
  const cards = ctx.store.debates.map(d => cardFor(d, ctx));
  const mineCards = cards.filter(card => card.amRival);
  const mine = mineCards.find(card => card.status !== "verdict" && card.status !== "abandoned") ?? mineCards[0] ?? null;
  const others = ctx.store.debates.filter(d => !(d.owner === ctx.me.id || d.opponent === ctx.me.id) && meCanSee(d, world)).map(d => cardFor(d, ctx));
  const canPropose = !ctx.store.debates.some(d => d.owner === ctx.me.id && d.status !== "verdict" && d.status !== "abandoned");
  return { canPropose, suggestions: claimSuggestions(world), mine, others };
}

// ---- commands ------------------------------------------------------------

function findDebate(ctx: DemoContext<Store>, input: Record<string, unknown>): Debate {
  const id = String(input.id ?? "");
  const debate = ctx.store.debates.find(d => d.id === id);
  if (!debate) ctx.fail("Ese debate ya no existe.", "Eixe debat ja no existix.");
  return debate;
}

function newDebate(ctx: DemoContext<Store>, base: Partial<Debate> & Pick<Debate, "kind" | "claim" | "pace" | "coinToss" | "audience" | "expires" | "status">): Debate {
  return {
    id: ctx.id(), owner: ctx.me.id, owner_name: ctx.me.name, mine: true, anon: false, created_at: nowIso(),
    opponent: null, proposerStance: null, turns: [], turnUser: null, turnDeadline: null, skipped: {},
    coinRevealAt: null, votingDeadline: null, votes: {}, winner: null, reported: false, rematchOf: null,
    ...base,
  };
}

function doPropose(ctx: DemoContext<Store>, input: Record<string, unknown>) {
  const world = ctx.world;
  if (ctx.store.debates.some(d => d.owner === ctx.me.id && d.status !== "verdict" && d.status !== "abandoned"))
    ctx.fail("Ya tienes un debate en marcha. Ciérralo antes de proponer otro.", "Ja tens un debat en marxa. Tanca'l abans de proposar-ne un altre.");
  const claim = String(input.claim ?? "").trim();
  if (claim.length < 8) ctx.fail("La afirmación es demasiado corta.", "L'afirmació és massa curta.");
  if (claim.length > 140) ctx.fail("La afirmación es demasiado larga.", "L'afirmació és massa llarga.");
  const sensitive = looksSensitive(claim, world, []);
  if (sensitive) ctx.fail(sensitive.es, sensitive.va);

  const mode: DebateMode = input.mode === "direct" || input.mode === "group" ? input.mode : "open";
  const pace: "live" | "calm" = input.pace === "live" ? "live" : "calm";
  const coinToss = input.coinToss !== false;

  let audience: Audience, targetId: string | undefined;
  if (mode === "group") {
    const groupId = String(input.groupId ?? "");
    if (!groupId || !world.groups.some(group => group.id === groupId && group.members.includes(ctx.me.id)))
      ctx.fail("Elige un grupo del que formes part.", "Tria un grup del qual formes part.");
    audience = { kind: "group", ref: groupId };
  } else {
    const kind = input.audienceKind as AudienceKind;
    const ref = typeof input.audienceRef === "string" ? input.audienceRef : undefined;
    if (kind !== "campus" && kind !== "degree" && kind !== "course" && kind !== "group") ctx.fail("Elige quién puede ver el debate.", "Tria qui pot vore el debat.");
    audience = { kind, ref: kind === "group" ? ref : undefined };
  }
  if (mode === "direct") {
    targetId = String(input.targetId ?? "");
    if (!targetId || targetId === ctx.me.id || !world.people.some(person => person.id === targetId))
      ctx.fail("Elige a quién retas.", "Tria a qui reptes.");
  }

  const debate = newDebate(ctx, {
    kind: mode, claim, pace, coinToss, audience, targetId,
    expires: mode === "direct" ? inHours(48) : inHours(24 * 7),
    status: mode === "direct" ? "pending" : "open",
  });
  ctx.store.debates.unshift(debate);
}

function doAccept(ctx: DemoContext<Store>, input: Record<string, unknown>) {
  const d = findDebate(ctx, input);
  if (d.status === "pending") { if (d.targetId !== ctx.me.id) ctx.fail("Este reto no es para ti.", "Este repte no és per a tu."); }
  else if (d.status === "open") {
    if (d.owner === ctx.me.id) ctx.fail("No puedes aceptar tu propio reto.", "No pots acceptar el teu propi repte.");
    const proposer = personById(ctx.world, d.owner)!;
    if (!inAudienceOf(ctx.me, d.audience, proposer)) ctx.fail("No puedes aceptar este reto.", "No pots acceptar este repte.");
  } else ctx.fail("Este reto ya no está disponible.", "Este repte ja no està disponible.");
  d.opponent = ctx.me.id;
  beginContest(d, ctx);
}

function doDecline(ctx: DemoContext<Store>, input: Record<string, unknown>) {
  const d = findDebate(ctx, input);
  if (d.kind !== "direct" || d.targetId !== ctx.me.id || d.status !== "pending") ctx.fail("No hay nada que declinar aquí.", "Ací no hi ha res a declinar.");
  d.status = "abandoned"; d.outcome = "declined";
}

function doCancel(ctx: DemoContext<Store>, input: Record<string, unknown>) {
  const d = findDebate(ctx, input);
  if (d.owner !== ctx.me.id || (d.status !== "open" && d.status !== "pending")) ctx.fail("No puedes retirar este debate.", "No pots retirar este debat.");
  d.status = "abandoned"; d.outcome = "cancelled";
}

function doTurn(ctx: DemoContext<Store>, input: Record<string, unknown>) {
  const d = findDebate(ctx, input);
  if (d.status !== "live") ctx.fail("No es el momento de escribir un turno.", "No és el moment d'escriure un torn.");
  if (d.turnUser !== ctx.me.id) ctx.fail("Todavía no es tu turno.", "Encara no és el teu torn.");
  const text = String(input.text ?? "").trim();
  if (!text) ctx.fail("Escribe algo antes de enviarlo.", "Escriu alguna cosa abans d'enviar-ho.");
  if (text.length > 600) ctx.fail("Como mucho 600 caracteres.", "Com a molt 600 caràcters.");
  const sensitive = looksSensitive(text, ctx.world, [d.owner, d.opponent!]);
  if (sensitive) ctx.fail(sensitive.es, sensitive.va);
  d.turns.push({ by: ctx.me.id, text, at: nowIso(), claps: 0, clappedBy: [] });
  if (d.turns.length >= 6) { d.status = "voting"; d.votingDeadline = inHours(24); d.turnUser = null; d.turnDeadline = null; }
  else { d.turnUser = otherRival(d, ctx.me.id); startTurn(d); }
}

function doClap(ctx: DemoContext<Store>, input: Record<string, unknown>) {
  const d = findDebate(ctx, input);
  if (d.status !== "live" && d.status !== "voting") ctx.fail("Ya no se puede aplaudir este debate.", "Ja no es pot aplaudir este debat.");
  if (ctx.me.id === d.owner || ctx.me.id === d.opponent) ctx.fail("Los rivales no aplauden su propio turno.", "Els rivals no aplaudixen el seu propi torn.");
  const turn = d.turns[Number(input.turnIndex)];
  if (!turn) ctx.fail("Ese turno no existe.", "Eixe torn no existix.");
  if (turn.clappedBy.includes(ctx.me.id)) return;
  turn.clappedBy.push(ctx.me.id); turn.claps++;
}

function doVote(ctx: DemoContext<Store>, input: Record<string, unknown>) {
  const d = findDebate(ctx, input);
  if (d.status !== "voting") ctx.fail("La votación no está abierta.", "La votació no està oberta.");
  if (ctx.me.id === d.owner || ctx.me.id === d.opponent) ctx.fail("Los rivales no votan su propio debate.", "Els rivals no voten el seu propi debat.");
  if (ctx.me.id in d.votes) ctx.fail("Ya has votado.", "Ja has votat.");
  const winner = String(input.winner ?? "");
  if (winner !== d.owner && winner !== d.opponent) ctx.fail("Elige a quién argumentó mejor.", "Tria qui va argumentar millor.");
  d.votes[ctx.me.id] = winner;
}

function doReport(ctx: DemoContext<Store>, input: Record<string, unknown>) { findDebate(ctx, input).reported = true; }

function doRematch(ctx: DemoContext<Store>, input: Record<string, unknown>) {
  const d = findDebate(ctx, input);
  if (d.status !== "verdict") ctx.fail("Todavía no ha terminado.", "Encara no ha acabat.");
  if (ctx.me.id !== d.owner && ctx.me.id !== d.opponent) ctx.fail("Solo los rivales piden revancha.", "Només els rivals demanen revenja.");
  if (!d.opponent) ctx.fail("Este debate no llegó a tener rival.", "Este debat no va arribar a tindre rival.");
  if (ctx.store.debates.some(x => x.owner === d.owner && x.status !== "verdict" && x.status !== "abandoned"))
    ctx.fail("Ya hay un debate en marcha con las mismas personas.", "Ja hi ha un debat en marxa amb les mateixes persones.");
  const rematch = newDebate(ctx, {
    kind: d.kind, claim: d.claim, pace: d.pace, coinToss: false, audience: d.audience, expires: null,
    status: "live", opponent: d.opponent, targetId: d.opponent, rematchOf: d.id,
    proposerStance: d.proposerStance === "defends" ? "attacks" : "defends",
  });
  rematch.owner = d.owner; rematch.owner_name = d.owner_name; rematch.turnUser = d.owner;
  startTurn(rematch);
  ctx.store.debates.unshift(rematch);
}

function doDemoAccept(ctx: DemoContext<Store>, input: Record<string, unknown>) {
  const d = findDebate(ctx, input);
  if (d.status !== "open" && d.status !== "pending") ctx.fail("Este reto ya tiene respuesta.", "Este repte ja té resposta.");
  if (d.kind === "direct") { d.opponent = d.targetId!; }
  else {
    const proposer = personById(ctx.world, d.owner)!;
    const candidates = ctx.world.people.filter(person => person.id !== d.owner && inAudienceOf(person, d.audience, proposer));
    d.opponent = candidates.length ? ctx.pick(candidates, d.id).id : (ctx.world.people[0]?.id ?? d.owner);
  }
  beginContest(d, ctx);
}

function doDemoTurn(ctx: DemoContext<Store>, input: Record<string, unknown>) {
  const d = findDebate(ctx, input);
  if (d.status !== "live") ctx.fail("No hay turno que simular ahora mismo.", "No hi ha cap torn que simular ara mateix.");
  if (d.turnUser === ctx.me.id) ctx.fail("Es tu turno: te toca escribir a ti.", "És el teu torn: et toca escriure a tu.");
  const rivalId = d.turnUser!;
  const text = ctx.pick(demoRebuttals(ctx.world), `${d.id}:${d.turns.length}`);
  d.turns.push({ by: rivalId, text, at: nowIso(), claps: 0, clappedBy: [] });
  if (d.turns.length >= 6) { d.status = "voting"; d.votingDeadline = inHours(24); d.turnUser = null; d.turnDeadline = null; }
  else { d.turnUser = otherRival(d, rivalId); startTurn(d); }
}

function doDemoClap(ctx: DemoContext<Store>, input: Record<string, unknown>) {
  const d = findDebate(ctx, input);
  if (!d.turns.length) return;
  const last = d.turns[d.turns.length - 1];
  last.claps += ctx.pick([2, 3, 4, 5, 6], `${d.id}:clap:${last.claps}`);
}

function doDemoVotes(ctx: DemoContext<Store>, input: Record<string, unknown>) {
  const d = findDebate(ctx, input);
  if (d.status !== "voting") ctx.fail("No hay votación abierta para simular.", "No hi ha cap votació oberta per a simular.");
  const proposer = personById(ctx.world, d.owner)!;
  const lean = ctx.pick([d.owner, d.opponent!], `${d.id}:lean`);
  const other = lean === d.owner ? d.opponent! : d.owner;
  let count = 0;
  for (const person of ctx.world.people) {
    if (person.id === d.owner || person.id === d.opponent) continue;
    if (!inAudienceOf(person, d.audience, proposer)) continue;
    if (person.id in d.votes) continue;
    count++;
    d.votes[person.id] = count % 3 === 0 ? other : lean;
  }
  d.votingDeadline = nowIso();
}

const seededPeople = (ctx: DemoContext<Store>) => {
  const world = ctx.world;
  const rival = world.people.length ? ctx.pick(world.people, "debate-rival-1") : world.me;
  const rest = world.people.filter(person => person.id !== rival.id);
  const proposer2 = rest.length ? ctx.pick(rest, "debate-proposer-2") : world.me;
  const rest2 = rest.filter(person => person.id !== proposer2.id);
  const opponent2 = rest2.length ? ctx.pick(rest2, "debate-opponent-2") : proposer2;
  return { rival, proposer2, opponent2 };
};

function seed(ctx: DemoContext<Store>): Store {
  const { rival, proposer2, opponent2 } = seededPeople(ctx);
  const t = ctx.t;

  const live: Debate = newDebate(ctx, {
    kind: "direct", claim: t("El cereal se come mejor sin leche.", "Els cereals es mengen millor sense llet."),
    pace: "calm", coinToss: true, audience: { kind: "degree" }, expires: null, status: "live",
  });
  live.opponent = rival.id; live.targetId = rival.id; live.proposerStance = "attacks";
  live.turns = [
    { by: ctx.me.id, text: t("Empiezo fuerte: la leche solo sirve para ablandar, nunca para mejorar.", "Comence fort: la llet només servix per a estovar, mai per a millorar."), at: nowIso(), claps: 6, clappedBy: [] },
    { by: rival.id, text: t("Sin leche el cereal es cartón con azúcar. Dilo con la boca llena.", "Sense llet el cereal és cartó amb sucre. Digues-ho amb la boca plena."), at: nowIso(), claps: 4, clappedBy: [] },
    { by: ctx.me.id, text: t("El crujido es el 90% de la experiencia. La leche lo arruina en dos minutos.", "El cruixit és el 90% de l'experiència. La llet ho arruïna en dos minuts."), at: nowIso(), claps: 9, clappedBy: [] },
    { by: rival.id, text: t("Nadie pide cereales «crunchy» de postre. Se toman con leche, que para eso está la nevera.", "Ningú demana cereals «crunchy» de postres. Es prenen amb llet, que per a això està la nevera."), at: nowIso(), claps: 3, clappedBy: [] },
  ];
  live.turnUser = ctx.me.id; live.turnDeadline = inHours(9);

  const finished: Debate = newDebate(ctx, {
    kind: "open", claim: t("Los apuntes a mano valen más que cualquier PDF.", "Els apunts a mà valen més que qualsevol PDF."),
    pace: "live", coinToss: true, audience: { kind: "campus" }, expires: null, status: "voting",
  });
  finished.owner = proposer2.id; finished.owner_name = proposer2.name; finished.mine = false;
  finished.opponent = opponent2.id; finished.proposerStance = "defends";
  finished.turns = [
    { by: proposer2.id, text: t("Escribir a mano ancla el recuerdo. Un PDF se archiva y se olvida igual de rápido.", "Escriure a mà ancora el record. Un PDF s'arxiva i s'oblida igual de ràpid."), at: nowIso(), claps: 5, clappedBy: [] },
    { by: opponent2.id, text: t("Un PDF se busca con Ctrl+F. Tus apuntes a mano ni tú los entiendes.", "Un PDF es busca amb Ctrl+F. Els teus apunts a mà ni tu els entens."), at: nowIso(), claps: 7, clappedBy: [] },
    { by: proposer2.id, text: t("Precisamente por eso obligan a repasar: descifrar tu propia letra es repetición espaciada gratis.", "Precisament per això obliguen a repassar: desxifrar la teua pròpia lletra és repetició espaiada gratis."), at: nowIso(), claps: 14, clappedBy: [] },
    { by: opponent2.id, text: t("Eso o directamente repetir asignatura, que también es repetición.", "Això o directament repetir assignatura, que també és repetició."), at: nowIso(), claps: 6, clappedBy: [] },
    { by: proposer2.id, text: t("El boli no se queda sin batería a mitad de examen.", "El bolígraf no es queda sense bateria a mitat d'examen."), at: nowIso(), claps: 8, clappedBy: [] },
    { by: opponent2.id, text: t("Ni el PDF te deja sin mano cuando llevas tres horas de clase.", "Ni el PDF et deixa sense mà quan portes tres hores de classe."), at: nowIso(), claps: 5, clappedBy: [] },
  ];
  finished.votingDeadline = inHours(24);

  return { debates: [live, finished] };
}

export function play(world: GameWorld, command: string, input: Record<string, unknown>): State {
  const ctx = demoContext<Store>("debate", world, seed);
  for (const debate of ctx.store.debates) tick(debate);
  switch (command) {
    case "read": break;
    case "propose": doPropose(ctx, input); break;
    case "accept": doAccept(ctx, input); break;
    case "decline": doDecline(ctx, input); break;
    case "cancel": doCancel(ctx, input); break;
    case "turn": doTurn(ctx, input); break;
    case "clap": doClap(ctx, input); break;
    case "vote": doVote(ctx, input); break;
    case "report": doReport(ctx, input); break;
    case "rematch": doRematch(ctx, input); break;
    case "demoAccept": doDemoAccept(ctx, input); break;
    case "demoTurn": doDemoTurn(ctx, input); break;
    case "demoClap": doDemoClap(ctx, input); break;
    case "demoVotes": doDemoVotes(ctx, input); break;
    default: ctx.fail("Acción desconocida.", "Acció desconeguda.");
  }
  for (const debate of ctx.store.debates) tick(debate);
  return buildState(ctx);
}
