import { demoContext, type DemoContext } from "./store";
import { audienceLabel, audienceReach } from "../audience";
import { minAnonymousAudience, type Audience, type AudienceKind, type GamePerson, type GameWorld } from "../types";

// See docs/juegos/07-el-jurado-del-campus.md for the full design this follows.

export type Choice = "a" | "b";
type SideTotals = { a: number; b: number };

/** A stored jury argument. Arguments are never anonymous, even in an anonymous case. */
type StoredArgument = { id: string; side: Choice; authorId: string; authorName: string; text: string; createdAt: number; supporters: Set<string> };

type VoteRecord = { choice: Choice; switched: boolean };

/**
 * A case as the demo keeps it. Votes and arguments from the handful of demo
 * people are tracked by identity (for switching, support and course/degree
 * breakdowns); `baseline*` pads those with the rest of a campus that does not
 * exist in the demo, so the numbers feel like a real jury instead of five people.
 */
type StoredCase = {
  id: string;
  ownerId: string; // world.me.id, a world.people id, or "team" for the weekly pick
  ownerName: string; // real name, kept even when anon so moderation could use it
  anon: boolean;
  weekly: boolean;
  audience: Audience;
  dilemma: string;
  stanceA: string;
  stanceB: string;
  createdAt: number;
  expiresAt: number;
  withdrawn: boolean;
  votes: Record<string, VoteRecord>;
  baseline: SideTotals;
  baselineDegree: Record<string, SideTotals>;
  baselineCourse: Record<string, SideTotals>;
  baselineSwitched: SideTotals;
  arguments: StoredArgument[];
};

type Store = { cases: StoredCase[] };

export type ArgumentView = { id: string; side: Choice; authorId: string; authorName: string; text: string; supports: number; supportedByMe: boolean; mine: boolean; top: boolean };
export type Breakdown = { label: string; shareA: number; shareB: number; total: number };
export type Verdict = { result: Choice | "split"; shareA: number; shareB: number; total: number; switched: number; switchedToA: number; switchedToB: number; bestArgumentA: ArgumentView | null; bestArgumentB: ArgumentView | null };

export type CaseView = {
  id: string;
  weekly: boolean;
  mine: boolean;
  anon: boolean;
  ownerId: string; // empty while nobody should be shown: anon, or the weekly pick
  ownerName: string;
  audienceLabel: string;
  dilemma: string;
  stanceA: string;
  stanceB: string;
  createdAt: string;
  expires: string;
  minutesLeft: number;
  status: "open" | "closed";
  myVote: Choice | null;
  canSwitch: boolean;
  switched: boolean;
  totalVotes: number;
  shareA: number;
  shareB: number;
  breakdownDegree: Breakdown | null;
  breakdownCourse: Breakdown | null;
  argumentsA: ArgumentView[];
  argumentsB: ArgumentView[];
  verdict: Verdict | null;
  canDemoVote: boolean;
};

export type State = { weekly: CaseView | null; deck: CaseView[]; mine: CaseView[]; openMineCount: number; canCreate: boolean };

const HOUR = 3600000;
const CASE_HOURS = 72;
const allowedAudienceKinds: AudienceKind[] = ["campus", "degree", "course", "group"];

// A short, deliberately narrow list: enough to catch a dilemma that is really
// a crisis, without flagging every heated roommate or breakup story. Both
// accented and plain spellings are listed so this stays a simple substring
// check with no normalization step.
const seriousPatterns = [
  "suicid", "quitarme la vida", "quitar-me la vida", "no quiero vivir", "no vull viure",
  "matarme", "matar-me", "autolesi", "hacerme dano", "hacerme daño", "fer-me mal", "self harm",
  "maltrato", "maltracte", "violacion", "violación", "violencia", "violencia sexual",
  "abuso sexual", "abus sexual", "acoso sexual", "assetjament sexual",
  "me pega", "em pega", "me pegan", "em peguen", "sobredosis", "anorexia", "bulimia", "bulimia",
];
function looksSerious(text: string): boolean {
  const plain = text.toLocaleLowerCase();
  return seriousPatterns.some(word => plain.includes(word));
}

