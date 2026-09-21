import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { enabledGames } from "@/lib/community/games/catalog";
import type { GameKind } from "@/lib/community/games/types";

// Texts, slugs and the enabled switch live in lib/community/games/catalog.ts.
// This file only links each experience with the screen that implements it.
const screens: Record<GameKind, ComponentType> = {
  crush: dynamic(() => import("./me-lio")),
  questions: dynamic(() => import("./preguntas-anonimas")),
  debate: dynamic(() => import("./defiende-lo-indefendible")),
  truth: dynamic(() => import("./dos-verdades")),
  hangout: dynamic(() => import("./hay-hueco")),
  jury: dynamic(() => import("./jurado-del-campus")),
  blind: dynamic(() => import("./cita-a-ciegas")),
};
export const games = enabledGames.map(game => ({ ...game, component: screens[game.id] }));
