"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Dices, Lock, Users } from "lucide-react";
import { audienceChoices, type AudienceChoice } from "@/lib/community/games/audience";
import type { Audience, AudienceKind, GameWorld } from "@/lib/community/games/types";
import type { Profile } from "@/lib/community/types";
import { Avatar } from "../controls";

/** Re-renders on a timer and hands back the moment it woke up on. */
export function useTick(every = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), every); return () => window.clearInterval(timer); }, [every]);
  return now;
}

/** The heading of a game screen: what this is and, when it helps, who sees it. */
export function GameHead({ title, body, aside }: { title: string; body?: string; aside?: ReactNode }) {
  return <header className="g-head"><div><h2>{title}</h2>{body && <p>{body}</p>}</div>{aside}</header>;
}

/** The rail that shows how far along a two or three step flow you are. */
export function Steps({ steps, current, onBack }: { steps: string[]; current: number; onBack?: () => void }) {
  return <div className="g-steps">{onBack && current > 0 && <button type="button" className="g-step-back" onClick={onBack}><ArrowLeft aria-hidden="true" /></button>}<ol>{steps.map((step, index) => <li key={step} className={index === current ? "on" : index < current ? "done" : ""} aria-current={index === current ? "step" : undefined}><span aria-hidden="true">{index < current ? <Check /> : index + 1}</span>{step}</li>)}</ol></div>;
}

export type Tile = { value: string; label: string; detail?: string; icon?: ReactNode; blocked?: string };

/** Big tappable choices. The replacement for a select in every game. */
export function Tiles({ options, value, onChange, label, columns = 3 }: { options: Tile[]; value: string; onChange: (value: string) => void; label: string; columns?: 2 | 3 | 4 }) {
  return <div className={`g-tiles g-tiles-${columns}`} role="group" aria-label={label}>{options.map(option => <button key={option.value} type="button" disabled={!!option.blocked} title={option.blocked} aria-pressed={value === option.value} className={value === option.value ? "g-tile on" : "g-tile"} onClick={() => onChange(option.value)}>{option.icon && <span className="g-tile-icon" aria-hidden="true">{option.icon}</span>}<strong>{option.label}</strong>{option.detail && <small>{option.detail}</small>}{option.blocked && <em><Lock aria-hidden="true" />{option.blocked}</em>}</button>)}</div>;
}

const audienceKey = (audience: Audience) => `${audience.kind}:${audience.ref ?? ""}`;

/** The audience picker shared by every game. Shows how many people it reaches. */
export function AudiencePicker({ world, kinds, value, onChange, anonymous = false, label, people }: { world: GameWorld; kinds: AudienceKind[]; value: Audience; onChange: (audience: Audience) => void; anonymous?: boolean; label: string; people?: Profile[] }) {
  const t = world.t;
  const choices: AudienceChoice[] = audienceChoices(world, kinds, anonymous);
  const person = kinds.includes("person");
  const [search, setSearch] = useState("");
  const chosen = world.people.find(candidate => candidate.id === value.ref);
  const matches = people?.filter(candidate => candidate.user_id !== world.me.id && candidate.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).slice(0, 6) ?? [];
  return <div className="g-audience">
    <Tiles label={label} columns={3} value={value.kind === "person" ? "person" : audienceKey(value)} onChange={key => { if (key === "person") onChange({ kind: "person", ref: value.kind === "person" ? value.ref : undefined }); else { const [kind, ref] = key.split(":"); onChange({ kind: kind as AudienceKind, ref: ref || undefined }); } }}
      options={[...choices.map(choice => ({ value: audienceKey({ kind: choice.kind, ref: choice.ref }), label: choice.label, detail: choice.reach === 1 ? t("1 persona", "1 persona") : t(`${choice.reach} personas`, `${choice.reach} persones`), icon: <Users />, blocked: choice.blocked })),
        ...(person ? [{ value: "person", label: t("Una persona", "Una persona"), detail: chosen?.name ?? t("Tú eliges a quién", "Tu tries a qui"), icon: <Users /> }] : [])]} />
    {value.kind === "person" && <div className="g-audience-search"><label className="sr-only" htmlFor="g-audience-person">{t("Buscar a alguien", "Buscar algú")}</label><input id="g-audience-person" className="g-input" type="search" autoComplete="off" placeholder={t("Escribe un nombre…", "Escriu un nom…")} value={search} onChange={event => setSearch(event.target.value)} />
      <div className="g-audience-results">{matches.map(candidate => <button type="button" key={candidate.user_id} aria-pressed={value.ref === candidate.user_id} className={value.ref === candidate.user_id ? "on" : ""} onClick={() => onChange({ kind: "person", ref: candidate.user_id })}><Avatar size="small" person={candidate} /><span>{candidate.name}<small>{candidate.degree}</small></span>{value.ref === candidate.user_id && <Check aria-hidden="true" />}</button>)}
      {!matches.length && <p className="g-muted">{search ? t("Nadie con ese nombre.", "Ningú amb eixe nom.") : t("Busca a quien quieras.", "Busca qui vulgues.")}</p>}</div></div>}
  </div>;
}

