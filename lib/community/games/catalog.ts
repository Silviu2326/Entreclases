import { localPath, type Locale } from "../../i18n/routes";
import type { GameKind } from "./types";

// Every experience has its own page. Disable one here: it leaves Explorar,
// its page is no longer generated and its screen is not loaded.
export type GameIntent = "play" | "meet" | "hangout";
export type GameEntry = { id: GameKind; enabled: boolean; intent: GameIntent; effort: readonly [string, string]; slug: readonly [string, string]; title: readonly [string, string]; description: readonly [string, string] };
export const gameCatalog: readonly GameEntry[] = [
  { id: "crush", enabled: true, intent: "meet", effort: ["Tres elecciones por persona", "Tres eleccions per persona"], slug: ["me-lio", "ens-emboliquem"], title: ["¿Me lío?", "Ens emboliquem?"], description: ["Un café, una cita o esa chispa. Solo si es mutuo.", "Un café, una cita o eixa espurna. Només si és mutu."] },
  { id: "questions", enabled: true, intent: "play", effort: ["Una pregunta y una respuesta", "Una pregunta i una resposta"], slug: ["sin-dar-la-cara", "sense-donar-la-cara"], title: ["Sin dar la cara", "Sense donar la cara"], description: ["Preguntas anónimas. Tú eliges qué responder.", "Preguntes anònimes. Tu tries què respondre."] },
  { id: "debate", enabled: true, intent: "play", effort: ["Tres turnos por persona", "Tres torns per persona"], slug: ["defiende-lo-indefendible", "defen-l-indefensable"], title: ["Defiende lo indefendible", "Defén l'indefensable"], description: ["Dos posturas absurdas. Tres turnos para convencer.", "Dues postures absurdes. Tres torns per a convéncer."] },
  { id: "truth", enabled: true, intent: "play", effort: ["Un toque para votar", "Un toc per a votar"], slug: ["dos-verdades-y-una-trola", "dues-veritats-i-una-mentida"], title: ["Dos verdades y una trola", "Dues veritats i una mentida"], description: ["Adivina cuál es. Descubre quién hay detrás.", "Endevina quina és. Descobrix qui hi ha darrere."] },
  { id: "hangout", enabled: true, intent: "hangout", effort: ["Elige hora y sitio", "Tria hora i lloc"], slug: ["hay-hueco", "hi-ha-lloc"], title: ["Hay hueco", "Hi ha lloc"], description: ["Un rato libre y alguien con quien compartirlo.", "Una estona lliure i algú amb qui compartir-la."] },
  { id: "jury", enabled: true, intent: "play", effort: ["Un toque para votar", "Un toc per a votar"], slug: ["jurado-del-campus", "jurat-del-campus"], title: ["El jurado del campus", "El jurat del campus"], description: ["Vota primero. Luego defiende tu veredicto.", "Vota primer. Després defensa el teu veredicte."] },
  { id: "blind", enabled: true, intent: "meet", effort: ["Conversación de 48 h", "Conversa de 48 h"], slug: ["la-cita-empieza-hablando", "la-cita-comenca-parlant"], title: ["La cita empieza hablando", "La cita comença parlant"], description: ["Ronda semanal. 48 horas para conversar.", "Ronda setmanal. 48 hores per a conversar."] },
];
export const enabledGames = gameCatalog.filter(game => game.enabled);
export const languageIndex = (locale: Locale) => locale === "va" ? 1 : 0;
export function gameById(id: string) { return enabledGames.find(game => game.id === id); }
export function gameBySlug(locale: Locale, slug: string) { return enabledGames.find(game => game.slug[languageIndex(locale)] === slug); }
// Static pages: /app/juegos/<slug>/, /demo/juegos/<slug>/, /va/app/jocs/<slug>/ and /va/demo/jocs/<slug>/.
export function gamePath(locale: Locale, demo: boolean, id: GameKind) {
  const game = gameCatalog.find(entry => entry.id === id);
  if (!game) return localPath(locale, demo ? "demo" : "app");
  return `${localPath(locale, demo ? "demo" : "app")}${locale === "va" ? "jocs" : "juegos"}/${game.slug[languageIndex(locale)]}/`;
}
