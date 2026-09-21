"use client";

import type { ComponentType } from "react";
import { ArrowDown, ArrowUpRight, Check, Coffee, EyeOff, Flame, Heart, Lock, Mail, MessageCircle, Scale, Send, Sparkles, Theater, ThumbsDown, ThumbsUp, Timer, Users } from "lucide-react";
import { languageIndex } from "@/lib/community/games/catalog";
import { openings } from "@/lib/community/games/openings";
import { useWarmupChoice } from "@/lib/community/games/warmup";
import type { GameKind } from "@/lib/community/games/types";
import { useCommunity } from "./context";
import { GameLink } from "./games";

// Each warm-up round borrows the mechanic of its game, so no two banners look alike.
type MiniProps = { options: string[]; choice: number | null; choose: (index: number) => void; language: number };
const pressed = (choice: number | null, index: number) => ({ "aria-pressed": choice === index, className: choice === index ? "chosen" : "" });

// Dos verdades y una trola: three numbered statements, one of them is the lie.
function TruthMini({ options, choice, choose }: MiniProps) {
  return <div className="ex-statements">{options.map((option, index) => <button key={option} {...pressed(choice, index)} onClick={() => choose(index)}><span>{String(index + 1).padStart(2, "0")}</span>{option}{choice === index ? <Check /> : <ArrowUpRight />}</button>)}</div>;
}

// ¿Me lío?: a private pick between two people; it stays locked until it is mutual.
function CrushMini({ options, choice, choose, language }: MiniProps) {
  const icons = [Coffee, Heart, Flame], Chosen = choice === null ? Lock : icons[choice];
  return <div className="ex-mini ex-mini-crush">
    <div className={`ex-crush-pair ${choice === null ? "" : "on"}`} aria-hidden="true"><span>{language ? "tu" : "tú"}</span><i/><b><Chosen /></b><i/><span>?</span></div>
    <div className="ex-crush-choices">{options.map((option, index) => { const Icon = icons[index]; return <button key={option} {...pressed(choice, index)} onClick={() => choose(index)}><Icon /><span>{option}</span></button>; })}</div>
  </div>;
}

// Sin dar la cara: an unsigned note that fills in with the chosen question.
function QuestionsMini({ options, choice, choose, language }: MiniProps) {
  return <div className="ex-mini ex-mini-questions">
    <div className={`ex-letter ${choice === null ? "" : "on"}`}><span className="ex-letter-from"><EyeOff aria-hidden="true" />{language ? "De: anònim" : "De: anónimo"}</span><p>{choice === null ? (language ? "Tria una pregunta i s’escriu ací, sense firma." : "Elige una pregunta y se escribe aquí, sin firma.") : options[choice]}</p><span className="ex-letter-stamp" aria-hidden="true">{choice === null ? "?" : <Send />}</span></div>
    <div className="ex-chips">{options.map((option, index) => <button key={option} {...pressed(choice, index)} onClick={() => choose(index)}>{option}</button>)}</div>
  </div>;
}

// Defiende lo indefendible: two sides facing each other and three turns to convince.
function DebateMini({ options, choice, choose, language }: MiniProps) {
  const icons = [ThumbsUp, ThumbsDown];
  return <div className="ex-mini ex-mini-debate">
    <div className="ex-versus">{options.map((option, index) => { const Icon = icons[index] ?? ThumbsUp; return <button key={option} {...pressed(choice, index)} onClick={() => choose(index)}><Icon /><span>{option}</span></button>; })}<span className="ex-vs" aria-hidden="true">VS</span></div>
    <div className={`ex-turns ${choice === null ? "" : "on"}`} aria-hidden="true"><i/><i/><i/><small>{language ? "tres torns per a convéncer" : "tres turnos para convencer"}</small></div>
  </div>;
}

// Hay hueco: a short meet-up with limited seats; choosing a duration takes one.
function HangoutMini({ options, choice, choose, language }: MiniProps) {
  const taken = choice === null ? 2 : 3, fill = choice === null ? 0 : [25, 60, 100][choice] ?? 100;
  return <div className="ex-mini ex-mini-hangout">
    <div className="ex-seats" aria-hidden="true"><Users />{[0, 1, 2, 3].map(seat => <i key={seat} className={seat < taken ? (seat === 2 ? "taken mine" : "taken") : ""}/>)}<small>{taken}/4 {language ? "places" : "plazas"}</small></div>
    <div className="ex-segments">{options.map((option, index) => <button key={option} {...pressed(choice, index)} onClick={() => choose(index)}>{option}</button>)}</div>
    <div className="ex-meter" aria-hidden="true"><i style={{ width: `${fill}%` }}/></div>
  </div>;
}

