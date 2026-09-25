// «¿Dónde estudio?»: bibliotecas y salas de estudio de València, con su horario
// habitual y sus características. Los datos se han comprobado uno a uno en la
// web oficial de cada biblioteca (ver `hoursSource` y `verifiedAt` en cada una);
// donde la web no daba un horario claro se ha dejado `hours: null` a propósito,
// en vez de inventarlo. Los horarios cambian en exámenes y festivos: la web
// oficial (`url`) manda siempre sobre lo que hay aquí.

export type Network = "UV" | "UPV" | "UCV" | "CEU" | "Pública";
export type Feature = "group_rooms" | "exam_24h" | "reservable" | "silent" | "wifi";

/** Franjas abiertas un día, como pares [apertura, cierre] en "HH:MM"; `null` si ese día está cerrada. */
export type DayHours = readonly (readonly [string, string])[] | null;
export type WeekHours = {
  mon: DayHours; tue: DayHours; wed: DayHours; thu: DayHours; fri: DayHours; sat: DayHours; sun: DayHours;
};

export type Library = {
  id: string;
  name: string;
  network: Network;
  campus: string;
  address: string;
  lat: number;
  lng: number;
  /** Página oficial de la biblioteca o de sus horarios. */
  url: string;
  hours: WeekHours | null;
  /** URL exacta de donde se ha sacado el horario. `null` si `hours` es `null`. */
  hoursSource: string | null;
  /** Fecha en que se comprobaron estos datos, "YYYY-MM-DD". */
  verifiedAt: string | null;
  features: readonly Feature[];
  note?: readonly [string, string];
};

const VERIFIED = "2026-09-24";

