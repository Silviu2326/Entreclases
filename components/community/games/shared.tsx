"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useCommunity } from "../context";
import { getAuthClient } from "@/lib/auth/client";
import { demoPlay } from "@/lib/community/games/demo";
import { localPath } from "@/lib/i18n/routes";
import type { GameKind, Input, Room } from "@/lib/community/games/types";
import { Action, TextArea } from "../controls";

class SetupRequiredError extends Error {}
export function useWords() { const { locale } = useCommunity(); return (es: string, va: string) => locale === "va" ? va : es; }
export function useGame(kind: GameKind) {
  const { demo, me, repo, go, run } = useCommunity();
  const [rooms, setRooms] = useState<Room[]>([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const lock = useRef(false), alive = useRef(true), version = useRef(0);
  const request = useCallback(async (command: string, input: Input = {}) => {
    if (demo) return demoPlay(kind, command, input, me.user_id, me.name);
    const { data, error } = await getAuthClient().rpc("universe_play", { p_game: kind, p_command: command, p_input: input });
    if (error) {
      if (error.code === "PGRST202" || error.code === "42883") throw new SetupRequiredError("Estas experiencias aún no están activadas para cuentas reales. Puedes probarlas en la demo.");
      throw new Error(error.message || "No se ha podido guardar. Inténtalo de nuevo.");
    }
    return data as Room[];
  }, [demo, kind, me.user_id, me.name]);
  const refresh = useCallback(async () => {
    if (lock.current) return;
    const revision = ++version.current;
    try { const result = await request("read"); if (alive.current && revision === version.current) { setRooms(result); setError(""); setUnavailable(false); } }
    catch (e) { if (alive.current && revision === version.current) { setError(e instanceof Error ? e.message : "No se pudo cargar."); setUnavailable(e instanceof SetupRequiredError); } }
    finally { if (alive.current && revision === version.current) setLoading(false); }
  }, [request]);
  const disconnect = useCallback(() => { alive.current = false; version.current++; }, []);
  useEffect(() => {
    alive.current = true;
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 8000);
    return () => { disconnect(); window.clearTimeout(initial); window.clearInterval(timer); };
  }, [refresh, disconnect]);
  const act = async (command: string, input: Input = {}) => {
    if (lock.current) return false;
    lock.current = true; version.current++; setBusy(true); setError("");
    try { const result = await request(command, input); if (alive.current) { setRooms(result); setUnavailable(false); } return true; }
    catch (e) { if (alive.current) { setError(e instanceof Error ? e.message : "No se pudo guardar."); setUnavailable(e instanceof SetupRequiredError); } return false; }
    finally { lock.current = false; if (alive.current) { setBusy(false); setLoading(false); } }
  };
  const chat = async (peer: string) => { let id = ""; if (await run(async () => { id = await repo.openThread(peer); }, "")) go("messages", { threadId: id }); };
  return { kind, rooms, loading, busy, error, unavailable, act, refresh, demo, chat };
}
export type Game = ReturnType<typeof useGame>;
export function GameFrame({ game, children }: { game: Game; children: ReactNode }) {
  const t = useWords();
  const { locale } = useCommunity();
  return <div className="ec-game">{game.demo && <p className="ec-game-notice">{t("Modo de prueba: personas ficticias. Los cambios duran esta pestaña y no llegan a nadie.", "Mode de prova: persones fictícies. Els canvis duren esta pestanya i no arriben a ningú.")}</p>}{game.error && <div role="alert" className="ec-game-error"><p>{game.error}</p>{game.unavailable && <a className="ex-link" href={localPath(locale,"demo")+`?view=explore#juego-${game.kind}`}>{t("Probar este juego en la demo", "Provar este joc en la demo")}</a>}<Action secondary onClick={() => void game.refresh()}>{t("Reintentar", "Tornar a intentar")}</Action></div>}{game.loading ? <p role="status">{t("Preparando la experiencia…", "Preparant l'experiència…")}</p> : !game.unavailable && children}</div>;
}
export function Say({ label, onSend, busy, maxLength = 600 }: { label: string; onSend: (text: string) => Promise<boolean>; busy: boolean; maxLength?: number }) {
  const [text, setText] = useState(""); const t = useWords();
  return <form className="ec-game-form" onSubmit={async e => { e.preventDefault(); if (text.trim() && await onSend(text.trim())) setText(""); }}><TextArea label={label} value={text} onChange={e => setText(e.target.value)} required maxLength={maxLength} rows={2}/><Action type="submit" disabled={busy || !text.trim()}>{t("Enviar", "Enviar")}</Action></form>;
}
export function EmptyGame() { const t = useWords(); return <p className="ec-game-empty">{t("Todavía no hay nadie por aquí. Puedes empezar tú.", "Encara no hi ha ningú ací. Pots començar tu.")}</p>; }
export function Thread({ room }: { room: Room }) { return <div className="ec-game-thread" aria-live="polite">{room.moves.filter(m => m.kind === "say").map(m => <p key={m.id}><strong>{m.label}</strong><span>{m.body}</span></p>)}</div>; }
