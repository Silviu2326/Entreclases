import { useCallback, useSyncExternalStore } from "react";
import { madridDay } from "./openings";
import type { GameKind } from "./types";

// La ronda de calentamiento es la misma en Inicio y en Explorar: lo que eliges en
// una pantalla aparece ya elegido en la otra. Dura la sesión y solo el día de hoy,
// hora de València. Sin sessionStorage (modo privado, bloqueado) vive en memoria.
type Stored = { day: string; game: GameKind; choice: number };
const key = "entreclase.warmup", event = "entreclase:warmup";
let memory: string | null = null;

function readRaw(): string | null {
  try { return window.sessionStorage.getItem(key) ?? memory; } catch { return memory; }
}

function subscribe(onChange: () => void) {
  window.addEventListener(event, onChange);
  return () => window.removeEventListener(event, onChange);
}

// Devuelve un número o null: un valor primitivo, estable entre lecturas.
function readChoice(game: GameKind): number | null {
  const raw = readRaw();
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as Partial<Stored>;
    return stored.day === madridDay() && stored.game === game && typeof stored.choice === "number" ? stored.choice : null;
  } catch { return null; }
}

export function saveWarmupChoice(game: GameKind, choice: number) {
  const raw = JSON.stringify({ day: madridDay(), game, choice } satisfies Stored);
  memory = raw;
  try { window.sessionStorage.setItem(key, raw); } catch { /* se queda en memoria */ }
  window.dispatchEvent(new CustomEvent(event, { detail: { game, choice } }));
}

// En el servidor y en la hidratación no hay elección; se lee al montar.
export function useWarmupChoice(game: GameKind): [number | null, (choice: number) => void] {
  const choice = useSyncExternalStore(subscribe, () => readChoice(game), () => null);
  const choose = useCallback((next: number) => saveWarmupChoice(game, next), [game]);
  return [choice, choose];
}
