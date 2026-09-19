"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, Coffee, Heart, Mail, Scale, Sparkles, Theater, X } from "lucide-react";
import { games } from "./catalog";
import { matches, useCommunity } from "../context";

export function openExploreGame(id: string) {
  const target = document.getElementById(`juego-${id}`);
  if (!(target instanceof HTMLDetailsElement)) return;
  target.open = true;
  target.querySelector("summary")?.focus({ preventScroll:true });
  target.scrollIntoView({ block:"start", behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
}

const artwork = { crush:Heart, questions:Mail, debate:Theater, truth:Sparkles, hangout:Coffee, jury:Scale, blind:Heart };
const gestures = { crush:"♡ + ♡", questions:"¿ ?", debate:"sí. no.", truth:"1 2 ¿3?", hangout:"¿un café?", jury:"a favor / en contra", blind:"hola, tú." };

export function GameHub() {
  const { locale, query } = useCommunity();
  const [opened, setOpened] = useState<string[]>([]);
  const language = locale === "va" ? 1 : 0;
  const listed = games.filter(game => game.enabled && matches(query, game.title[language],game.description[language]));
  useEffect(() => {
    const restore = () => { const id = window.location.hash.replace("#juego-", ""); if (games.some(game => game.id === id)) openExploreGame(id); };
    restore(); window.addEventListener("hashchange",restore);
    return () => window.removeEventListener("hashchange",restore);
  }, []);
  return <section className="ex-section ex-games" id="juegos" aria-labelledby="games-title"><header className="ex-section-head"><div><p className="ex-kicker">{language ? "TRENCAR EL GEL TAMBÉ ÉS UN JOC" : "ROMPER EL HIELO TAMBIÉN ES UN JUEGO"}</p><h2 id="games-title">{language ? "Una partida. I ja teniu alguna cosa en comú." : "Una partida. Y ya tenéis algo en común."}</h2></div><p>{language ? "Tria la teua excusa. La resta va eixint." : "Elige tu excusa. Lo demás va saliendo."}</p></header><div className="ex-game-grid">{listed.map(game => {
    const Component = game.component, Icon = artwork[game.id];
    return <details key={game.id} id={`juego-${game.id}`} className={`ex-game ex-game-${game.id}`} onToggle={event => { const open = event.currentTarget.open; setOpened(previous => open ? previous.includes(game.id) ? previous : [...previous,game.id] : previous.filter(id => id !== game.id)); }}><summary><span className="ex-game-art" aria-hidden="true"><Icon /><i/><span>{gestures[game.id]}</span></span><span className="ex-game-caption"><strong>{game.title[language]}</strong><small>{game.description[language]}</small><span className="ex-game-open">{language ? "Entrar al joc" : "Entrar al juego"}<ArrowUpRight /></span><span className="ex-game-close">{language ? "Tancar el joc" : "Cerrar el juego"}<X /></span></span></summary>{opened.includes(game.id) && <Component/>}</details>;
  })}</div>{!listed.length && <p className="ex-empty">{language ? "Cap joc coincidix amb la cerca." : "Ningún juego coincide con la búsqueda."}</p>}</section>;
}
