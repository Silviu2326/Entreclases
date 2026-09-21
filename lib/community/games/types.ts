import type { Locale } from "@/lib/i18n/routes";

export type GameKind = "crush" | "questions" | "debate" | "truth" | "hangout" | "jury" | "blind";
export const gameKinds: GameKind[] = ["crush", "questions", "debate", "truth", "hangout", "jury", "blind"];

/** Who can see and take part in something created inside a game. See docs/juegos/00-conceptos-comunes.md. */
export type AudienceKind = "campus" | "site" | "degree" | "course" | "group" | "contacts" | "person";
export type Audience = { kind: AudienceKind; ref?: string };
export const everyone: Audience = { kind: "campus" };
/** Below this many people an audience cannot carry anonymous content: the author would be guessable. */
export const minAnonymousAudience = 8;

/** Fields every room shares, whatever the game. Each game adds its own on top. */
export type GameRoom = {
  id: string;
  owner: string;
  /** Empty while the author stays hidden. */
  owner_name: string;
  mine: boolean;
  audience: Audience;
  anon: boolean;
  created_at: string;
  expires: string | null;
};

/** A person as the games see them: enough to resolve audiences and draw a card. */
export type GamePerson = {
  id: string;
  name: string;
  campus: string;
  degree: string;
  year: number;
  bio: string;
  interests: string[];
  groups: string[];
  contact: boolean;
};

export type GameGroup = { id: string; name: string; members: string[] };

/** What a game can read about the world it runs in, in the app and in the demo alike. */
export type GameWorld = {
  locale: Locale;
  t: (es: string, va: string) => string;
  me: GamePerson;
  people: GamePerson[];
  groups: GameGroup[];
};

/** Thrown by the demo engines and shown to the person as written. */
export class GameError extends Error {}
export const fail = (world: GameWorld, es: string, va: string): never => { throw new GameError(world.t(es, va)); };

export const nowIso = () => new Date().toISOString();
export const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60000).toISOString();
export const inHours = (hours: number) => inMinutes(hours * 60);
export const past = (value: string | null) => value !== null && Date.parse(value) <= Date.now();
export const minutesLeft = (value: string | null) => value === null ? 0 : Math.max(0, Math.round((Date.parse(value) - Date.now()) / 60000));
