import { GameError, type GameKind, type GamePerson, type GameWorld } from "../types";

/**
 * What a demo engine works with. The store is a mutable object that lives for
 * as long as the tab does, so a game keeps its state while you move around the
 * app and starts clean on reload. Nothing here reaches a server or a person.
 */
export type DemoContext<TStore> = {
  world: GameWorld;
  store: TStore;
  t: (es: string, va: string) => string;
  me: GamePerson;
  id: () => string;
  now: () => number;
  /** A stable pick from a list, so example content does not jump on every refresh. */
  pick: <T>(list: readonly T[], seed: string) => T;
  fail: (es: string, va: string) => never;
};

const stores = new Map<string, unknown>();
let counter = 0;
const nextId = () => `demo-${Date.now().toString(36)}-${(counter++).toString(36)}`;

function seededIndex(seed: string, length: number) {
  let hash = 0;
  for (let index = 0; index < seed.length; index++) hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  return length ? hash % length : 0;
}

export function demoContext<TStore>(kind: GameKind, world: GameWorld, create: (context: DemoContext<TStore>) => TStore): DemoContext<TStore> {
  const key = `${world.me.id}:${world.locale}:${kind}`;
  const context: DemoContext<TStore> = {
    world, store: undefined as unknown as TStore, t: world.t, me: world.me,
    id: nextId, now: Date.now,
    pick: (list, seed) => list[seededIndex(seed, list.length)],
    fail: (es, va) => { throw new GameError(world.t(es, va)); },
  };
  if (!stores.has(key)) stores.set(key, create(context));
  context.store = stores.get(key) as TStore;
  return context;
}

/** Used by the tests and by a full reload of the demo. */
export function resetDemoGames() { stores.clear(); }
