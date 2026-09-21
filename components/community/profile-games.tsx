"use client";
import Link from "next/link";
import { useMemo } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { enabledGames, gamePath, languageIndex } from "@/lib/community/games/catalog";
import { demoSummaries, personHooks } from "@/lib/community/games/summary";
import { buildWorld } from "@/lib/community/games/world";
import type { Profile } from "@/lib/community/types";
import { useCommunity } from "./context";
import { GameArt } from "./games";
import "./profile-games.css";

// On someone else's profile: the games that can start something with that
// person, opened already aimed at them through ?to=.
export function PersonGames({ person }: { person: Profile }) {
  const { locale, demo, data, me } = useCommunity();
  const language = languageIndex(locale);
  const hooks = useMemo(() => personHooks(buildWorld(data, me, locale), person.user_id, demo), [data, me, locale, person.user_id, demo]);
  if (person.user_id === me.user_id || !hooks.length) return null;
  return <section className="u-games-person" aria-labelledby="person-games-title">
    <p className="u-eyebrow" id="person-games-title">{language ? "TRENCA EL GEL" : "ROMPE EL HIELO"}</p>
    <ul className="u-games-list">{hooks.map(hook => {
      const game = enabledGames.find(entry => entry.id === hook.id);
      return game ? <li key={hook.id}><Link href={`${gamePath(locale, demo, hook.id)}?to=${encodeURIComponent(person.user_id)}`} className={`u-games-item ex-game-${hook.id}${hook.pending ? " is-waiting" : ""}`}>
        <GameArt id={hook.id}/>
        <span><strong>{game.title[language]}</strong><small>{hook.line}</small></span>
        <ArrowUpRight aria-hidden="true"/>
      </Link></li> : null;
    })}</ul>
  </section>;
}

// The experiences of Explorar, inside my own profile. The demo adds what is
// going on in each one; real accounts get the doors only, until the server
// can answer for the seven games in a single call (docs/juegos/08-servidor.md).
export function ProfileGames() {
  const { locale, demo, data, me } = useCommunity();
  const language = languageIndex(locale);
  const summaries = useMemo(() => demo ? demoSummaries(buildWorld(data, me, locale)) : [], [demo, data, me, locale]);
  const waiting = summaries.filter(summary => summary.pending).length;
  if (!enabledGames.length) return null;
  const body = waiting
    ? (language ? `${waiting} ${waiting === 1 ? "t’està esperant" : "t’estan esperant"}.` : `${waiting} ${waiting === 1 ? "te está esperando" : "te están esperando"}.`)
    : (language ? "Excuses per a trencar el gel, a un toc." : "Excusas para romper el hielo, a un toque.");
  return <details className="u-card u-picks u-games">
    <summary className="u-picks-summary">
      <div><p className="u-eyebrow">{language ? "EXPLORAR · JOCS" : "EXPLORAR · JUEGOS"}</p><h2 id="profile-games-title">{language ? "Els teus jocs" : "Tus juegos"}</h2><p className="u-muted">{body}</p></div>
      <span className="u-picks-summary-side">{waiting > 0 && <span className="u-picks-score"><strong>{waiting}</strong></span>}<ChevronDown aria-hidden="true"/></span>
    </summary>
    <div className="u-picks-detail"><ul className="u-games-list" aria-labelledby="profile-games-title">{enabledGames.map(game => {
      const summary = summaries.find(entry => entry.id === game.id);
      return <li key={game.id}><Link href={gamePath(locale, demo, game.id)} className={`u-games-item ex-game-${game.id}${summary?.pending ? " is-waiting" : ""}`}>
        <GameArt id={game.id}/>
        <span><strong>{game.title[language]}</strong><small>{summary?.line || game.description[language]}</small></span>
        <ArrowUpRight aria-hidden="true"/>
      </Link></li>;
    })}</ul></div>
  </details>;
}
