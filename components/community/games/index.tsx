"use client";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Coffee, Heart, Mail, Scale, Sparkles, Theater } from "lucide-react";
import { gamePath, languageIndex, type GameIntent } from "@/lib/community/games/catalog";
import { openingOfDay } from "@/lib/community/games/openings";
import { isMeetGame, playableGames } from "@/lib/community/games/gate";
import { useMeetGamesOpen } from "../meet-gate";
import type { GameKind } from "@/lib/community/games/types";
import { games } from "./catalog";
import { matches, useCommunity } from "../context";
import "../explore.css";

const artwork = { crush:Heart, questions:Mail, debate:Theater, truth:Sparkles, hangout:Coffee, jury:Scale, blind:Heart };
const gestures = { crush:"♡ + ♡", questions:"¿ ?", debate:"sí. no.", truth:"1 2 ¿3?", hangout:"¿un café?", jury:"a favor / en contra", blind:"hola, tú." };
const visuals: Record<GameKind,string> = { crush:"/images/games/me-lio.png", questions:"/images/games/sin-dar-la-cara.png", debate:"/images/games/defiende-lo-indefendible.png", truth:"/images/games/dos-verdades-y-una-trola.png", hangout:"/images/games/hay-hueco.png", jury:"/images/games/jurado-del-campus.png", blind:"/images/games/la-cita-empieza-hablando.png" };
const intentGroups: ReadonlyArray<{ id: GameIntent; title: readonly [string, string]; description: readonly [string, string] }> = [
  { id: "play", title: ["Jugar y opinar", "Jugar i opinar"], description: ["Un toque para participar y una excusa para hablar.", "Un toc per a participar i una excusa per a parlar."] },
  { id: "meet", title: ["Conocer gente", "Conéixer gent"], description: ["Con calma, con curiosidad y con control sobre lo que compartes.", "Amb calma, amb curiositat i amb control sobre el que compartixes."] },
  { id: "hangout", title: ["Quedar", "Quedar"], description: ["Para convertir un rato libre en un plan concreto.", "Per a convertir una estona lliure en un pla concret."] },
];

// Link to an experience's own page from anywhere inside the community app.
export function GameLink({ id, className = "ex-link", children }: { id: GameKind; className?: string; children: React.ReactNode }) {
  const { locale, demo } = useCommunity();
  return <Link className={className} href={gamePath(locale, demo, id)}>{children}</Link>;
}

export function GameArt({ id }: { id: GameKind }) {
  const Icon = artwork[id];
  return <span className="ex-game-art" aria-hidden="true"><img src={visuals[id]} alt="" loading="lazy" decoding="async"/><Icon /><i/><span>{gestures[id]}</span></span>;
}

export function GameHub() {
  const { locale, demo, query } = useCommunity();
  const language = languageIndex(locale);
  const meetOpen = useMeetGamesOpen() === true;
  const listed = games.filter(game => matches(query, game.title[language], game.description[language]));
  // El juego de hoy es el mismo que abre Explorar y el que anuncia Inicio.
  const today = openingOfDay(playableGames(meetOpen));
  const gameCard = (game: (typeof games)[number]) => <Link key={game.id} href={gamePath(locale, demo, game.id)} className={`ex-game ex-game-${game.id}${game.id === today ? " ex-game-today" : ""}`}><GameArt id={game.id} /><span className="ex-game-caption">{game.id === today && <span className="ex-game-today-tag">{language ? "Hui" : "Hoy"}</span>}<strong>{game.title[language]}</strong><small>{game.description[language]}</small><span className="ex-game-effort">{!meetOpen && isMeetGame(game.id) ? (language ? "S’obri quan hi haja més gent del teu campus" : "Se abre cuando haya más gente de tu campus") : game.effort[language]}</span><span className="ex-game-open">{language ? "Entrar al joc" : "Entrar al juego"}<ArrowUpRight /></span></span></Link>;
  return <section className="ex-section ex-games" id="juegos" aria-labelledby="games-title"><header className="ex-section-head"><div><p className="ex-kicker">{language ? "ROMPRE EL GEL TAMBÉ ÉS UN JOC" : "ROMPER EL HIELO TAMBIÉN ES UN JUEGO"}</p><h2 id="games-title">{language ? "Tria què et ve de gust fer." : "Elige qué te apetece hacer."}</h2></div><p>{language ? "Tres maneres d’entrar. Set excuses per a començar." : "Tres formas de entrar. Siete excusas para empezar."}</p></header>{listed.length ? intentGroups.map(group => { const groupGames = listed.filter(game => game.intent === group.id); return groupGames.length ? <section key={group.id} className={`ex-game-intent ex-game-intent-${group.id}`} aria-labelledby={`games-${group.id}-title`}><div className="ex-game-intent-head"><div><p className="ex-kicker">{group.title[language]}</p><h3 id={`games-${group.id}-title`}>{group.description[language]}</h3></div><span>{groupGames.length} {language ? "opcions" : "opciones"}</span></div><div className="ex-game-grid">{groupGames.map(gameCard)}</div></section> : null; }) : <p className="ex-empty">{language ? "Cap joc coincidix amb la cerca." : "Ningún juego coincide con la búsqueda."}</p>}</section>;
}

