import { demoContext, type DemoContext } from "./store";
import { past, minutesLeft, type Audience, type AudienceKind, type GameRoom, type GameWorld } from "../types";

// ---- Static catalogs. Places come from the campus map the app already has;
// here we only need the handful used every day, plus "otro" for anything else. ----

type What = "cafe" | "comer" | "estudiar" | "pasear" | "deporte" | "otra";
const WHAT: { id: What; es: string; va: string }[] = [
  { id: "cafe", es: "Café", va: "Cafè" },
  { id: "comer", es: "Comer", va: "Menjar" },
  { id: "estudiar", es: "Estudiar", va: "Estudiar" },
  { id: "pasear", es: "Pasear", va: "Passejar" },
  { id: "deporte", es: "Deporte", va: "Esport" },
  { id: "otra", es: "Otra cosa", va: "Una altra cosa" },
];
const WHAT_IDS = WHAT.map(item => item.id);

type PlaceId = "cafeteria" | "biblioteca" | "cesped" | "entrada" | "otro";
const PLACES: { id: PlaceId; es: string; va: string }[] = [
  { id: "cafeteria", es: "Cafetería", va: "Cafeteria" },
  { id: "biblioteca", es: "Biblioteca", va: "Biblioteca" },
  { id: "cesped", es: "El césped", va: "La gespa" },
  { id: "entrada", es: "Entrada principal", va: "Entrada principal" },
  { id: "otro", es: "Otro sitio", va: "Un altre lloc" },
];
const PLACE_IDS = PLACES.map(item => item.id);

const AUDIENCE_KINDS: AudienceKind[] = ["campus", "site", "degree", "course", "group", "contacts", "person"];

// ---- What the store keeps between reads. Times are stored as ISO strings so
// they survive untouched; only fresh math ever goes through ctx.now(). ----

type Seat = { person: string; here: boolean };
type ChatMessage = { id: string; from: string; text: string; at: number; system: boolean };
/** wants: who said yes to repeating. taps: who each person tapped to add as a contact. dismissed: who already answered. */
type RepeatState = { wants: string[]; taps: Record<string, string[]>; dismissed: string[] };

type Hangout = {
  id: string; owner: string; owner_name: string; audience: Audience; anon: boolean; created_at: string;
  /** Reused as the natural end time, the moment this hangout stops mattering. */
  expires: string;
  starts_at: string;
  what: What; whatText: string;
  place: PlaceId; placeText: string;
  note: string;
  capacity: number;
  seats: Seat[];
  messages: ChatMessage[];
  closed: boolean;
  repeat: RepeatState;
};

type Store = { hangouts: Hangout[] };

// ---- What the screen sees ----

export type PlaceOption = { id: string; label: string };
export type WhatOption = { id: string; label: string };

export type HangoutCard = GameRoom & {
  what: string; whatLabel: string; place: string; placeLabel: string;
  starts_at: string; started: boolean; startsInMinutes: number;
  capacity: number; seats: number; spotsLeft: number; full: boolean; going: string[];
};

export type HangoutMessage = { id: string; from: string; mine: boolean; system: boolean; text: string; at: string };
export type HangoutSeat = { id: string; here: boolean; mine: boolean };

export type HangoutDetail = GameRoom & {
  what: string; whatLabel: string; place: string; placeLabel: string; note: string;
  starts_at: string; started: boolean; ended: boolean; closed: boolean;
  /** Milliseconds, for the countdown ring: time spent waiting, and the run's own length. */
  waitTotal: number; runTotal: number;
  capacity: number; spotsLeft: number; full: boolean;
  seats: HangoutSeat[]; messages: HangoutMessage[];
};

export type RepeatOther = { id: string; tapped: boolean; mutual: boolean };
export type RepeatPrompt = { id: string; whatLabel: string; placeLabel: string; others: RepeatOther[]; canGroup: boolean };

export type State = {
  places: PlaceOption[];
  whatOptions: WhatOption[];
  /** Quarter-of-the-day options for "a una hora de hoy", as ISO strings. */
  timeSlots: string[];
  discover: HangoutCard[];
  active: HangoutDetail | null;
  repeat: RepeatPrompt | null;
};

// ---- Small helpers ----

const toIso = (ms: number) => new Date(ms).toISOString();
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

function clampDuration(value: unknown): number {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(120, Math.max(15, number)) : 30;
}
function clampCapacity(value: unknown): number {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(8, Math.max(2, number)) : 4;
}

