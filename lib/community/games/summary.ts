import { enabledGames } from "./catalog";
import { demoPlay } from "./demo";
import type { GameKind, GameWorld } from "./types";
import type { State as CrushState } from "./demo/crush";
import type { State as QuestionsState } from "./demo/questions";
import type { State as DebateState } from "./demo/debate";
import type { State as TruthState } from "./demo/truth";
import type { State as HangoutState } from "./demo/hangout";
import type { State as JuryState } from "./demo/jury";
import type { State as BlindState } from "./demo/blind";

/**
 * What my own profile says about each game: one short line, and whether the
 * game is waiting for me. An empty line means there is nothing to tell yet.
 *
 * It is only ever shown to the person it is about. Even so, it is built from
 * outcomes alone: never from the interests of ¿Me lío?, the authors of an
 * anonymous question or the reason a blind date closed.
 */
export type GameSummary = { id: GameKind; line: string; pending: boolean };
type Line = { line: string; pending?: boolean };
type Translate = GameWorld["t"];

const count = (t: Translate, total: number, one: readonly [string, string], many: readonly [string, string]) => `${total} ${total === 1 ? t(...one) : t(...many)}`;

const lines: { [K in GameKind]: (state: never, t: Translate) => Line } = {
  crush: (state: CrushState, t) => !state.joined ? { line: "" }
    : state.matches.length ? { line: count(t, state.matches.length, ["coincidencia", "coincidència"], ["coincidencias", "coincidències"]) }
    : { line: state.paused ? t("En pausa", "En pausa") : t("Dentro, sin coincidencias todavía", "Dins, sense coincidències encara") },
  questions: (state: QuestionsState, t) => state.inbox.length
    ? { line: count(t, state.inbox.length, ["pregunta por responder", "pregunta per respondre"], ["preguntas por responder", "preguntes per respondre"]), pending: true }
    : { line: state.sent.length ? count(t, state.sent.length, ["pregunta enviada", "pregunta enviada"], ["preguntas enviadas", "preguntes enviades"]) : "" },
  debate: (state: DebateState, t) => !state.mine ? { line: "" }
    : state.mine.isMyTurn ? { line: t("Te toca defender tu postura", "Et toca defendre la teua postura"), pending: true }
    : { line: state.mine.status === "voting" ? t("Tu debate está en votación", "El teu debat està en votació") : state.mine.status === "verdict" ? t("Tu debate ya tiene veredicto", "El teu debat ja té veredicte") : t("Tienes un debate abierto", "Tens un debat obert") },
  truth: (state: TruthState, t) => {
    const parts = [state.streak > 0 ? t(`Racha de ${state.streak}`, `Ratxa de ${state.streak}`) : "", state.mine.length ? count(t, state.mine.length, ["ronda tuya", "ronda teua"], ["rondas tuyas", "rondes teues"]) : ""].filter(Boolean);
    return { line: parts.join(" · ") };
  },
  hangout: (state: HangoutState, t) => state.active
    ? { line: `${state.active.whatLabel} · ${state.active.placeLabel}`, pending: !state.active.ended }
    : { line: state.repeat ? t("¿Repetís? Te están esperando", "Repetiu? T’estan esperant") : "", pending: !!state.repeat },
  jury: (state: JuryState, t) => state.weekly && state.weekly.status === "open" && !state.weekly.myVote
    ? { line: t("El caso de la semana espera tu voto", "El cas de la setmana espera el teu vot"), pending: true }
    : { line: state.openMineCount ? count(t, state.openMineCount, ["caso tuyo abierto", "cas teu obert"], ["casos tuyos abiertos", "casos teus oberts"]) : "" },
  blind: (state: BlindState, t) => {
    switch (state.stage) {
      case "chat": return { line: t("Tienes una conversación en marcha", "Tens una conversa en marxa"), pending: true };
      case "decision": return { line: state.decision?.waiting ? t("Decisión enviada", "Decisió enviada") : t("Te toca decidir", "Et toca decidir"), pending: !state.decision?.waiting };
      case "confirmed": return { line: t("Dentro de la próxima ronda", "Dins de la pròxima ronda") };
      case "round": return { line: t("Ronda abierta: confirma si entras", "Ronda oberta: confirma si entres"), pending: true };
      // The same closing line whatever happened, as in the game itself.
      case "done": return { line: t("Ronda terminada", "Ronda acabada") };
      default: return { line: "" };
    }
  },
};

/**
 * The games someone else's profile can open, already aimed at that person.
 * Only what is signed and already visible to me is used: their round of three
 * sentences and their open hangout. ¿Me lío? and La cita are left out on
 * purpose, because a door to them from a profile would say who I am after.
 */
export const personGames = ["questions", "truth", "hangout"] as const satisfies readonly GameKind[];

export function personHooks(world: GameWorld, personId: string, demo: boolean): GameSummary[] {
  const t = world.t;
  const read = <S>(id: GameKind): S | null => { if (!demo) return null; try { return demoPlay(id, world, "read", {}) as S; } catch { return null; } };
  const hooks: Record<(typeof personGames)[number], () => Line> = {
    questions: () => ({ line: t("Pregúntale algo. No sabrá que has sido tú.", "Pregunta-li alguna cosa. No sabrà que has sigut tu.") }),
    truth: () => read<TruthState>("truth")?.deck.some(round => round.owner === personId && !round.played)
      ? { line: t("Tiene una ronda esperándote: adivina su trola.", "Té una ronda esperant-te: endevina la seua mentida."), pending: true }
      : { line: t("Rétale con tus tres frases.", "Repta’l amb les teues tres frases.") },
    hangout: () => {
      const open = read<HangoutState>("hangout")?.discover.find(item => item.owner === personId);
      return open
        ? { line: t(`Tiene un hueco abierto: ${open.whatLabel} · ${open.placeLabel}`, `Té un forat obert: ${open.whatLabel} · ${open.placeLabel}`), pending: true }
        : { line: t("Ábrele un hueco que solo verá esta persona.", "Obri-li un forat que només veurà esta persona.") };
    },
  };
  return personGames.filter(id => enabledGames.some(game => game.id === id)).map(id => { const { line, pending = false } = hooks[id](); return { id, line, pending }; });
}

/** Reads every enabled game once. Reading never changes a game, so this is safe to call while rendering. */
export function demoSummaries(world: GameWorld): GameSummary[] {
  return enabledGames.map(game => {
    try {
      const { line, pending = false } = (lines[game.id] as (state: unknown, t: Translate) => Line)(demoPlay(game.id, world, "read", {}), world.t);
      return { id: game.id, line, pending };
    } catch { return { id: game.id, line: "", pending: false }; }
  });
}