function authorOf(c: StoredCase, world: GameWorld): GamePerson | undefined {
  if (c.ownerId === world.me.id) return world.me;
  return world.people.find(person => person.id === c.ownerId);
}

// Audience kinds carry no explicit reference beyond "group": "degree" and
// "course" mean "same as the author's", so membership is checked against the
// case's own author, not against whoever happens to be reading.
function visibleToMe(c: StoredCase, world: GameWorld): boolean {
  if (c.withdrawn) return false;
  if (c.ownerId === world.me.id) return true;
  if (c.audience.kind === "campus") return true;
  const author = authorOf(c, world);
  if (!author) return false;
  if (c.audience.kind === "degree") return world.me.degree === author.degree;
  if (c.audience.kind === "course") return world.me.degree === author.degree && world.me.year === author.year;
  if (c.audience.kind === "group") return !!c.audience.ref && world.me.groups.includes(c.audience.ref);
  return false;
}

function anonLabel(kind: AudienceKind, t: (es: string, va: string) => string): string {
  if (kind === "degree") return t("Alguien de tu carrera pregunta", "Algú de la teua carrera pregunta");
  if (kind === "course") return t("Alguien de tu curso pregunta", "Algú del teu curs pregunta");
  if (kind === "group") return t("Alguien de tu grupo pregunta", "Algú del teu grup pregunta");
  return t("Alguien del campus pregunta", "Algú del campus pregunta");
}

function personDegree(id: string, world: GameWorld): string | null {
  if (id === world.me.id) return world.me.degree;
  return world.people.find(person => person.id === id)?.degree ?? null;
}
function personCourse(id: string, world: GameWorld): string | null {
  const person = id === world.me.id ? world.me : world.people.find(candidate => candidate.id === id);
  return person ? `${person.degree}::${person.year}` : null;
}

function tally(c: StoredCase): SideTotals & { total: number } {
  let a = c.baseline.a, b = c.baseline.b;
  for (const vote of Object.values(c.votes)) { if (vote.choice === "a") a++; else b++; }
  return { a, b, total: a + b };
}
function switchedTally(c: StoredCase): SideTotals & { total: number } {
  let a = c.baselineSwitched.a, b = c.baselineSwitched.b;
  for (const vote of Object.values(c.votes)) if (vote.switched) { if (vote.choice === "a") a++; else b++; }
  return { a, b, total: a + b };
}
function groupTally(c: StoredCase, world: GameWorld, keyOf: (id: string, world: GameWorld) => string | null, key: string, baseline: Record<string, SideTotals>): SideTotals & { total: number } {
  const base = baseline[key] ?? { a: 0, b: 0 };
  let a = base.a, b = base.b;
  for (const [personId, vote] of Object.entries(c.votes)) if (keyOf(personId, world) === key) { if (vote.choice === "a") a++; else b++; }
  return { a, b, total: a + b };
}

function bestOf(list: StoredArgument[]): StoredArgument | null {
  return list.reduce<StoredArgument | null>((best, arg) => (!best || arg.supporters.size > best.supporters.size ? arg : best), null);
}
function argView(arg: StoredArgument, meId: string, top: boolean): ArgumentView {
  return { id: arg.id, side: arg.side, authorId: arg.authorId, authorName: arg.authorName, text: arg.text, supports: arg.supporters.size, supportedByMe: arg.supporters.has(meId), mine: arg.authorId === meId, top };
}