// The page of a single experience: /app/juegos/<slug>/ and its demo and Valencian variants.
export function GameScreen({ id }: { id: GameKind }) {
  const { locale, demo, go } = useCommunity();
  const language = languageIndex(locale);
  const game = games.find(entry => entry.id === id);
  const meetOpen = useMeetGamesOpen();
  if (!game) return null;
  const Component = game.component, others = games.filter(entry => entry.id !== id);
  return <div className={`ex-page ex-game-page ex-game-${id}`}>
    <section className="ex-game-hero" aria-labelledby="game-title"><GameArt id={id} /><div className="ex-game-hero-copy"><p className="ex-kicker">{language ? "EXPLORAR · JOCS" : "EXPLORAR · JUEGOS"}</p><h1 id="game-title">{game.title[language]}</h1><p>{game.description[language]}</p><button className="ex-link" onClick={() => go("explore")}><ArrowLeft />{language ? "Tornar a Explorar" : "Volver a Explorar"}</button></div></section>
    {!isMeetGame(id) || meetOpen ? <Component /> : meetOpen === false && <MeetLocked id={id} />}
    <nav className="ex-game-others" aria-label={language ? "Altres jocs" : "Otros juegos"}><p className="ex-kicker">{language ? "ALTRES JOCS" : "OTROS JUEGOS"}</p><ul>{others.map(other => <li key={other.id}><Link href={gamePath(locale, demo, other.id)} className={`ex-game-other ex-game-${other.id}`}><GameArt id={other.id} /><span><strong>{other.title[language]}</strong><small>{other.description[language]}</small></span><ArrowUpRight aria-hidden="true" /></Link></li>)}</ul></nav>
  </div>;
}

// ¿Me lío? y La cita esperan a que el campus tenga gente: con pocas personas se
// adivina quién hay detrás y la baraja sale vacía. Mientras, la demo.
function MeetLocked({ id }: { id: GameKind }) {
  const { locale } = useCommunity();
  const language = languageIndex(locale);
  return <section className="ex-game-locked" aria-labelledby="game-locked-title">
    <p className="ex-kicker">{language ? "ENCARA NO" : "TODAVÍA NO"}</p>
    <h2 id="game-locked-title">{language ? "S’obri quan hi haja més gent del teu campus." : "Se abre cuando haya más gente de tu campus."}</h2>
    <p>{language ? "Amb poca gent es endevina qui hi ha darrere i no hi ha amb qui coincidir. Quan el teu campus arribe al mínim, s’obrirà sol. Pots ajudar-hi convidant algú amb el teu +1." : "Con poca gente se adivina quién hay detrás y no hay con quién coincidir. Cuando tu campus llegue al mínimo, se abrirá solo. Puedes ayudar invitando a alguien con tu +1."}</p>
    <Link className="ex-link" href={gamePath(locale, true, id)}>{language ? "Provar-lo en la demo" : "Probarlo en la demo"}<ArrowUpRight /></Link>
  </section>;
}