function whatLabel(ctx: DemoContext<Store>, h: Pick<Hangout, "what" | "whatText">): string {
  if (h.what === "otra") return h.whatText || ctx.t("Otra cosa", "Una altra cosa");
  const item = WHAT.find(entry => entry.id === h.what);
  return item ? ctx.t(item.es, item.va) : h.what;
}
function placeLabel(ctx: DemoContext<Store>, h: Pick<Hangout, "place" | "placeText">): string {
  if (h.place === "otro") return h.placeText || ctx.t("Otro sitio", "Un altre lloc");
  const item = PLACES.find(entry => entry.id === h.place);
  return item ? ctx.t(item.es, item.va) : h.place;
}

/** Whether a room someone else opened reaches me, given the audience they chose. */
function visibleToMe(h: Hangout, world: GameWorld): boolean {
  if (h.owner === world.me.id) return true;
  const owner = world.people.find(person => person.id === h.owner);
  switch (h.audience.kind) {
    case "campus": return true;
    case "site": return !owner || owner.campus === world.me.campus;
    case "degree": return !owner || owner.degree === world.me.degree;
    case "course": return !owner || (owner.degree === world.me.degree && owner.year === world.me.year);
    case "group": return !!h.audience.ref && world.groups.some(group => group.id === h.audience.ref && group.members.includes(world.me.id));
    case "contacts": return !owner || owner.contact;
    case "person": return h.audience.ref === world.me.id;
  }
}

function pushSystem(ctx: DemoContext<Store>, room: Hangout, text: string) {
  room.messages.push({ id: ctx.id(), from: "system", text, at: ctx.now(), system: true });
}
function findRoom(ctx: DemoContext<Store>, rawId: unknown): Hangout {
  const id = String(rawId ?? "");
  const room = ctx.store.hangouts.find(entry => entry.id === id);
  if (!room) ctx.fail("Ese hueco ya no existe.", "Eixe forat ja no existeix.");
  return room;
}
function ownedRoom(ctx: DemoContext<Store>, rawId: unknown): Hangout {
  const room = findRoom(ctx, rawId);
  if (room.owner !== ctx.me.id) ctx.fail("Solo quien abrió el hueco puede hacer esto.", "Només qui ha obert el forat pot fer això.");
  return room;
}
function mySeat(ctx: DemoContext<Store>, room: Hangout) {
  return room.seats.find(seat => seat.person === ctx.me.id);
}
function hasActiveSeat(ctx: DemoContext<Store>) {
  return ctx.store.hangouts.some(room => !past(room.expires) && room.seats.some(seat => seat.person === ctx.me.id));
}

/** ctx here is a parameter (not the local const inside play()), which TS needs to see the
 * "ctx.fail(...) never returns" narrowing carry through to the definite-assignment check below. */
function resolveStartsAt(ctx: DemoContext<Store>, startMode: string, rawStartsAt: unknown): number {
  if (startMode === "now") return ctx.now();
  if (startMode === "15") return ctx.now() + 15 * 60000;
  if (startMode === "30") return ctx.now() + 30 * 60000;
  if (startMode === "at") {
    const parsed = Date.parse(String(rawStartsAt ?? ""));
    if (!Number.isFinite(parsed) || parsed < ctx.now() || !sameDay(parsed, ctx.now())) ctx.fail("Elige una hora de hoy.", "Tria una hora d'avui.");
    return parsed;
  }
  return ctx.fail("Elige cuándo.", "Tria quan.");
}

function buildSlots(ctx: DemoContext<Store>): string[] {
  const now = ctx.now();
  const start = new Date(now);
  start.setMinutes(start.getMinutes() < 30 ? 30 : 60, 0, 0);
  const slots: string[] = [];
  for (let index = 0; slots.length < 6 && index < 8; index++) {
    const candidate = new Date(start.getTime() + index * 30 * 60000);
    if (!sameDay(candidate.getTime(), now)) break;
    slots.push(candidate.toISOString());
  }
  return slots;
}

// ---- Seeding: three hangouts already open, in three different moments. ----

