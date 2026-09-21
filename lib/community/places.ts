import type { GameKind } from "@/lib/community/games/types";

// Los sitios de València, en un solo sitio. El mapa de Inicio los pinta, el
// filtro de lugar de Explorar los lista y el formulario de crear plan los ofrece:
// las tres pantallas hablan de los mismos once puntos y `place` es la clave que
// las une. Añadir uno aquí lo añade a las tres (y hay que ampliar el check de
// `universe_plans.place` en la base de datos).
export type PlaceKind = "plans" | "cafe" | "restaurant" | "library" | "nightlife" | "culture" | "outdoors";
export type PlaceSpot = { place: string; lat: number; lng: number; short: readonly [string, string]; kind: PlaceKind; icon: string };

export const spots: readonly PlaceSpot[] = [
  { place: "Benimaclet", lat: 39.4892, lng: -0.3619, short: ["Benimaclet", "Benimaclet"], kind: "plans", icon: "✦" },
  { place: "Torres de Serranos", lat: 39.4794, lng: -0.3751, short: ["Serranos", "Serrans"], kind: "plans", icon: "✦" },
  { place: "La Malvarrosa", lat: 39.4784, lng: -0.3239, short: ["Malvarrosa", "Malva-rosa"], kind: "outdoors", icon: "☀" },
  { place: "L’Albufera · Gola de Pujol", lat: 39.3265, lng: -0.3238, short: ["L’Albufera", "L’Albufera"], kind: "outdoors", icon: "⌁" },
  { place: "Campus de Vera · Ágora", lat: 39.4814, lng: -0.3372, short: ["Vera", "Vera"], kind: "plans", icon: "✦" },
  { place: "Ruzafa · Café", lat: 39.4627, lng: -0.3711, short: ["Ruzafa", "Russafa"], kind: "cafe", icon: "☕" },
  { place: "Mercado de Colón · Restaurantes", lat: 39.4690, lng: -0.3654, short: ["Mercado", "Mercat"], kind: "restaurant", icon: "⌁" },
  { place: "Biblioteca Pública", lat: 39.4705, lng: -0.3768, short: ["Biblioteca", "Biblioteca"], kind: "library", icon: "▤" },
  { place: "Marina · Discotecas", lat: 39.4586, lng: -0.3223, short: ["Marina", "Marina"], kind: "nightlife", icon: "♫" },
  { place: "Cines Lys", lat: 39.4688, lng: -0.3762, short: ["Cines Lys", "Cines Lys"], kind: "culture", icon: "▹" },
  { place: "Jardín del Turia", lat: 39.4708, lng: -0.3658, short: ["Jardín Turia", "Jardí Túria"], kind: "outdoors", icon: "✿" },
];

export const places: readonly string[] = spots.map(spot => spot.place);
export const spotOf = (place: string) => spots.find(spot => spot.place === place);

/* Las mismas palabras para los tipos de sitio en el filtro del mapa de Inicio y en el
   selector «Tipo de sitio» de Explorar. `all`, `active` y `quiet` solo existen en el mapa. */
export type KindFilter = "all" | "active" | "quiet" | PlaceKind;
export const kindLabels: Record<KindFilter, readonly [string, string]> = { all: ["Todos los puntos", "Tots els punts"], active: ["Con planes", "Amb plans"], quiet: ["Lugares libres", "Llocs lliures"], plans: ["Planes", "Plans"], cafe: ["Cafés", "Cafés"], restaurant: ["Restaurantes", "Restaurants"], library: ["Bibliotecas", "Biblioteques"], nightlife: ["Discotecas", "Discoteques"], culture: ["Cultura", "Cultura"], outdoors: ["Aire libre", "Aire lliure"] };
/* Los tipos que se pueden elegir en los dos filtros, en el mismo orden. */
export const placeKinds: readonly PlaceKind[] = ["cafe", "restaurant", "library", "nightlife", "culture", "outdoors"];
export const isPlaceKind = (value: string | null): value is PlaceKind => spots.some(spot => spot.kind === value);

/* El periodo de los planes: las pestañas de Inicio y el selector «Cuándo» de Explorar. */
export type PlanPeriod = "week" | "all" | "mine";
export const planPeriods: readonly PlanPeriod[] = ["week", "all", "mine"];
export const isPlanPeriod = (value: string | null): value is PlanPeriod => planPeriods.includes(value as PlanPeriod);
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/* El juego que encaja con cada tipo de sitio: Inicio y Explorar lo sugieren al elegir un lugar. */
export const gameForKind: Record<PlaceKind, GameKind> = { library: "hangout", cafe: "hangout", restaurant: "hangout", culture: "jury", nightlife: "truth", outdoors: "hangout", plans: "truth" };