function toView(c: StoredCase, world: GameWorld, now: number, t: (es: string, va: string) => string): CaseView {
  const meId = world.me.id;
  const status: "open" | "closed" = now >= c.expiresAt ? "closed" : "open";
  const myVoteRecord = c.votes[meId] ?? null;
  // Blind voting, enforced here: nobody sees a tally or an argument for a case
  // they have not voted on, unless it has already closed and become public.
  const revealed = status === "closed" || myVoteRecord !== null;

  const totals = revealed ? tally(c) : { a: 0, b: 0, total: 0 };
  const shareA = totals.total ? totals.a / totals.total : 0;
  const shareB = totals.total ? totals.b / totals.total : 0;

  const degreeKey = personDegree(meId, world), courseKey = personCourse(meId, world);
  const degreeTotals = revealed && degreeKey ? groupTally(c, world, personDegree, degreeKey, c.baselineDegree) : null;
  const courseTotals = revealed && courseKey ? groupTally(c, world, personCourse, courseKey, c.baselineCourse) : null;
  const breakdownDegree: Breakdown | null = degreeTotals && degreeTotals.total >= minAnonymousAudience
    ? { label: world.me.degree, shareA: degreeTotals.a / degreeTotals.total, shareB: degreeTotals.b / degreeTotals.total, total: degreeTotals.total } : null;
  const breakdownCourse: Breakdown | null = courseTotals && courseTotals.total >= minAnonymousAudience
    ? { label: `${world.me.degree} · ${world.me.year}º`, shareA: courseTotals.a / courseTotals.total, shareB: courseTotals.b / courseTotals.total, total: courseTotals.total } : null;

  const sideA = c.arguments.filter(arg => arg.side === "a"), sideB = c.arguments.filter(arg => arg.side === "b");
  const bestA = bestOf(sideA), bestB = bestOf(sideB);
  const argumentsA = revealed ? sideA.map(arg => argView(arg, meId, arg === bestA)) : [];
  const argumentsB = revealed ? sideB.map(arg => argView(arg, meId, arg === bestB)) : [];

  let verdict: Verdict | null = null;
  if (status === "closed") {
    const final = tally(c), switched = switchedTally(c);
    const finalShareA = final.total ? final.a / final.total : 0, finalShareB = final.total ? final.b / final.total : 0;
    const result: Choice | "split" = final.total === 0 || (finalShareA >= 0.45 && finalShareA <= 0.55) ? "split" : finalShareA > finalShareB ? "a" : "b";
    verdict = {
      result, shareA: finalShareA, shareB: finalShareB, total: final.total,
      switched: switched.a + switched.b, switchedToA: switched.a, switchedToB: switched.b,
      bestArgumentA: bestA ? argView(bestA, meId, true) : null, bestArgumentB: bestB ? argView(bestB, meId, true) : null,
    };
  }

  return {
    id: c.id, weekly: c.weekly, mine: c.ownerId === meId, anon: c.anon,
    ownerId: c.anon ? "" : c.ownerId,
    ownerName: c.anon ? anonLabel(c.audience.kind, t) : c.ownerName,
    audienceLabel: audienceLabel(c.audience, world),
    dilemma: c.dilemma, stanceA: c.stanceA, stanceB: c.stanceB,
    createdAt: new Date(c.createdAt).toISOString(), expires: new Date(c.expiresAt).toISOString(),
    minutesLeft: Math.max(0, Math.round((c.expiresAt - now) / 60000)),
    status, myVote: myVoteRecord?.choice ?? null,
    canSwitch: status === "open" && myVoteRecord !== null && !myVoteRecord.switched,
    switched: myVoteRecord?.switched ?? false,
    totalVotes: totals.total, shareA, shareB, breakdownDegree, breakdownCourse,
    argumentsA, argumentsB, verdict,
    canDemoVote: status === "open" && world.people.some(person => !(person.id in c.votes)),
  };
}

function view(ctx: DemoContext<Store>): State {
  const { world, store } = ctx, now = ctx.now(), t = ctx.t, meId = world.me.id;
  const visible = store.cases.filter(c => visibleToMe(c, world));
  const weekly = visible.find(c => c.weekly) ?? null;
  const deck = visible.filter(c => !c.weekly && c.ownerId !== meId).sort((a, b) => b.createdAt - a.createdAt).map(c => toView(c, world, now, t));
  const mineStored = store.cases.filter(c => c.ownerId === meId && !c.withdrawn).sort((a, b) => b.createdAt - a.createdAt);
  const mine = mineStored.map(c => toView(c, world, now, t));
  const openMineCount = mineStored.filter(c => now < c.expiresAt).length;
  return { weekly: weekly ? toView(weekly, world, now, t) : null, deck, mine, openMineCount, canCreate: openMineCount < 2 };
}