export const libraries: readonly Library[] = [
  {
    id: "uv-humanitats-joan-regla",
    name: "Biblioteca d'Humanitats \"Joan Reglà\"",
    network: "UV",
    campus: "Blasco Ibáñez",
    address: "Carrer d'Arts Gràfiques, 13, 46010 València",
    lat: 39.4788, lng: -0.3573,
    url: "https://www.uv.es/uvweb/libraries-documentation-service/en/biblioteca-d-humanitats-joan-regla/information-opening-hours/timetable-1286453207587.html",
    hours: {
      mon: [["08:15", "21:00"]], tue: [["08:15", "21:00"]], wed: [["08:15", "21:00"]],
      thu: [["08:15", "21:00"]], fri: [["08:15", "21:00"]], sat: [["09:00", "14:00"]], sun: null,
    },
    hoursSource: "https://www.uv.es/uvweb/libraries-documentation-service/en/biblioteca-d-humanitats-joan-regla/information-opening-hours/timetable-1286453207587.html",
    verifiedAt: VERIFIED,
    features: ["group_rooms", "reservable", "exam_24h", "wifi"],
    note: ["En época de exámenes amplía a 24 horas (solo consulta en sala, sin préstamo). Confirma las fechas cada curso.", "En època d'exàmens amplia a 24 hores (només consulta en sala, sense préstec). Confirma les dates cada curs."],
  },
  {
    id: "uv-ccss-gregori-maians",
    name: "Biblioteca de Ciències Socials \"Gregori Maians\"",
    network: "UV",
    campus: "Tarongers",
    address: "Av. dels Tarongers, 25, 46021 València",
    lat: 39.4760, lng: -0.3500,
    url: "https://www.uv.es/uvweb/libraries-documentation-service/en/-gregori-maians-library-social-sciences/information-opening-hours/opening-hours-1285872230993.html",
    hours: {
      mon: [["08:30", "20:45"]], tue: [["08:30", "20:45"]], wed: [["08:30", "20:45"]],
      thu: [["08:30", "20:45"]], fri: [["08:30", "20:45"]], sat: [["09:00", "13:45"]], sun: null,
    },
    hoursSource: "https://www.uv.es/uvweb/libraries-documentation-service/en/-gregori-maians-library-social-sciences/information-opening-hours/opening-hours-1285872230993.html",
    verifiedAt: VERIFIED,
    features: ["group_rooms", "reservable", "exam_24h", "wifi"],
    note: ["En época de exámenes, la planta -1 amplía a 24 horas (solo consulta en sala). Confirma las fechas cada curso.", "En època d'exàmens, la planta -1 amplia a 24 hores (només consulta en sala). Confirma les dates cada curs."],
  },
  {
    id: "uv-educacio-maria-moliner",
    name: "Biblioteca d'Educació \"María Moliner\"",
    network: "UV",
    campus: "Tarongers",
    address: "Carrer de Ramon Llull, s/n, 46010 València",
    lat: 39.4762, lng: -0.3512,
    url: "https://www.uv.es/uvweb/libraries-documentation-service/en/biblioteca-d-educacio-maria-moliner/information-opening-hours/timetable-1286432587913.html",
    hours: {
      mon: [["08:30", "21:00"]], tue: [["08:30", "21:00"]], wed: [["08:30", "21:00"]],
      thu: [["08:30", "21:00"]], fri: [["08:30", "21:00"]], sat: null, sun: null,
    },
    hoursSource: "https://www.uv.es/uvweb/libraries-documentation-service/en/biblioteca-d-educacio-maria-moliner/information-opening-hours/timetable-1286432587913.html",
    verifiedAt: VERIFIED,
    features: ["group_rooms", "reservable", "wifi"],
  },
  {
    id: "uv-ciencies-eduard-bosca",
    name: "Biblioteca de Ciències \"Eduard Boscà\"",
    network: "UV",
    campus: "Burjassot-Paterna",
    address: "Carrer del Doctor Moliner, 50, 46100 Burjassot",
    lat: 39.5075, lng: -0.4167,
    url: "https://www.uv.es/uvweb/servicio-bibliotecas-documentacion/es/biblioteca-ciencies-eduard-bosca/informacion-horarios/horario-1286453201550.html",
    hours: {
      mon: [["08:15", "20:45"]], tue: [["08:15", "20:45"]], wed: [["08:15", "20:45"]],
      thu: [["08:15", "20:45"]], fri: [["08:15", "20:45"]], sat: [["09:15", "14:00"]], sun: null,
    },
    hoursSource: "https://www.uv.es/uvweb/servicio-bibliotecas-documentacion/es/biblioteca-ciencies-eduard-bosca/informacion-horarios/horario-1286453201550.html",
    verifiedAt: VERIFIED,
    features: ["group_rooms", "reservable", "exam_24h", "wifi"],
    note: ["En época de exámenes amplía a 24 horas (solo consulta en sala, sin préstamo). Confirma las fechas cada curso.", "En època d'exàmens amplia a 24 hores (només consulta en sala, sense préstec). Confirma les dates cada curs."],
  },
  {
    id: "upv-central-vera",
    name: "Biblioteca Central UPV",
    network: "UPV",
    campus: "Vera",
    address: "Camí de Vera, s/n, 46022 València",
    lat: 39.4814, lng: -0.3372,
    url: "https://www.upv.es/contenidos/BIBCENT/infoweb/bibcent/info/740364normalc.html",
    hours: {
      mon: [["08:00", "21:00"]], tue: [["08:00", "21:00"]], wed: [["08:00", "21:00"]],
      thu: [["08:00", "21:00"]], fri: [["08:00", "21:00"]], sat: [["08:30", "20:45"]], sun: [["08:30", "20:45"]],
    },
    hoursSource: "https://www.upv.es/contenidos/BIBCENT/infoweb/bibcent/info/740364normalc.html",
    verifiedAt: VERIFIED,
    features: ["group_rooms", "reservable", "wifi"],
    note: ["Fines de semana, acceso solo con carné UPV.", "Caps de setmana, accés només amb carnet UPV."],
  },
  {
    id: "ucv-san-carlos-borromeo",
    name: "Biblioteca UCV · Sede San Carlos Borromeo",
    network: "UCV",
    campus: "Centro",
    address: "Carrer de Quevedo, 2, 46001 València",
    lat: 39.4658, lng: -0.3785,
    url: "https://www.ucv.es/alumnos/biblioteca/la-biblioteca-de-la-ucv/sedes-y-horarios",
    hours: {
      mon: [["08:30", "20:00"]], tue: [["08:30", "20:00"]], wed: [["08:30", "20:00"]],
      thu: [["08:30", "20:00"]], fri: [["08:30", "20:00"]], sat: null, sun: null,
    },
    hoursSource: "https://www.ucv.es/alumnos/biblioteca/la-biblioteca-de-la-ucv/sedes-y-horarios",
    verifiedAt: VERIFIED,
    features: ["wifi"],
  },
  {
    id: "ucv-santa-ursula",
    name: "Biblioteca UCV · Sede Santa Úrsula",
    network: "UCV",
    campus: "Centro",
    address: "Carrer de Guillem de Castro, 94, 46003 València",
    lat: 39.4739, lng: -0.3797,
    url: "https://www.ucv.es/alumnos/biblioteca/la-biblioteca-de-la-ucv/sedes-y-horarios",
    hours: {
      mon: [["09:00", "15:00"], ["16:00", "20:00"]], tue: [["09:00", "15:00"], ["16:00", "20:00"]],
      wed: [["09:00", "15:00"], ["16:00", "20:00"]], thu: [["09:00", "15:00"], ["16:00", "20:00"]],
      fri: [["09:00", "15:00"], ["16:00", "20:00"]], sat: null, sun: null,
    },
    hoursSource: "https://www.ucv.es/alumnos/biblioteca/la-biblioteca-de-la-ucv/sedes-y-horarios",
    verifiedAt: VERIFIED,
    features: ["wifi"],
  },
  {
    id: "ucv-san-juan-de-la-ribera",
    name: "Biblioteca UCV · Sede San Juan de la Ribera",
    network: "UCV",
    campus: "Burjassot-Paterna",
    address: "Carrer de Joaquín Navarro, 37, 46100 Burjassot",
    lat: 39.5068, lng: -0.4128,
    url: "https://www.ucv.es/alumnos/biblioteca/la-biblioteca-de-la-ucv/sedes-y-horarios",
    hours: {
      mon: [["08:30", "19:30"]], tue: [["08:30", "19:30"]], wed: [["08:30", "19:30"]],
      thu: [["08:30", "19:30"]], fri: [["08:30", "19:30"]], sat: null, sun: null,
    },
    hoursSource: "https://www.ucv.es/alumnos/biblioteca/la-biblioteca-de-la-ucv/sedes-y-horarios",
    verifiedAt: VERIFIED,
    features: ["wifi"],
  },
  {
    id: "ceu-crai-alfara",
    name: "Biblioteca-CRAI CEU Cardenal Herrera",
    network: "CEU",
    campus: "Alfara del Patriarca",
    address: "Carrer de Lluís Vives, 2, 46115 Alfara del Patriarca",
    lat: 39.5461, lng: -0.4038,
    url: "https://www.uchceu.es/servicios/biblioteca-crai",
    hours: {
      mon: [["07:45", "21:15"]], tue: [["07:45", "21:15"]], wed: [["07:45", "21:15"]],
      thu: [["07:45", "21:15"]], fri: [["07:45", "21:15"]], sat: null, sun: null,
    },
    hoursSource: "https://www.uchceu.es/servicios/biblioteca-crai",
    verifiedAt: VERIFIED,
    features: ["wifi"],
  },
  {
    id: "publica-valencia-pilar-faus",
    name: "Biblioteca Pública de València \"Pilar Faus\"",
    network: "Pública",
    campus: "Centro",
    address: "Carrer de l'Hospital, 13, 46001 València",
    lat: 39.4705, lng: -0.3768,
    url: "https://www.bibliotecaspublicas.es/valencia/conocenos/localizacion-horarios.html",
    hours: {
      mon: [["09:00", "20:30"]], tue: [["09:00", "20:30"]], wed: [["09:00", "20:30"]],
      thu: [["09:00", "20:30"]], fri: [["09:00", "20:30"]], sat: null, sun: null,
    },
    hoursSource: "https://www.bibliotecaspublicas.es/valencia/conocenos/localizacion-horarios.html",
    verifiedAt: VERIFIED,
    features: ["silent", "wifi"],
  },
  {
    id: "municipal-russafa-nova-al-russafi",
    name: "Biblioteca Municipal de Russafa \"Nova Al-Russafí\"",
    network: "Pública",
    campus: "Russafa",
    address: "Carrer del Poeta Al-Russafí, 2-4, 46006 València",
    lat: 39.4613, lng: -0.3738,
    url: "https://www.valencia.es/es/-/infociudad-biblioteca-municipal-nova-al-russafi-l-eixample",
    hours: {
      mon: [["08:45", "14:45"], ["16:15", "19:45"]], tue: [["08:45", "14:45"], ["16:15", "19:45"]],
      wed: [["08:45", "14:45"], ["16:15", "19:45"]], thu: [["08:45", "14:45"], ["16:15", "19:45"]],
      fri: [["08:45", "14:45"], ["16:15", "19:45"]], sat: null, sun: null,
    },
    hoursSource: "https://directoriobibliotecas.mcu.es/dimbe.cmd?apartado=buscador&accion=detalle_biblioteca&ps=8243&filtro=3",
    verifiedAt: VERIFIED,
    features: ["silent", "wifi"],
  },
  {
    id: "biblioteca-valenciana-sant-miquel",
    name: "Biblioteca Valenciana \"Nicolau Primitiu\"",
    network: "Pública",
    campus: "Marxalenes",
    address: "Av. de la Constitució, 284 (Monestir de Sant Miquel dels Reis), 46019 València",
    lat: 39.4914, lng: -0.3820,
    url: "https://bv.gva.es/es/horari",
    hours: {
      mon: [["09:00", "20:00"]], tue: [["09:00", "20:00"]], wed: [["09:00", "20:00"]],
      thu: [["09:00", "20:00"]], fri: [["09:00", "20:00"]], sat: [["09:00", "13:30"]], sun: null,
    },
    hoursSource: "https://bv.gva.es/es/horari",
    verifiedAt: VERIFIED,
    features: ["silent", "wifi"],
  },
];

