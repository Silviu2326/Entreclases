import { isWarmupGame, normalizeWarmup, type WarmupContent } from "../../../supabase/functions/warmup-writer/warmups";
import type { GameKind } from "./types";

export type { WarmupContent } from "../../../supabase/functions/warmup-writer/warmups";
export const hasWarmupPool = (game: GameKind) => isWarmupGame(game);

// Las aprobadas de un juego, comprobadas otra vez: una fila con otra forma no se pinta.
export function approvedWarmups(game: GameKind, rows: readonly { content?: unknown }[]): WarmupContent[] {
 if (!isWarmupGame(game)) return [];
 return rows.map(row => normalizeWarmup(game, row.content)).filter((item): item is WarmupContent => item !== null);
}

// La misma ronda todo el día y en todas las pantallas: se elige por la fecha de València.
export function warmupOfDay<T>(pool: readonly T[], day: string): T | null {
 if (!pool.length) return null;
 let hash = 0;
 for (const character of day) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
 return pool[hash % pool.length];
}
