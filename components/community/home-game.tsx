"use client";

import { useMemo } from "react";
import { ArrowUpRight, CalendarDays, MessageCircle } from "lucide-react";
import { gameById, languageIndex } from "@/lib/community/games/catalog";
import { madridDay, openingOfDay } from "@/lib/community/games/openings";
import { playableGames } from "@/lib/community/games/gate";
import { useMeetGamesOpen } from "./meet-gate";
import { blindRoundLabel, useNow } from "@/lib/community/games/schedule";
import { demoSummaries } from "@/lib/community/games/summary";
import { buildWorld } from "@/lib/community/games/world";
import { useCommunity } from "./context";
import { WarmupCard } from "./explore-opening";
import { GameLink } from "./games";
import "./explore.css";

// Mediodía en València del día que está a `days` días del de hoy: evita los días de 23 y 25 horas.
function dayFrom(now: Date, days: number) { return new Date(Date.parse(`${madridDay(now)}T12:00:00Z`) + days * 86_400_000); }

/* La referencia a los juegos que pedía Inicio: el mismo que abre Explorar hoy,
   con la misma ronda de calentamiento (y la misma respuesta, si ya la diste allí).
   Encima, lo que te está esperando; debajo, lo que viene. Cambia a medianoche. */
export function GameOfDay() {
  const { c, locale, demo, data, me, go } = useCommunity();
  const language = languageIndex(locale);
  const ids = playableGames(useMeetGamesOpen() === true);
  const id = openingOfDay(ids);
  const game = gameById(id);
  // Solo la demo sabe qué juegos te esperan; con cuenta real no se muestra nada.
  const summaries = useMemo(() => demo ? demoSummaries(buildWorld(data, me, locale)) : [], [demo, data, me, locale]);
  const waiting = summaries.filter(summary => summary.pending).slice(0, 2);
  // Las fechas relativas, solo en el navegador (null al prerenderizar).
  const now = useNow();
  const blind = gameById("blind");
  if (!game) return null;
  const upcoming = now ? [1, 2].map(days => gameById(openingOfDay(ids, dayFrom(now, days)))) : [];
  return <section className={`u-home-game u-home-game-${id}`} aria-labelledby="u-home-game-title">
    <div className="u-home-section-heading">
      <div>
        <p className="u-eyebrow">{c("gameOfDay")}</p>
        <h2 id="u-home-game-title">{game.title[language]}</h2>
        <p className="u-home-game-help">{c("gameOfDayHelp")}</p>
      </div>
      <button type="button" className="u-text-link" onClick={() => go("explore", { anchor: "juegos" })}>{c("allGames")}<ArrowUpRight aria-hidden="true" /></button>
    </div>
    {waiting.length > 0 && <ul className="u-home-game-turns" aria-label={language ? "Et toca" : "Te toca"}>{waiting.map(summary => {
      const entry = gameById(summary.id);
      return entry ? <li key={summary.id}><GameLink id={summary.id} className={`u-home-game-turn ex-game-${summary.id}`}><b>{language ? "Et toca" : "Te toca"}</b><strong>{entry.title[language]}</strong>{summary.line && <small>{summary.line}</small>}<ArrowUpRight aria-hidden="true" /></GameLink></li> : null;
    })}</ul>}
    <WarmupCard game={id} heading="h3" className="u-home-game-card" />
    {now && <div className="u-home-game-next">
      {upcoming.length > 0 && <p><CalendarDays aria-hidden="true" />{upcoming.map((entry, index) => entry ? <span key={index}>{index ? (language ? "Despús-demà" : "Pasado mañana") : (language ? "Demà" : "Mañana")}: <strong>{entry.title[language]}</strong></span> : null)}</p>}
      {blind && <p><MessageCircle aria-hidden="true" /><GameLink id="blind" className="u-home-game-blind-link"><strong>{blind.title[language]}</strong> · {blindRoundLabel(language, now)}<ArrowUpRight aria-hidden="true" /></GameLink></p>}
    </div>}
  </section>;
}
