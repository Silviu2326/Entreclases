import { createBackofficeDemo } from "./demo";

/**
 * The admin panel is statically exported, so mutations are sent through the
 * authenticated Supabase RPC instead of Next server actions. The local
 * adapter is kept for the preview and makes the panel useful while the SQL
 * migration is being rolled out; it is also safe to replay after a refresh.
 */
export type BackofficeAction =
  | { command: "resolve_case"; id: string | number; state: "Resuelto" }
  | { command: "proposal_state"; id: string | number; state: "Aceptada" | "Rechazada" }
  | { command: "game_state"; name: string; active: boolean };

const STORAGE_KEY = "entreclase:backoffice:session:v1";

type PersistedState = {
  cases?: Array<{ id: string | number; state: string }>;
  proposals?: Array<{ id: string | number; state: string }>;
  games?: Array<{ name: string; active: boolean; activity: string }>;
};

function readLocal(): PersistedState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as PersistedState : {};
  } catch {
    return {};
  }
}

function writeLocal(next: PersistedState) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* private browsing */ }
}

export function loadBackofficeSession(): PersistedState {
  return readLocal();
}

export function clearBackofficeSession() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* private browsing */ }
}

function applyLocal(action: BackofficeAction) {
  const current = readLocal();
  if (action.command === "resolve_case") {
    const cases = [...(current.cases ?? []).filter((item) => item.id !== action.id), { id: action.id, state: action.state }];
    writeLocal({ ...current, cases });
  } else if (action.command === "proposal_state") {
    const proposals = [...(current.proposals ?? []).filter((item) => item.id !== action.id), { id: action.id, state: action.state }];
    writeLocal({ ...current, proposals });
  } else {
    const games = [...(current.games ?? []).filter((item) => item.name !== action.name), { name: action.name, active: action.active, activity: action.active ? "Activo · esperando participación" : "Pausado por ahora" }];
    writeLocal({ ...current, games });
  }
}

export async function persistBackofficeAction(action: BackofficeAction): Promise<void> {
  // Demo mode intentionally persists only in this browser. Production
  // mutations go through lib/backoffice/client.ts and the audited Supabase
  // RPC, so this adapter never makes an untrusted client-side admin call.
  applyLocal(action);
}

/** True when this browser has a non-demo mutation persisted locally. */
export function hasBackofficeSession() {
  const state = readLocal();
  return Boolean(state.cases?.length || state.proposals?.length || state.games?.length);
}

// Keep the imported demo factory reachable for downstream adapters without
// forcing every consumer to know where preview snapshots come from.
export { createBackofficeDemo };
