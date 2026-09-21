import type { GameKind, GameWorld } from "./types";
import { play as crush } from "./demo/crush";
import { play as questions } from "./demo/questions";
import { play as debate } from "./demo/debate";
import { play as truth } from "./demo/truth";
import { play as hangout } from "./demo/hangout";
import { play as jury } from "./demo/jury";
import { play as blind } from "./demo/blind";

export type DemoEngine = (world: GameWorld, command: string, input: Record<string, unknown>) => unknown;

/**
 * The demo of each game. Every engine owns its own state shape and its own
 * rules; nothing here is shared with the others beyond the world it reads.
 */
const engines: Record<GameKind, DemoEngine> = { crush, questions, debate, truth, hangout, jury, blind };

export function demoPlay(kind: GameKind, world: GameWorld, command: string, input: Record<string, unknown>) {
  return engines[kind](world, command, input);
}

export { resetDemoGames } from "./demo/store";