// ---- Pure logic ----

export type LatLng = { lat: number; lng: number };
export type OpenStatus = { open: boolean; until?: string; opensAt?: string; unknown: boolean };

const DAY_ORDER: (keyof WeekHours)[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const WEEKDAY_TO_KEY: Record<string, keyof WeekHours> = { Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat", Sun: "sun" };

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Weekday key and minutes-since-midnight for `date`, read in the Europe/Madrid time zone. */
function madridNow(date: Date): { day: keyof WeekHours; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  const day = WEEKDAY_TO_KEY[get("weekday")] ?? "mon";
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0; // Some ICU builds print midnight as "24:00" even with hour12:false.
  return { day, minutes: hour * 60 + Number(get("minute")) };
}

/** Whether `library` is open at `date` (Europe/Madrid), and when it opens or closes next. */
export function isOpenNow(library: Library, date: Date = new Date()): OpenStatus {
  if (!library.hours) return { open: false, unknown: true };
  const { day, minutes } = madridNow(date);
  const today = library.hours[day];
  if (today) {
    for (const [open, close] of today) {
      if (minutes >= toMinutes(open) && minutes < toMinutes(close)) return { open: true, until: close, unknown: false };
    }
    const later = today.find(([open]) => toMinutes(open) > minutes);
    if (later) return { open: false, opensAt: later[0], unknown: false };
  }
  const startIndex = DAY_ORDER.indexOf(day);
  for (let step = 1; step <= 7; step++) {
    const nextDay = library.hours[DAY_ORDER[(startIndex + step) % 7]];
    if (nextDay && nextDay.length > 0) return { open: false, opensAt: nextDay[0][0], unknown: false };
  }
  return { open: false, unknown: false };
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two points, in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Open libraries first, then (with a position) the nearest, then alphabetically. */
export function sortLibraries(list: readonly Library[], opts: { now: Date; position?: LatLng }): Library[] {
  const ranked = list.map(library => ({
    library,
    open: isOpenNow(library, opts.now).open,
    distance: opts.position ? distanceKm(opts.position, { lat: library.lat, lng: library.lng }) : null,
  }));
  ranked.sort((a, b) => {
    if (a.open !== b.open) return a.open ? -1 : 1;
    if (a.distance !== null && b.distance !== null && a.distance !== b.distance) return a.distance - b.distance;
    return a.library.name.localeCompare(b.library.name, "es");
  });
  return ranked.map(entry => entry.library);
}

export type LibraryFilters = { network?: Network; campus?: string; groupRooms?: boolean };

export function filterLibraries(list: readonly Library[], filters: LibraryFilters): Library[] {
  return list.filter(library => {
    if (filters.network && library.network !== filters.network) return false;
    if (filters.campus && library.campus !== filters.campus) return false;
    if (filters.groupRooms && !library.features.includes("group_rooms")) return false;
    return true;
  });
}

/** The distinct campus values present, in the order they first appear. */
export function campusList(list: readonly Library[]): string[] {
  const seen: string[] = [];
  for (const library of list) if (!seen.includes(library.campus)) seen.push(library.campus);
  return seen;
}