function requireCase(store: Store, world: GameWorld, ctx: DemoContext<Store>, input: Record<string, unknown>): StoredCase {
  const id = typeof input.caseId === "string" ? input.caseId : "";
  const found = store.cases.find(c => c.id === id && !c.withdrawn);
  if (!found || !visibleToMe(found, world)) return ctx.fail("Ese caso ya no está disponible.", "Eixe cas ja no hi és disponible.");
  return found;
}
function requireOpen(c: StoredCase, ctx: DemoContext<Store>): void {
  if (ctx.now() >= c.expiresAt) ctx.fail("Este caso ya está cerrado.", "Este cas ja està tancat.");
}
function readChoice(input: Record<string, unknown>, key: string, ctx: DemoContext<Store>): Choice {
  const value = input[key];
  if (value !== "a" && value !== "b") return ctx.fail("Elige una de las dos posturas.", "Tria una de les dues postures.");
  return value;
}
function must<T>(value: T | undefined, ctx: DemoContext<Store>, es: string, va: string): T {
  if (value === undefined) return ctx.fail(es, va);
  return value;
}

const demoArguments: Record<Choice, ReadonlyArray<readonly [string, string]>> = {
  a: [
    ["A mí me pasó algo parecido y creo que fue lo correcto.", "A mi em va passar una cosa pareguda i crec que va ser el correcte."],
    ["Si no se dice a tiempo, luego es peor para todo el grupo.", "Si no es diu a temps, després és pitjor per a tot el grup."],
    ["Cada quien tiene derecho a priorizarse cuando hace falta.", "Cadascú té dret a prioritzar-se quan cal."],
  ],
  b: [
    ["Un compromiso también es parte del trato, no solo lo que te convenga.", "Un compromís també és part del tracte, no només allò que et convinga."],
    ["Avisando con tiempo esto se arregla casi siempre.", "Avisant amb temps això s'arregla quasi sempre."],
    ["Depende de si ya se había hablado antes o fue una sorpresa.", "Depén de si ja s'havia parlat abans o va ser una sorpresa."],
  ],
};