// El jurado del campus: vote first; the example verdict only shows afterwards.
function JuryMini({ options, choice, choose, language }: MiniProps) {
  const share = [58, 42];
  return <div className="ex-mini ex-mini-jury">
    {options.map((option, index) => <button key={option} {...pressed(choice, index)} onClick={() => choose(index)}><span className="ex-verdict-label">{option}{choice === index && <Check />}</span><span className="ex-verdict-bar" aria-hidden="true"><i style={{ width: choice === null ? "0%" : `${share[index] ?? 50}%` }}/></span><strong aria-hidden="true">{choice === null ? "?" : `${share[index] ?? 50} %`}</strong></button>)}
    <small>{choice === null ? (language ? "El resultat es veu després de votar." : "El resultado se ve después de votar.") : (language ? "Percentatges d’exemple." : "Porcentajes de ejemplo.")}</small>
  </div>;
}

// La cita empieza hablando: a 48-hour written chat with someone unseen.
function BlindMini({ options, choice, choose, language }: MiniProps) {
  return <div className="ex-mini ex-mini-blind">
    <div className="ex-chat-top" aria-hidden="true"><span className="ex-mystery">?</span><small>{language ? "algú del campus" : "alguien del campus"}</small><span className="ex-timer"><Timer />48 h</span></div>
    <div className="ex-chat" aria-live="polite">{choice === null ? <p className="ex-bubble ex-bubble-empty">{language ? "Tria com trenques el gel…" : "Elige cómo rompes el hielo…"}</p> : <><p className="ex-bubble ex-bubble-me">{options[choice]}</p><p className="ex-bubble ex-bubble-them" aria-label={language ? "Està escrivint" : "Está escribiendo"}><i/><i/><i/></p></>}</div>
    <div className="ex-chips">{options.map((option, index) => <button key={option} {...pressed(choice, index)} onClick={() => choose(index)}>{option}</button>)}</div>
  </div>;
}

export const minis: Record<GameKind, ComponentType<MiniProps>> = { truth: TruthMini, crush: CrushMini, questions: QuestionsMini, debate: DebateMini, hangout: HangoutMini, jury: JuryMini, blind: BlindMini };
export const marks: Record<GameKind, ComponentType<{ "aria-hidden"?: boolean }>> = { truth: Sparkles, crush: Heart, questions: Mail, debate: Theater, hangout: Coffee, jury: Scale, blind: MessageCircle };

// La ronda de calentamiento, igual en Explorar y en Inicio: la elección se comparte
// entre las dos pantallas durante el día (useWarmupChoice).
export function WarmupCard({ game, heading = "h2", className = "" }: { game: GameKind; heading?: "h2" | "h3"; className?: string }) {
  const { locale } = useCommunity();
  const language = languageIndex(locale), card = openings[game].card;
  const [choice, choose] = useWarmupChoice(game);
  const Mini = minis[game], Mark = marks[game], Heading = heading;
  return <div className={`ex-first-game ex-warmup ex-warmup-${game}${className ? ` ${className}` : ""}`}><div className="ex-first-game-head"><span>{card.label[language]}</span><Mark aria-hidden/></div><Heading>{card.title[language]}</Heading><p>{card.prompt[language]}</p><Mini options={card.options.map(option => option[language])} choice={choice} choose={choose} language={language}/><div className="ex-practice-result" role="status">{choice === null ? card.idle[language] : card.results[choice]?.[language] ?? card.idle[language]}</div><GameLink id={game}>{card.cta[language]}<ArrowUpRight /></GameLink></div>;
}

// The opening banner of Explorar: one per experience, chosen when the page is entered.
export function ExploreOpening({ game }: { game: GameKind }) {
  const { locale } = useCommunity();
  const language = languageIndex(locale), opening = openings[game];
  return <section className={`ex-opening ex-opening-${game}`} aria-labelledby="ex-title">
    <div className="ex-opening-copy"><p className="ex-kicker">EXPLORAR · VALÈNCIA</p><h1 id="ex-title">{opening.headline[language]}<br/><em>{opening.highlight[language]}</em></h1><p>{opening.body[language]}</p><a className="ex-link" href="#ex-plans">{language ? "Vore què hi ha fora" : "Ver qué hay fuera"}<ArrowDown /></a><span className="ex-handwritten" aria-hidden="true">{opening.note[language]}</span></div>
    <WarmupCard game={game}/>
  </section>;
}
