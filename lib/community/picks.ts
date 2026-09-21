// Quick picks are identity, not debate: one tap, no votes and no comments, so
// they never overlap with the "Jurado del campus" game. Each option keeps both
// locales in the entry, like lib/community/games/catalog.ts.
import type { Locale } from "../i18n/routes";

export type PickOption = { slug: string; emoji: string; label: readonly [string, string] };
export type PickPair = { id: string; title: readonly [string, string]; a: PickOption; b: PickOption };

export const pickPairs: readonly PickPair[] = [
  { id: "dia", title: ["El día", "El dia"], a: { slug: "madrugar", emoji: "🌅", label: ["Madrugar", "Matinar"] }, b: { slug: "trasnochar", emoji: "🌙", label: ["Trasnochar", "Fer nit"] } },
  { id: "estudio", title: ["Para estudiar", "Per a estudiar"], a: { slug: "biblioteca", emoji: "📚", label: ["Biblioteca", "Biblioteca"] }, b: { slug: "cocina", emoji: "🏠", label: ["La cocina de casa", "La cuina de casa"] } },
  { id: "beber", title: ["Para beber", "Per a beure"], a: { slug: "horchata", emoji: "🥛", label: ["Horchata", "Orxata"] }, b: { slug: "cafe", emoji: "☕", label: ["Café", "Café"] } },
  { id: "apuntes", title: ["Los apuntes", "Els apunts"], a: { slug: "mano", emoji: "✍️", label: ["A mano", "A mà"] }, b: { slug: "tablet", emoji: "📱", label: ["En la tablet", "A la tauleta"] } },
  { id: "campus", title: ["Llegar al campus", "Arribar al campus"], a: { slug: "bus", emoji: "🚌", label: ["Bus", "Bus"] }, b: { slug: "bici", emoji: "🚲", label: ["Bici", "Bici"] } },
  { id: "finde", title: ["El finde", "El cap de setmana"], a: { slug: "playa", emoji: "🏖️", label: ["Playa", "Platja"] }, b: { slug: "montana", emoji: "⛰️", label: ["Montaña", "Muntanya"] } },
  { id: "examen", title: ["El examen", "L’examen"], a: { slug: "ultima-noche", emoji: "😰", label: ["La noche antes", "La nit abans"] }, b: { slug: "al-dia", emoji: "📅", label: ["Llevarlo al día", "Portar-ho al dia"] } },
  { id: "serie", title: ["Ver una serie", "Vore una sèrie"], a: { slug: "maraton", emoji: "🍿", label: ["Maratón de golpe", "Marató de colp"] }, b: { slug: "capitulo", emoji: "🐢", label: ["Un capítulo al día", "Un capítol al dia"] } },
  { id: "musica", title: ["La música", "La música"], a: { slug: "auriculares", emoji: "🎧", label: ["Auriculares siempre", "Auriculars sempre"] }, b: { slug: "altavoz", emoji: "🔊", label: ["Altavoz para todos", "Altaveu per a tots"] } },
  { id: "noche", title: ["Un viernes", "Un divendres"], a: { slug: "salir", emoji: "🕺", label: ["Salir hasta tarde", "Eixir fins tard"] }, b: { slug: "sofa", emoji: "🛋️", label: ["Sofá y manta", "Sofà i manta"] } },
  { id: "comer", title: ["Comer entre clases", "Menjar entre classes"], a: { slug: "menu", emoji: "🍽️", label: ["Menú del día", "Menú del dia"] }, b: { slug: "tupper", emoji: "🥡", label: ["Tupper de casa", "Carmanyola de casa"] } },
  { id: "grupo", title: ["El grupo de clase", "El grup de classe"], a: { slug: "contesto", emoji: "⚡", label: ["Contesto al momento", "Conteste al moment"] }, b: { slug: "silenciado", emoji: "🔕", label: ["Silenciado desde enero", "Silenciat des de gener"] } },
];

export const pickSlugs: readonly string[] = pickPairs.flatMap(pair => [pair.a.slug, pair.b.slug]);
export const pickOptions: Record<string, { pair: PickPair; option: PickOption }> = Object.fromEntries(
  pickPairs.flatMap(pair => [[pair.a.slug, { pair, option: pair.a }], [pair.b.slug, { pair, option: pair.b }]] as const),
);
export const localePick = (values: readonly [string, string], locale: Locale) => values[locale === "va" ? 1 : 0];
export const chosenIn = (picks: string[], pair: PickPair) => picks.includes(pair.a.slug) ? pair.a : picks.includes(pair.b.slug) ? pair.b : undefined;