function seed(ctx: DemoContext<Store>): StoredCase[] {
  const world = ctx.world, now = ctx.now();
  const people = world.people;
  const at = (index: number): GamePerson => people[index % Math.max(people.length, 1)] ?? world.me;
  const p0 = at(0), p1 = at(1), p2 = at(2), p3 = at(3), p4 = at(4);
  const groupRef = world.me.groups[0];
  const t = ctx.t;

  const base = (over: Partial<StoredCase> & Pick<StoredCase, "id" | "dilemma">): StoredCase => ({
    ownerId: "team", ownerName: "", anon: false, weekly: false, audience: { kind: "campus" },
    stanceA: t("Sí", "Sí"), stanceB: t("No", "No"), createdAt: now, expiresAt: now + CASE_HOURS * HOUR, withdrawn: false,
    votes: {}, baseline: { a: 0, b: 0 }, baselineDegree: {}, baselineCourse: {}, baselineSwitched: { a: 0, b: 0 }, arguments: [],
    ...over,
  });

  const weekly = base({
    id: "jury-weekly", weekly: true, ownerId: "team", ownerName: t("El equipo de Campus", "L'equip del campus"),
    dilemma: t("¿Se puede cambiar de grupo de prácticas a una semana de la entrega sin dar explicaciones?", "Es pot canviar de grup de pràctiques a una setmana del lliurament sense donar explicacions?"),
    stanceA: t("Se puede", "Es pot"), stanceB: t("No se puede", "No es pot"),
    createdAt: now - 20 * HOUR, expiresAt: now + 52 * HOUR,
    votes: { [p0.id]: { choice: "a", switched: false }, [p2.id]: { choice: "a", switched: false }, [p1.id]: { choice: "b", switched: false } },
    baseline: { a: 132, b: 98 },
    baselineDegree: { [world.me.degree]: { a: 8, b: 5 } },
    baselineCourse: { [`${world.me.degree}::${world.me.year}`]: { a: 5, b: 3 } },
    arguments: [
      { id: "jury-weekly-a1", side: "a", authorId: p0.id, authorName: p0.name, text: t("Si el grupo no funciona, quedarse solo por quedar no ayuda a nadie.", "Si el grup no funciona, quedar-se només per quedar no ajuda a ningú."), createdAt: now - 18 * HOUR, supporters: new Set([p2.id]) },
      { id: "jury-weekly-a2", side: "a", authorId: p2.id, authorName: p2.name, text: t("He cambiado de grupo una vez y fue lo mejor que hice ese cuatrimestre.", "He canviat de grup una vegada i va ser el millor que vaig fer eixe quadrimestre."), createdAt: now - 10 * HOUR, supporters: new Set() },
      { id: "jury-weekly-b1", side: "b", authorId: p1.id, authorName: p1.name, text: t("A una semana de entregar, cambiar perjudica a quien se queda con tu parte.", "A una setmana de lliurar, canviar perjudica qui es queda amb la teua part."), createdAt: now - 15 * HOUR, supporters: new Set([p0.id, p2.id]) },
      { id: "jury-weekly-b2", side: "b", authorId: p1.id, authorName: p1.name, text: t("Si ya sabías que ibas a cambiar, el momento de decirlo era antes.", "Si ja sabies que anaves a canviar, el moment de dir-ho era abans."), createdAt: now - 9 * HOUR, supporters: new Set() },
    ],
  });

  const caseA = base({
    id: "jury-case-a", ownerId: p1.id, ownerName: p1.name,
    dilemma: t("¿Está mal desaparecer de un grupo de trabajo sin avisar si el reparto de tareas te parece injusto?", "Està mal desaparèixer d'un grup de treball sense avisar si el repartiment de tasques et pareix injust?"),
    stanceA: t("Está mal", "Està mal"), stanceB: t("No pasa nada", "No passa res"),
    createdAt: now - 30 * HOUR, expiresAt: now + 42 * HOUR,
    votes: { [p0.id]: { choice: "b", switched: false }, [p2.id]: { choice: "a", switched: false } },
    baseline: { a: 40, b: 58 },
    arguments: [
      { id: "jury-a-a1", side: "a", authorId: p2.id, authorName: p2.name, text: t("Si dejas colgado al resto a última hora, no es solo tu problema.", "Si deixes penjada la resta a última hora, no és només el teu problema."), createdAt: now - 26 * HOUR, supporters: new Set() },
      { id: "jury-a-b1", side: "b", authorId: p0.id, authorName: p0.name, text: t("Si ya intentaste hablarlo y no cambió nada, no eres tú quien lo estropea.", "Si ja vas intentar parlar-ho i no va canviar res, no ets tu qui ho espatlla."), createdAt: now - 20 * HOUR, supporters: new Set([p2.id]) },
    ],
  });

  const caseB = base({
    id: "jury-case-b", ownerId: p4.id, ownerName: p4.name, anon: true,
    dilemma: t("¿Es tacañería dividir la compra del piso exactamente al gramo entre compañeros?", "És garreria dividir la compra del pis exactament al gram entre companys?"),
    stanceA: t("Sí, es de tacaños", "Sí, és de garrepes"), stanceB: t("No, es justo", "No, és just"),
    createdAt: now - 5 * HOUR, expiresAt: now + 67 * HOUR,
    votes: { [p3.id]: { choice: "b", switched: false } },
    baseline: { a: 22, b: 19 },
    arguments: [
      { id: "jury-b-b1", side: "b", authorId: p3.id, authorName: p3.name, text: t("Si todos compráis igual de cosas, dividir por persona es lo más simple.", "Si tots compreu igual de coses, dividir per persona és el més simple."), createdAt: now - 3 * HOUR, supporters: new Set() },
    ],
  });

  const caseC = base({
    id: "jury-case-c", ownerId: p2.id, ownerName: p2.name,
    audience: groupRef ? { kind: "group", ref: groupRef } : { kind: "campus" },
    dilemma: t("¿Deberíamos cambiar el día de la sala de estudio si a la mitad no le viene bien el miércoles?", "Hauríem de canviar el dia de la sala d'estudi si a la meitat no li ve bé el dimecres?"),
    stanceA: t("Sí, cambiamos", "Sí, canviem"), stanceB: t("No, seguimos igual", "No, seguim igual"),
    createdAt: now - 2 * HOUR, expiresAt: now + 70 * HOUR,
    votes: { [p2.id]: { choice: "a", switched: false } },
    arguments: [
      { id: "jury-c-a1", side: "a", authorId: p2.id, authorName: p2.name, text: t("Entre semana ya es difícil cuadrar horarios, mejor moverlo al día que le venga bien a más gente.", "Entre setmana ja és difícil quadrar horaris, millor moure'l al dia que li vinga bé a més gent."), createdAt: now - 2 * HOUR, supporters: new Set() },
    ],
  });

  // A closed case, seeded already past its 72 hours, to show the verdict card
  // from the first second — including a "jurado dividido" result.
  const closed = base({
    id: "jury-case-closed", ownerId: p3.id, ownerName: p3.name, anon: true,
    dilemma: t("¿Está mal dejar de contestar a un grupo de WhatsApp de clase sin avisar?", "Està mal deixar de contestar a un grup de WhatsApp de classe sense avisar?"),
    stanceA: t("Sí, es de mala educación", "Sí, és de mala educació"), stanceB: t("No, es solo desconectar", "No, és només desconnectar"),
    createdAt: now - 100 * HOUR, expiresAt: now - 28 * HOUR,
    votes: {
      [p0.id]: { choice: "b", switched: true }, [p1.id]: { choice: "a", switched: false },
      [p3.id]: { choice: "b", switched: true }, [p4.id]: { choice: "a", switched: false },
    },
    baseline: { a: 210, b: 245 }, baselineSwitched: { a: 34, b: 51 },
    arguments: [
      { id: "jury-closed-a1", side: "a", authorId: p1.id, authorName: p1.name, text: t("Un grupo de trabajo no es solo para ti, es de todos: desconectar sin decir nada incomoda.", "Un grup de treball no és només per a tu, és de tots: desconnectar sense dir res incomoda."), createdAt: now - 90 * HOUR, supporters: new Set([p4.id]) },
      { id: "jury-closed-a2", side: "a", authorId: p4.id, authorName: p4.name, text: t("Si nadie sabe si sigues ahí, luego hay que repetir todo dos veces.", "Si ningú sap si continues ahí, després cal repetir-ho tot dues vegades."), createdAt: now - 80 * HOUR, supporters: new Set() },
      { id: "jury-closed-b1", side: "b", authorId: p0.id, authorName: p0.name, text: t("No contestar un rato no es lo mismo que abandonar a nadie.", "No contestar una estona no és el mateix que abandonar ningú."), createdAt: now - 70 * HOUR, supporters: new Set([p1.id, p3.id]) },
      { id: "jury-closed-b2", side: "b", authorId: p3.id, authorName: p3.name, text: t("A veces uno necesita desconectar del móvil, no del grupo.", "De vegades cal desconnectar del mòbil, no del grup."), createdAt: now - 60 * HOUR, supporters: new Set([p0.id]) },
    ],
  });

  return [weekly, caseA, caseB, caseC, closed];
}

