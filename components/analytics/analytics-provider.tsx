"use client";

import { useEffect, useRef } from "react";
import { getAuthClient } from "@/lib/auth/client";
import type { Locale } from "@/lib/i18n/routes";
import type { GameKind } from "@/lib/community/games/types";

type AnalyticsOptions = { enabled: boolean; locale: Locale; path: string; view: string; game: GameKind | null };

function sessionId() {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(36).slice(2);
}

/** First-party usage signals. It deliberately excludes message content and query-string identifiers. */
export function useAnalytics({ enabled, locale, path, view, game }: AnalyticsOptions) {
  const sessionRef = useRef<string | null>(null);
  const pathRef = useRef(path);
  const viewRef = useRef(view);
  const gameRef = useRef(game);
  const lastEventPathRef = useRef<string | null>(null);
  const tickRef = useRef(0);

  useEffect(() => {
    pathRef.current = path;
    viewRef.current = view;
    gameRef.current = game;
  }, [path, view, game]);

  useEffect(() => {
    if (!enabled) {
      sessionRef.current = null;
      lastEventPathRef.current = null;
      return;
    }
    const client = getAuthClient();
    const id = sessionId();
    sessionRef.current = id;
    lastEventPathRef.current = pathRef.current;
    tickRef.current = performance.now();
    const call = (name: string, args: Record<string, unknown>) => { void client.rpc(name, args); };
    const flush = (allowHidden = false) => {
      if (!allowHidden && document.visibilityState !== "visible") return;
      const now = performance.now();
      const seconds = Math.max(0, Math.min(90, Math.round((now - tickRef.current) / 1000)));
      tickRef.current = now;
      if (seconds) call("universe_analytics_heartbeat", { p_session_id: id, p_path: pathRef.current, p_active_seconds: seconds });
    };
    const startArgs = { p_session_id: id, p_path: pathRef.current, p_locale: locale };
    const eventArgs = { p_session_id: id, p_name: "page_view", p_path: pathRef.current, p_metadata: { view: viewRef.current, game: gameRef.current } };
    void client.rpc("universe_analytics_start", startArgs).then(({ error }) => {
      if (!error) void client.rpc("universe_analytics_event", eventArgs);
    });
    const interval = window.setInterval(() => flush(), 30_000);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush(true);
      else tickRef.current = performance.now();
    };
    const onPageHide = () => { flush(true); call("universe_analytics_end", { p_session_id: id }); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      flush(true);
      call("universe_analytics_end", { p_session_id: id });
      if (sessionRef.current === id) sessionRef.current = null;
    };
  }, [enabled, locale]);

  useEffect(() => {
    const id = sessionRef.current;
    if (!enabled || !id || lastEventPathRef.current === path) return;
    lastEventPathRef.current = path;
    void getAuthClient().rpc("universe_analytics_event", { p_session_id: id, p_name: "page_view", p_path: path, p_metadata: { view, game } });
  }, [enabled, path, view, game]);
}

