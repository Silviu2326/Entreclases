"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getAuthClient } from "@/lib/auth/client";
import { gamePath } from "@/lib/community/games/catalog";
import { demoPlay } from "@/lib/community/games/demo";
import { buildWorld } from "@/lib/community/games/world";
import type { GameKind, GameWorld } from "@/lib/community/games/types";
import type { Profile } from "@/lib/community/types";
import type { View } from "@/lib/community/types";
import { useCommunity } from "../context";
import { Action } from "../controls";
import "./games.css";

class SetupRequiredError extends Error {}

/** What every game screen gets. `state` is the shape that game's engine returns. */
export type Game<S> = {
  kind: GameKind;
  state: S | null;
  world: GameWorld;
  loading: boolean;
  busy: boolean;
  error: string;
  unavailable: boolean;
  demo: boolean;
  t: (es: string, va: string) => string;
  me: Profile;
  person: (id: string) => Profile | undefined;
  act: (command: string, input?: Record<string, unknown>) => Promise<boolean>;
  refresh: () => Promise<void>;
  /** Opens a private conversation with someone, which is where most games end. */
  chat: (peer: string) => Promise<void>;
  go: (view: View) => void;
};

export function useGame<S>(kind: GameKind): Game<S> {
  const { locale, demo, data, me, repo, go, run } = useCommunity();
  const t = useCallback((es: string, va: string) => locale === "va" ? va : es, [locale]);
  const world = useMemo(() => buildWorld(data, me, locale), [data, me, locale]);
  const worldRef = useRef(world);
  useEffect(() => { worldRef.current = world; }, [world]);
  const [state, setState] = useState<S | null>(null), [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [unavailable, setUnavailable] = useState(false);
  const lock = useRef(false), alive = useRef(true), version = useRef(0);

  const request = useCallback(async (command: string, input: Record<string, unknown> = {}) => {
    if (demo) return demoPlay(kind, worldRef.current, command, input) as S;
    const { data: result, error: failure } = await getAuthClient().rpc("universe_play_v2", { p_game: kind, p_command: command, p_input: input });
    if (failure) {
      if (failure.code === "PGRST202" || failure.code === "42883") throw new SetupRequiredError("Estas experiencias todavía no están activadas para cuentas reales. Puedes jugarlas en la demo.");
      throw new Error(failure.message || "No se ha podido guardar. Inténtalo de nuevo.");
    }
    return result as S;
  }, [demo, kind]);

  const refresh = useCallback(async () => {
    if (lock.current) return;
    const revision = ++version.current;
    try { const result = await request("read"); if (alive.current && revision === version.current) { setState(result); setError(""); setUnavailable(false); } }
    catch (e) { if (alive.current && revision === version.current) { setError(e instanceof Error ? e.message : "No se pudo cargar."); setUnavailable(e instanceof SetupRequiredError); } }
    finally { if (alive.current && revision === version.current) setLoading(false); }
  }, [request]);

  useEffect(() => {
    alive.current = true;
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 8000);
    const live = alive, revision = version;
    return () => { live.current = false; revision.current++; window.clearTimeout(initial); window.clearInterval(timer); };
  }, [refresh]);

  const act = async (command: string, input: Record<string, unknown> = {}) => {
    if (lock.current) return false;
    lock.current = true; version.current++; setBusy(true); setError("");
    try { const result = await request(command, input); if (alive.current) { setState(result); setUnavailable(false); } return true; }
    catch (e) { if (alive.current) { setError(e instanceof Error ? e.message : "No se pudo guardar."); setUnavailable(e instanceof SetupRequiredError); } return false; }
    finally { lock.current = false; if (alive.current) { setBusy(false); setLoading(false); } }
  };

  const chat = async (peer: string) => { let id = ""; if (await run(async () => { id = await repo.openThread(peer); }, "")) go("messages", { threadId: id }); };
  const person = useCallback((id: string) => data.profiles.find(profile => profile.user_id === id), [data.profiles]);
  return { kind, state, world, loading, busy, error, unavailable, demo, t, me, person, act, refresh, chat, go };
}

/**
 * The person a profile sent us here for: /juegos/<slug>/?to=<user_id>.
 * Read once on entry, and ignored when it names nobody we know, or me.
 */
export function useGameTarget() {
  const { data, me } = useCommunity();
  const [id] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("to") ?? "");
  return id && id !== me.user_id && data.profiles.some(profile => profile.user_id === id) ? id : null;
}

/** Frame every game screen sits in: the demo notice, errors and the loading state. */
export function GameShell<S>({ game, children }: { game: Game<S>; children: ReactNode }) {
  const { locale } = useCommunity();
  const t = game.t;
  return <div className="g-shell">
    {game.demo && <p className="g-demo-note">{t("Modo de prueba: las personas son ficticias. Lo que hagas dura esta pestaña y no le llega a nadie.", "Mode de prova: les persones són fictícies. El que faces dura esta pestanya i no li arriba a ningú.")}</p>}
    {game.error && <div role="alert" className="g-error"><p>{game.error}</p><div className="g-error-actions">{game.unavailable && <a className="g-link" href={gamePath(locale, true, game.kind)}>{t("Jugar en la demo", "Jugar en la demo")}</a>}<Action secondary onClick={() => void game.refresh()}>{t("Reintentar", "Tornar a intentar")}</Action></div></div>}
    {game.loading ? <p className="g-loading" role="status">{t("Preparando la experiencia…", "Preparant l’experiència…")}</p> : !game.unavailable && game.state !== null && children}
  </div>;
}