export function play(world: GameWorld, command: string, input: Record<string, unknown>): State {
  const ctx = demoContext<Store>("jury", world, context => ({ cases: seed(context) }));
  const { store } = ctx, meId = world.me.id;

  switch (command) {
    case "read": break;

    case "create": {
      const dilemma = (typeof input.dilemma === "string" ? input.dilemma : "").trim().replace(/\s+/g, " ");
      if (dilemma.length < 10) ctx.fail("Cuenta el dilema con una frase algo más larga.", "Conta el dilema amb una frase una mica més llarga.");
      if (dilemma.length > 220) ctx.fail("Resume el dilema en menos texto.", "Resumeix el dilema en menys text.");

      const stanceA = (typeof input.stanceA === "string" ? input.stanceA : "").trim() || ctx.t("Sí", "Sí");
      const stanceB = (typeof input.stanceB === "string" ? input.stanceB : "").trim() || ctx.t("No", "No");
      if (stanceA.length > 40 || stanceB.length > 40) ctx.fail("Las posturas deben ser cortas.", "Les postures han de ser curtes.");
      if (stanceA.toLocaleLowerCase() === stanceB.toLocaleLowerCase()) ctx.fail("Las dos posturas deben ser distintas.", "Les dues postures han de ser diferents.");

      const kind = input.audienceKind;
      if (typeof kind !== "string" || !allowedAudienceKinds.includes(kind as AudienceKind)) ctx.fail("Elige quién juzga el caso.", "Tria qui jutja el cas.");
      const ref = typeof input.audienceRef === "string" ? input.audienceRef : undefined;
      if (kind === "group" && (!ref || !world.groups.some(group => group.id === ref && group.members.includes(meId)))) {
        ctx.fail("Elige un grupo del que formes parte.", "Tria un grup del qual formes part.");
      }
      const audience: Audience = { kind: kind as AudienceKind, ref: kind === "group" ? ref : undefined };

      const anon = input.anon === true;
      if (anon && audienceReach(audience, world) < minAnonymousAudience) {
        ctx.fail(`Hacen falta ${minAnonymousAudience} personas en ese destinatario para preguntar sin tu nombre.`, `Calen ${minAnonymousAudience} persones en eixe destinatari per a preguntar sense el teu nom.`);
      }

      const openMine = store.cases.filter(c => c.ownerId === meId && !c.withdrawn && ctx.now() < c.expiresAt).length;
      if (openMine >= 2) ctx.fail("Ya tienes dos casos abiertos. Cierra o retira uno antes de abrir otro.", "Ja tens dos casos oberts. Tanca'n o retira'n un abans d'obrir-ne un altre.");

      if (looksSerious(`${dilemma} ${stanceA} ${stanceB}`)) {
        ctx.fail(
          "Esto no es un caso para un jurado: parece algo que necesita ayuda de verdad, no un veredicto. El Servei d'Assessorament Psicològic (SAP) de tu universidad puede ayudarte, y si es urgente puedes llamar al 024 o al 112.",
          "Això no és un cas per a un jurat: pareix una cosa que necessita ajuda de veritat, no un veredicte. El Servei d'Assessorament Psicològic (SAP) de la teua universitat pot ajudar-te, i si és urgent pots telefonar al 024 o al 112.",
        );
      }

      store.cases.unshift({
        id: ctx.id(), ownerId: meId, ownerName: anon ? "" : world.me.name, anon, weekly: false, audience,
        dilemma, stanceA, stanceB, createdAt: ctx.now(), expiresAt: ctx.now() + CASE_HOURS * HOUR, withdrawn: false,
        votes: {}, baseline: { a: 0, b: 0 }, baselineDegree: {}, baselineCourse: {}, baselineSwitched: { a: 0, b: 0 }, arguments: [],
      });
      break;
    }

    case "vote": {
      const c = requireCase(store, world, ctx, input);
      requireOpen(c, ctx);
      if (c.votes[meId]) ctx.fail("Ya has votado este caso.", "Ja has votat este cas.");
      c.votes[meId] = { choice: readChoice(input, "choice", ctx), switched: false };
      break;
    }

    case "switch": {
      const c = requireCase(store, world, ctx, input);
      requireOpen(c, ctx);
      const vote = c.votes[meId];
      if (!vote) ctx.fail("Vota primero para poder cambiar de opinión.", "Vota primer per a poder canviar d'opinió.");
      if (vote.switched) ctx.fail("Ya has cambiado de opinión una vez en este caso.", "Ja has canviat d'opinió una vegada en este cas.");
      const choice = readChoice(input, "choice", ctx);
      if (choice === vote.choice) ctx.fail("Ese ya es tu voto.", "Eixe ja és el teu vot.");
      vote.choice = choice; vote.switched = true;
      break;
    }

    case "argue": {
      const c = requireCase(store, world, ctx, input);
      requireOpen(c, ctx);
      const vote = c.votes[meId];
      if (!vote) ctx.fail("Vota primero para poder argumentar.", "Vota primer per a poder argumentar.");
      const side = readChoice(input, "side", ctx);
      if (side !== vote.choice) ctx.fail("Solo puedes argumentar el lado que has votado.", "Només pots argumentar el costat que has votat.");
      const text = (typeof input.text === "string" ? input.text : "").trim().replace(/\s+/g, " ");
      if (text.length < 3) ctx.fail("Escribe tu argumento.", "Escriu el teu argument.");
      if (text.length > 280) ctx.fail("Sé más breve en tu argumento.", "Sigues més breu en el teu argument.");
      c.arguments.push({ id: ctx.id(), side, authorId: meId, authorName: world.me.name, text, createdAt: ctx.now(), supporters: new Set() });
      break;
    }

    case "support": {
      const c = requireCase(store, world, ctx, input);
      requireOpen(c, ctx);
      if (!c.votes[meId]) ctx.fail("Vota primero para poder apoyar un argumento.", "Vota primer per a poder recolzar un argument.");
      const argument = must(c.arguments.find(candidate => candidate.id === input.argumentId), ctx, "Ese argumento ya no está.", "Eixe argument ja no hi és.");
      if (argument.supporters.has(meId)) argument.supporters.delete(meId); else argument.supporters.add(meId);
      break;
    }

    case "withdraw": {
      const c = requireCase(store, world, ctx, input);
      if (c.ownerId !== meId) ctx.fail("Solo puedes retirar tus propios casos.", "Només pots retirar els teus propis casos.");
      c.withdrawn = true;
      break;
    }

    // Demo-only: there is nobody else in the tab, so these simulate the rest of the jury.
    case "demoVote": {
      const c = requireCase(store, world, ctx, input);
      requireOpen(c, ctx);
      const candidate = must(world.people.find(person => !(person.id in c.votes)), ctx, "Ya han votado todas las personas de ejemplo en este caso.", "Ja han votat totes les persones d'exemple en este cas.");
      const choice = ctx.pick(["a", "b"] as const, `${c.id}:${candidate.id}:vote`);
      c.votes[candidate.id] = { choice, switched: false };
      break;
    }

    case "demoArgue": {
      const c = requireCase(store, world, ctx, input);
      requireOpen(c, ctx);
      const side = readChoice(input, "side", ctx);
      const voters = world.people.filter(person => c.votes[person.id]?.choice === side);
      const pool = voters.length ? voters : world.people;
      if (!pool.length) ctx.fail("No hay nadie de ejemplo para argumentar.", "No hi ha ningú d'exemple per a argumentar.");
      const author = ctx.pick(pool, `${c.id}:${side}:${c.arguments.length}:author`);
      const [es, va] = ctx.pick(demoArguments[side], `${c.id}:${side}:${c.arguments.length}:text`);
      c.arguments.push({ id: ctx.id(), side, authorId: author.id, authorName: author.name, text: ctx.t(es, va), createdAt: ctx.now(), supporters: new Set() });
      break;
    }

    default: ctx.fail("Acción desconocida.", "Acció desconeguda.");
  }

  return view(ctx);
}
