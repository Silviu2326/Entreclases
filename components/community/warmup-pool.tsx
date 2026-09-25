"use client";
import { useEffect, useState } from "react";
import { useCommunity } from "./context";
import { madridDay } from "@/lib/community/games/openings";
import { hasWarmupPool, warmupOfDay, type WarmupContent } from "@/lib/community/games/warmups";
import type { GameKind } from "@/lib/community/games/types";

// Una lectura por juego y visita: Inicio y Explorar enseñan la misma ronda.
const pools = new Map<GameKind, WarmupContent[]>();

/** La ronda aprobada de hoy para ese juego, o null para usar la de siempre. */
export function useWarmupOfDay(game: GameKind): WarmupContent | null {
 const { repo } = useCommunity();
 const [pool, setPool] = useState<WarmupContent[] | undefined>(pools.get(game));
 useEffect(() => {
  if (!hasWarmupPool(game) || pools.has(game)) return;
  let active = true;
  repo.warmups(game).then(found => { pools.set(game, found); if (active) setPool(found); }, () => undefined);
  return () => { active = false; };
 }, [game, repo]);
 return warmupOfDay(pool ?? pools.get(game) ?? [], madridDay());
}