function seed(ctx: DemoContext<Store>): Store {
  const world = ctx.world;
  const people = world.people;
  if (!people.length) return { hangouts: [] };
  const now = ctx.now();
  const emptyRepeat = (): RepeatState => ({ wants: [], taps: {}, dismissed: [] });
  const ownerA = ctx.pick(people, "hangout-owner-a");
  const ownerB = ctx.pick(people, "hangout-owner-b");
  const ownerC = ctx.pick(people, "hangout-owner-c");
  const friendB = ctx.pick(people.filter(person => person.id !== ownerB.id), "hangout-friend-b") ?? ownerB;
  const friendC = ctx.pick(people.filter(person => person.id !== ownerC.id), "hangout-friend-c") ?? ownerC;

  const hangouts: Hangout[] = [];

  // 1) Starts in ten minutes: the plain waiting state, room for more people.
  hangouts.push({
    id: ctx.id(), owner: ownerA.id, owner_name: ownerA.name, audience: { kind: "site" }, anon: false,
    created_at: toIso(now - 5 * 60000), expires: toIso(now + 10 * 60000 + 30 * 60000),
    starts_at: toIso(now + 10 * 60000),
    what: "cafe", whatText: "", place: "cafeteria", placeText: "",
    note: ctx.t("Llevo sudadera verde.", "Duc dessuadora verda."),
    capacity: 4, seats: [{ person: ownerA.id, here: false }],
    messages: [], closed: false, repeat: emptyRepeat(),
  });

  // 2) Already going: someone has arrived, and there is a short chat to read.
  const startedAt = now - 20 * 60000;
  const room2: Hangout = {
    id: ctx.id(), owner: ownerB.id, owner_name: ownerB.name, audience: { kind: "site" }, anon: false,
    created_at: toIso(startedAt - 5 * 60000), expires: toIso(startedAt + 90 * 60000),
    starts_at: toIso(startedAt),
    what: "estudiar", whatText: "", place: "biblioteca", placeText: "",
    note: ctx.t("En la sala silenciosa de arriba.", "A la sala silenciosa de dalt."),
    capacity: 5, seats: [{ person: ownerB.id, here: true }, { person: friendB.id, here: true }],
    messages: [], closed: false, repeat: emptyRepeat(),
  };
  room2.messages.push(
    { id: ctx.id(), from: ownerB.id, text: ctx.t("Voy de camino.", "Vaig cap allà."), at: startedAt + 60000, system: false },
    { id: ctx.id(), from: friendB.id, text: ctx.t("Ya estoy aquí.", "Ja estic ací."), at: startedAt + 5 * 60000, system: false },
  );
  hangouts.push(room2);

  // 3) Almost full: one spot left, ready for "Me apunto" right away.
  hangouts.push({
    id: ctx.id(), owner: ownerC.id, owner_name: ownerC.name, audience: { kind: "site" }, anon: false,
    created_at: toIso(now - 2 * 60000), expires: toIso(now + 20 * 60000 + 45 * 60000),
    starts_at: toIso(now + 20 * 60000),
    what: "pasear", whatText: "", place: "cesped", placeText: "",
    note: "", capacity: 3, seats: [{ person: ownerC.id, here: false }, { person: friendC.id, here: false }],
    messages: [], closed: false, repeat: emptyRepeat(),
  });

  return { hangouts };
}

// ---- Building what the screen receives ----

function card(ctx: DemoContext<Store>, h: Hangout): HangoutCard {
  return {
    id: h.id, owner: h.owner, owner_name: h.owner_name, mine: h.owner === ctx.me.id, audience: h.audience, anon: h.anon,
    created_at: h.created_at, expires: h.expires,
    what: h.what, whatLabel: whatLabel(ctx, h), place: h.place, placeLabel: placeLabel(ctx, h),
    starts_at: h.starts_at, started: past(h.starts_at), startsInMinutes: minutesLeft(h.starts_at),
    capacity: h.capacity, seats: h.seats.length, spotsLeft: Math.max(0, h.capacity - h.seats.length), full: h.seats.length >= h.capacity,
    going: h.seats.map(seat => seat.person),
  };
}

function detail(ctx: DemoContext<Store>, h: Hangout): HangoutDetail {
  return {
    id: h.id, owner: h.owner, owner_name: h.owner_name, mine: h.owner === ctx.me.id, audience: h.audience, anon: h.anon,
    created_at: h.created_at, expires: h.expires,
    what: h.what, whatLabel: whatLabel(ctx, h), place: h.place, placeLabel: placeLabel(ctx, h), note: h.note,
    starts_at: h.starts_at, started: past(h.starts_at), ended: past(h.expires), closed: h.closed,
    waitTotal: Math.max(0, Date.parse(h.starts_at) - Date.parse(h.created_at)),
    runTotal: Math.max(0, Date.parse(h.expires) - Date.parse(h.starts_at)),
    capacity: h.capacity, spotsLeft: Math.max(0, h.capacity - h.seats.length), full: h.seats.length >= h.capacity,
    seats: h.seats.map(entry => ({ id: entry.person, here: entry.here, mine: entry.person === ctx.me.id })),
    messages: h.messages.map(message => ({ id: message.id, from: message.from, mine: message.from === ctx.me.id, system: message.system, text: message.text, at: toIso(message.at) })),
  };
}

