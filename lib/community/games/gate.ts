import { enabledGames } from "./catalog";
import type { GameKind } from "./types";

// ¿Me lío? y La cita se abren cuando el campus tiene gente suficiente; lo decide
// universe_meet_games_open en el servidor. En la demo están siempre abiertos.
export const meetGames: readonly GameKind[] = enabledGames.filter(game => game.intent === "meet").map(game => game.id);
export const isMeetGame = (id: GameKind) => meetGames.includes(id);

// Los juegos que pueden salir como «juego del día». Mientras no se sepa si los de
// conocer gente están abiertos, no salen: mejor no anunciar algo que está cerrado.
export function playableGames(meetOpen: boolean): GameKind[] {
 return enabledGames.filter(game => meetOpen || game.intent !== "meet").map(game => game.id);
}