/** Suggested text you can use as it is, shuffle or edit. Writing from scratch stays optional. */
export function Suggestions({ options, onUse, label, seed = 0 }: { options: string[]; onUse: (text: string) => void; label: string; seed?: number }) {
  const [offset, setOffset] = useState(seed);
  const shown = [0, 1, 2].map(index => options[(offset + index) % options.length]).filter((value, index, list) => list.indexOf(value) === index);
  return <div className="g-suggestions"><div className="g-suggestions-head"><span>{label}</span><button type="button" onClick={() => setOffset(value => value + 3)} aria-label={label}><Dices aria-hidden="true" /></button></div><div className="g-suggestion-list">{shown.map(option => <button type="button" key={option} onClick={() => onUse(option)}>{option}</button>)}</div></div>;
}

/** A clock. `ring` draws the remaining share of a known total. */
export function Countdown({ until, total, label }: { until: string | null; total?: number; label?: string }) {
  const now = useTick(1000);
  const left = until ? Math.max(0, Date.parse(until) - now) : 0;
  const hours = Math.floor(left / 3600000), minutes = Math.floor(left / 60000) % 60, seconds = Math.floor(left / 1000) % 60;
  const text = hours >= 1 ? `${hours} h ${String(minutes).padStart(2, "0")} min` : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const share = total ? Math.max(0, Math.min(1, left / total)) : 1;
  return <div className="g-countdown" style={{ ["--g-share" as string]: share }}><span className="g-countdown-ring" aria-hidden="true" /><span className="g-countdown-text"><strong>{left ? text : "00:00"}</strong>{label && <small>{label}</small>}</span></div>;
}

/** One card at a time, with the position in the pile. The opposite of a list. */
export function Deck({ position, total, onSkip, skipLabel, children, empty }: { position: number; total: number; onSkip?: () => void; skipLabel?: string; children: ReactNode; empty?: ReactNode }) {
  if (!total) return <>{empty}</>;
  return <div className="g-deck"><div className="g-deck-count"><span>{Math.min(position + 1, total)} / {total}</span>{onSkip && skipLabel && <button type="button" onClick={onSkip}>{skipLabel}<ArrowRight aria-hidden="true" /></button>}</div><div className="g-deck-card">{children}</div></div>;
}

export function PersonLine({ person, detail, right }: { person?: Profile; detail?: string; right?: ReactNode }) {
  return <div className="g-person"><Avatar size="small" person={person} /><span><strong>{person?.name ?? "—"}</strong>{detail && <small>{detail}</small>}</span>{right}</div>;
}

/** A result bar with its share. Used wherever a game shows what people chose. */
export function Bar({ label, share, total, accent = false }: { label: string; share: number; total?: number; accent?: boolean }) {
  return <div className={accent ? "g-bar on" : "g-bar"}><span className="g-bar-label">{label}</span><span className="g-bar-track" aria-hidden="true"><i style={{ width: `${Math.round(share * 100)}%` }} /></span><strong>{Math.round(share * 100)} %{total !== undefined && <small> · {total}</small>}</strong></div>;
}

/** The line that says who will see this and under what name. Never hidden in small print. */
export function IdentityNote({ children }: { children: ReactNode }) {
  return <p className="g-identity">{children}</p>;
}

export function Nothing({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return <div className="g-nothing"><h3>{title}</h3>{body && <p>{body}</p>}{action}</div>;
}

/** A short segmented switch, for two or three side-by-side values. */
export function Segmented({ options, value, onChange, label }: { options: { value: string; label: string }[]; value: string; onChange: (value: string) => void; label: string }) {
  return <div className="g-segmented" role="group" aria-label={label}>{options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value} className={value === option.value ? "on" : ""} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}

/** A message list that keeps itself scrolled to the newest line. */
export function Conversation({ children, live = true }: { children: ReactNode; live?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { const node = box.current; if (node) node.scrollTop = node.scrollHeight; });
  return <div className="g-conversation" ref={box} aria-live={live ? "polite" : undefined}>{children}</div>;
}

export function Bubble({ mine, who, children, muted = false }: { mine: boolean; who?: string; children: ReactNode; muted?: boolean }) {
  return <p className={`g-bubble ${mine ? "mine" : ""} ${muted ? "muted" : ""}`}>{who && <strong>{who}</strong>}<span>{children}</span></p>;
}

/** The single-line composer the conversation games share. */
export function Composer({ label, onSend, busy, maxLength = 600, quick }: { label: string; onSend: (text: string) => Promise<boolean>; busy: boolean; maxLength?: number; quick?: string[] }) {
  const [text, setText] = useState("");
  return <form className="g-composer" onSubmit={async event => { event.preventDefault(); const value = text.trim(); if (value && await onSend(value)) setText(""); }}>
    {quick && quick.length > 0 && <div className="g-quick">{quick.map(option => <button type="button" key={option} disabled={busy} onClick={() => void onSend(option)}>{option}</button>)}</div>}
    <div className="g-composer-row"><label className="sr-only" htmlFor="g-composer">{label}</label><input id="g-composer" className="g-input" value={text} onChange={event => setText(event.target.value)} placeholder={label} maxLength={maxLength} autoComplete="off" /><button type="submit" disabled={busy || !text.trim()}><ArrowRight aria-hidden="true" /><span className="sr-only">{label}</span></button></div>
  </form>;
}