function repeatView(ctx: DemoContext<Store>, h: Hangout): RepeatPrompt {
  const myTaps = h.repeat.taps[ctx.me.id] ?? [];
  const others = h.seats.filter(seat => seat.here && seat.person !== ctx.me.id).map(seat => {
    const theirTaps = h.repeat.taps[seat.person] ?? [];
    const tapped = myTaps.includes(seat.person);
    return { id: seat.person, tapped, mutual: tapped && theirTaps.includes(ctx.me.id) };
  });
  const attendees = h.seats.filter(seat => seat.here).map(seat => seat.person);
  const canGroup = attendees.length >= 2 && attendees.every(person => h.repeat.wants.includes(person));
  return { id: h.id, whatLabel: whatLabel(ctx, h), placeLabel: placeLabel(ctx, h), others, canGroup };
}

function view(ctx: DemoContext<Store>): State {
  const world = ctx.world;
  const activeRoom = ctx.store.hangouts.find(room => !past(room.expires) && room.seats.some(seat => seat.person === ctx.me.id));
  const discoverRooms = ctx.store.hangouts
    .filter(room => !room.closed && !past(room.expires) && !room.seats.some(seat => seat.person === ctx.me.id) && visibleToMe(room, world))
    .sort((a, b) => (past(a.starts_at) ? -1 : minutesLeft(a.starts_at)) - (past(b.starts_at) ? -1 : minutesLeft(b.starts_at)));
  const repeatRoom = activeRoom ? undefined : ctx.store.hangouts.find(room => {
    const seat = mySeat(ctx, room);
    return !!seat && seat.here && past(room.expires) && !room.repeat.dismissed.includes(ctx.me.id);
  });

  return {
    places: PLACES.filter(place => place.id !== "otro").map(place => ({ id: place.id, label: ctx.t(place.es, place.va) })),
    whatOptions: WHAT.map(item => ({ id: item.id, label: ctx.t(item.es, item.va) })),
    timeSlots: buildSlots(ctx),
    discover: discoverRooms.map(room => card(ctx, room)),
    active: activeRoom ? detail(ctx, activeRoom) : null,
    repeat: repeatRoom ? repeatView(ctx, repeatRoom) : null,
  };
}

export function play(world: GameWorld, command: string, input: Record<string, unknown>): State {
  const ctx = demoContext<Store>("hangout", world, seed);
  switch (command) {
    case "read": break;

    case "create": {
      if (hasActiveSeat(ctx)) ctx.fail("Ya estás en un hueco. Sal de él antes de abrir otro.", "Ja estàs en un forat. Ix-ne abans d'obrir-ne un altre.");
      const what = String(input.what ?? "") as What;
      if (!WHAT_IDS.includes(what)) ctx.fail("Elige qué vais a hacer.", "Tria què fareu.");
      const whatText = what === "otra" ? String(input.whatText ?? "").trim().slice(0, 40) : "";
      if (what === "otra" && !whatText) ctx.fail("Cuéntanos qué plan es.", "Conta'ns quin pla és.");

      const place = String(input.place ?? "") as PlaceId;
      if (!PLACE_IDS.includes(place)) ctx.fail("Elige dónde quedáis.", "Tria on quedeu.");
      const placeText = place === "otro" ? String(input.placeText ?? "").trim().slice(0, 60) : "";
      if (place === "otro" && !placeText) ctx.fail("Dinos el sitio.", "Digues-nos el lloc.");

      const startMode = String(input.startMode ?? "now");
      const startsAt = resolveStartsAt(ctx, startMode, input.startsAt);

      const duration = clampDuration(input.duration);
      const capacity = clampCapacity(input.capacity);
      const rawAudienceKind = String(input.audienceKind ?? "site");
      const audienceKind: AudienceKind = (AUDIENCE_KINDS as string[]).includes(rawAudienceKind) ? (rawAudienceKind as AudienceKind) : "site";
      const audienceRef = input.audienceRef ? String(input.audienceRef) : undefined;
      if (audienceKind === "person" && !audienceRef) ctx.fail("Elige a quién invitas.", "Tria a qui convides.");
      const note = String(input.note ?? "").trim().slice(0, 140);

      const room: Hangout = {
        id: ctx.id(), owner: ctx.me.id, owner_name: ctx.me.name, audience: { kind: audienceKind, ref: audienceRef }, anon: false,
        created_at: toIso(ctx.now()), expires: toIso(startsAt + duration * 60000),
        starts_at: toIso(startsAt), what, whatText, place, placeText, note, capacity,
        seats: [{ person: ctx.me.id, here: false }], messages: [], closed: false,
        repeat: { wants: [], taps: {}, dismissed: [] },
      };
      ctx.store.hangouts.push(room);
      break;
    }

    case "join": {
      const room = findRoom(ctx, input.id);
      if (hasActiveSeat(ctx)) ctx.fail("Ya estás en un hueco. Sal de él antes de apuntarte a otro.", "Ja estàs en un forat. Ix-ne abans d'apuntar-te a un altre.");
      if (room.closed) ctx.fail("Este hueco está cerrado.", "Este forat està tancat.");
      if (past(room.expires)) ctx.fail("Este hueco ya ha terminado.", "Este forat ja ha acabat.");
      if (room.seats.length >= room.capacity) ctx.fail("Ya está completo.", "Ja està complet.");
      room.seats.push({ person: ctx.me.id, here: false });
      pushSystem(ctx, room, ctx.t(`${ctx.me.name} se ha apuntado.`, `${ctx.me.name} s'ha apuntat.`));
      break;
    }

    case "leave": {
      const room = findRoom(ctx, input.id);
      const seat = mySeat(ctx, room);
      if (!seat) ctx.fail("No estabas en este hueco.", "No estaves en aquest forat.");
      if (room.owner === ctx.me.id && !room.closed) ctx.fail("Quien abre el hueco puede cerrarlo, no irse. Usa «Cerrar».", "Qui obri el forat pot tancar-lo, no anar-se'n. Usa «Tancar».");
      room.seats = room.seats.filter(entry => entry.person !== ctx.me.id);
      if (room.owner !== ctx.me.id) pushSystem(ctx, room, ctx.t(`${ctx.me.name} se ha ido.`, `${ctx.me.name} se n'ha anat.`));
      break;
    }

    case "here": {
      const room = findRoom(ctx, input.id);
      const seat = mySeat(ctx, room);
      if (!seat) ctx.fail("Tienes que apuntarte primero.", "T'has d'apuntar primer.");
      // Non-null assertion: `seat` is guaranteed here, `ctx.fail` above always throws.
      if (!seat!.here) { seat!.here = true; pushSystem(ctx, room, ctx.t(`${ctx.me.name} ya está aquí.`, `${ctx.me.name} ja està ací.`)); }
      break;
    }

    case "message": {
      const room = findRoom(ctx, input.id);
      if (!mySeat(ctx, room)) ctx.fail("Tienes que apuntarte para escribir.", "T'has d'apuntar per a escriure.");
      const text = String(input.text ?? "").trim().slice(0, 300);
      if (!text) ctx.fail("Escribe algo primero.", "Escriu alguna cosa primer.");
      room.messages.push({ id: ctx.id(), from: ctx.me.id, text, at: ctx.now(), system: false });
      break;
    }

    case "close": {
      const room = ownedRoom(ctx, input.id);
      if (past(room.expires)) ctx.fail("Este hueco ya ha terminado.", "Este forat ja ha acabat.");
      room.closed = true;
      pushSystem(ctx, room, ctx.t("Quien abrió el hueco lo ha cerrado.", "Qui ha obert el forat l'ha tancat."));
      break;
    }

    case "extend": {
      const room = ownedRoom(ctx, input.id);
      if (room.closed || past(room.expires)) ctx.fail("Ya no se puede ampliar.", "Ja no es pot ampliar.");
      room.expires = toIso(Date.parse(room.expires) + 30 * 60000);
      pushSystem(ctx, room, ctx.t("Se ha ampliado media hora.", "S'ha ampliat mitja hora."));
      break;
    }

    case "move": {
      const room = ownedRoom(ctx, input.id);
      if (room.closed || past(room.expires)) ctx.fail("Ya no se puede cambiar el sitio.", "Ja no es pot canviar el lloc.");
      const place = String(input.place ?? "") as PlaceId;
      if (!PLACE_IDS.includes(place)) ctx.fail("Elige un sitio.", "Tria un lloc.");
      const placeText = place === "otro" ? String(input.placeText ?? "").trim().slice(0, 60) : "";
      if (place === "otro" && !placeText) ctx.fail("Dinos el nuevo sitio.", "Digues-nos el nou lloc.");
      room.place = place; room.placeText = placeText;
      pushSystem(ctx, room, ctx.t(`Nuevo sitio: ${placeLabel(ctx, room)}.`, `Nou lloc: ${placeLabel(ctx, room)}.`));
      break;
    }

    case "repeatTap": {
      const room = findRoom(ctx, input.id);
      const seat = mySeat(ctx, room);
      if (!seat?.here || !past(room.expires)) ctx.fail("Esto solo vale al terminar el hueco.", "Això només val en acabar el forat.");
      const person = input.person ? String(input.person) : undefined;
      if (person) {
        const mine = room.repeat.taps[ctx.me.id] ?? (room.repeat.taps[ctx.me.id] = []);
        const index = mine.indexOf(person);
        if (index >= 0) mine.splice(index, 1); else mine.push(person);
      }
      if (!room.repeat.wants.includes(ctx.me.id)) room.repeat.wants.push(ctx.me.id);
      break;
    }

    case "repeatSkip": {
      const room = findRoom(ctx, input.id);
      room.repeat.wants = room.repeat.wants.filter(person => person !== ctx.me.id);
      if (!room.repeat.dismissed.includes(ctx.me.id)) room.repeat.dismissed.push(ctx.me.id);
      break;
    }

    case "repeatDone": {
      const room = findRoom(ctx, input.id);
      if (!room.repeat.dismissed.includes(ctx.me.id)) room.repeat.dismissed.push(ctx.me.id);
      break;
    }

    // Demo-only: there is nobody else in the tab, so these simulate the other side.
    case "demoJoin": {
      const room = findRoom(ctx, input.id);
      if (room.seats.length >= room.capacity) ctx.fail("Ya está completo.", "Ja està complet.");
      const candidates = ctx.world.people.filter(person => !room.seats.some(seat => seat.person === person.id));
      if (!candidates.length) ctx.fail("No hay nadie más para simular.", "No hi ha ningú més per a simular.");
      const person = ctx.pick(candidates, `${room.id}:join:${room.seats.length}`);
      room.seats.push({ person: person.id, here: false });
      pushSystem(ctx, room, ctx.t(`${person.name} se ha apuntado. (Demo)`, `${person.name} s'ha apuntat. (Demo)`));
      break;
    }

    case "demoMessage": {
      const room = findRoom(ctx, input.id);
      const others = room.seats.map(seat => seat.person).filter(person => person !== ctx.me.id);
      if (!others.length) ctx.fail("Nadie más está apuntado todavía.", "Encara no s'ha apuntat ningú més.");
      const personId = ctx.pick(others, `${room.id}:speaker:${room.messages.length}`);
      const lines = [ctx.t("Voy de camino.", "Vaig cap allà."), ctx.t("Ya estoy aquí.", "Ja estic ací."), ctx.t("Llego cinco minutos tarde.", "Arribe cinc minuts tard.")];
      const text = ctx.pick(lines, `${room.id}:line:${room.messages.length}`);
      if (text === lines[1]) { const seat = room.seats.find(entry => entry.person === personId); if (seat) seat.here = true; }
      room.messages.push({ id: ctx.id(), from: personId, text, at: ctx.now(), system: false });
      break;
    }

    case "demoFinish": {
      const room = findRoom(ctx, input.id);
      const startsAt = Math.min(Date.parse(room.starts_at), ctx.now() - 60000);
      room.starts_at = toIso(startsAt);
      room.expires = toIso(ctx.now() - 1000);
      for (const seat of room.seats) seat.here = true;
      const others = room.seats.map(seat => seat.person).filter(person => person !== ctx.me.id);
      for (const person of others) {
        if (!room.repeat.wants.includes(person)) room.repeat.wants.push(person);
        room.repeat.taps[person] = others.filter(other => other !== person).concat(ctx.me.id);
      }
      pushSystem(ctx, room, ctx.t("Hueco terminado. (Demo)", "Forat acabat. (Demo)"));
      break;
    }

    default: ctx.fail("Acción desconocida.", "Acció desconeguda.");
  }
  return view(ctx);
}
