"use client";
import { useEffect, useState } from "react";
import { Clock3, Flag, Megaphone, PartyPopper, RotateCcw, Swords, Trophy, UserPlus, Users, Zap } from "lucide-react";
import { GameShell, useGame, type Game } from "./shared";
import { AudiencePicker, Bar, Countdown, GameHead, IdentityNote, Nothing, Segmented, Steps, Suggestions, Tiles, useTick, type Tile } from "./ui";
import { Action, Avatar } from "../controls";
import { useCommunity } from "../context";
import type { Audience } from "@/lib/community/games/types";
import type { DebateCard, DebateStance, State } from "@/lib/community/games/demo/debate";
import type { Profile } from "@/lib/community/types";
import "./defiende-lo-indefendible.css";

export default function DefiendeLoIndefendible() {
  const g = useGame<State>("debate");
  const state = g.state;
  if (!state) return <GameShell game={g}><></></GameShell>;
  const empty = !state.mine && !state.canPropose && state.others.length === 0;
  return <GameShell game={g}><div className="g-debate">
    <GameHead title={g.t("Defiende lo indefendible", "Defén l'indefensable")}
      body={g.t("Una afirmación absurda, tres turnos por persona y un público que aplaude y decide después quién argumentó mejor.", "Una afirmació absurda, tres torns per persona i un públic que aplaudix i decidix després qui va argumentar millor.")} />
    {state.mine && <DebateRing g={g} card={state.mine} />}
    {state.canPropose && <Propose g={g} suggestions={state.suggestions} />}
    {state.others.length > 0 && <section className="g-debate-others">
      <h3>{g.t("Para el público", "Per al públic")}</h3>
      <div className="g-debate-others-list">{state.others.map(card => <DebateRing key={card.id} g={g} card={card} compact />)}</div>
    </section>}
    {empty && <Nothing title={g.t("Nada por aquí todavía", "Encara no hi ha res per ací")} body={g.t("Propón una afirmación absurda y busca rival.", "Proposa una afirmació absurda i busca rival.")} />}
  </div></GameShell>;
}

// ---- proposing a debate ----------------------------------------------------

function Propose({ g, suggestions }: { g: Game<State>; suggestions: string[] }) {
  const t = g.t;
  const { data } = useCommunity();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [claim, setClaim] = useState("");
  const [mode, setMode] = useState<"open" | "direct" | "group">("open");
  const [audience, setAudience] = useState<Audience>({ kind: "campus" });
  const [groupAudience, setGroupAudience] = useState<Audience>({ kind: "group" });
  const [target, setTarget] = useState<Audience>({ kind: "person" });
  const [pace, setPace] = useState<"live" | "calm">("calm");
  const [coinToss, setCoinToss] = useState(true);

  if (!open) return <div className="g-panel g-debate-start">
    <Swords aria-hidden="true" />
    <div><h3>{t("¿Te atreves con un debate?", "T'atrevixes amb un debat?")}</h3><p>{t("Una afirmación, un rival y tres turnos para convencer al público.", "Una afirmació, un rival i tres torns per a convéncer el públic.")}</p></div>
    <Action onClick={() => setOpen(true)}>{t("Proponer un debate", "Proposar un debat")}</Action>
  </div>;

  const modeOptions: Tile[] = [
    { value: "open", label: t("Reto abierto", "Repte obert"), detail: t("La primera persona que acepte es tu rival.", "La primera persona que accepte és el teu rival."), icon: <Megaphone aria-hidden="true" /> },
    { value: "direct", label: t("Reto directo", "Repte directe"), detail: t("Eliges tú a quién retas.", "Tries tu a qui reptes."), icon: <UserPlus aria-hidden="true" /> },
    { value: "group", label: t("Debate de grupo", "Debat de grup"), detail: t("Dentro de uno de tus grupos.", "Dins d'un dels teus grups."), icon: <Users aria-hidden="true" /> },
  ];
  const canNext1 = claim.trim().length >= 8;
  const canNext2 = mode === "direct" ? !!target.ref : mode === "group" ? !!groupAudience.ref : true;

  const submit = async () => {
    const input: Record<string, unknown> = { claim: claim.trim(), mode, pace, coinToss };
    if (mode === "group") input.groupId = groupAudience.ref;
    else { input.audienceKind = audience.kind; input.audienceRef = audience.ref; }
    if (mode === "direct") input.targetId = target.ref;
    if (await g.act("propose", input)) { setOpen(false); setStep(0); setClaim(""); setTarget({ kind: "person" }); }
  };

  return <div className="g-panel g-debate-propose">
    <Steps steps={[t("Afirmación", "Afirmació"), t("Rival y público", "Rival i públic"), t("Ritmo", "Ritme")]} current={step} onBack={() => setStep(value => Math.max(0, value - 1))} />
    {step === 0 && <div className="g-stack">
      <IdentityNote>{t("Nada de política, religión, identidad ni personas reales: que sea una tontería sin importancia.", "Res de política, religió, identitat ni persones reals: que siga una ximpleria sense importància.")}</IdentityNote>
      <Suggestions label={t("Afirmaciones para calentar", "Afirmacions per a escalfar")} options={suggestions} onUse={setClaim} />
      <textarea className="g-input" rows={2} maxLength={140} value={claim} onChange={event => setClaim(event.target.value)} placeholder={t("O escribe la tuya…", "O escriu la teua…")} />
      <div className="g-actions"><Action disabled={!canNext1} onClick={() => setStep(1)}>{t("Siguiente", "Següent")}</Action></div>
    </div>}
    {step === 1 && <div className="g-stack">
      <Tiles label={t("Cómo empieza", "Com comença")} columns={3} value={mode} onChange={value => setMode(value as typeof mode)} options={modeOptions} />
      {mode === "group"
        ? <AudiencePicker world={g.world} kinds={["group"]} value={groupAudience} onChange={setGroupAudience} label={t("Elige el grupo", "Tria el grup")} />
        : <>
          {mode === "direct" && <AudiencePicker world={g.world} kinds={["person"]} value={target} onChange={setTarget} label={t("A quién retas", "A qui reptes")} people={data.profiles} />}
          <AudiencePicker world={g.world} kinds={["campus", "degree", "course", "group"]} value={audience} onChange={setAudience} label={t("Quién forma el público", "Qui forma el públic")} />
        </>}
      <div className="g-actions"><Action disabled={!canNext2} onClick={() => setStep(2)}>{t("Siguiente", "Següent")}</Action></div>
    </div>}
    {step === 2 && <div className="g-stack">
      <Tiles label={t("Ritmo", "Ritme")} columns={2} value={pace} onChange={value => setPace(value as typeof pace)} options={[
        { value: "live", label: t("En directo", "En directe"), detail: t("Tres minutos por turno.", "Tres minuts per torn."), icon: <Zap aria-hidden="true" /> },
        { value: "calm", label: t("Con calma", "Amb calma"), detail: t("Doce horas por turno.", "Dotze hores per torn."), icon: <Clock3 aria-hidden="true" /> },
      ]} />
      <div className="g-debate-coin-choice">
        <span className="g-muted">{t("¿Se sortean las posturas?", "Se sortegen les postures?")}</span>
        <Segmented label={t("Sorteo de posturas", "Sorteig de postures")} value={coinToss ? "yes" : "no"} onChange={value => setCoinToss(value === "yes")}
          options={[{ value: "yes", label: t("Sortear", "Sortejar") }, { value: "no", label: t("Me quedo defendiendo", "Em quede defenent") }]} />
      </div>
      <div className="g-actions"><Action disabled={g.busy} onClick={() => void submit()}>{t("Lanzar el debate", "Llançar el debat")}</Action></div>
    </div>}
  </div>;
}

// ---- the ring, in every state it can be in --------------------------------

function DebateRing({ g, card, compact = false }: { g: Game<State>; card: DebateCard; compact?: boolean }) {
  const t = g.t;
  const proposer = g.person(card.proposer.id);
  const opponent = card.opponent ? g.person(card.opponent.id) : undefined;

  // The coin spin is a purely visual CSS animation; once it has had time to play,
  // read again so a stored coinRevealAt in the past flips the status to "live".
  useEffect(() => {
    if (card.status !== "coin") return;
    const timer = window.setTimeout(() => void g.refresh(), 2600);
    return () => window.clearTimeout(timer);
  }, [card.status, card.id, g]);

  return <article className={`g-ring g-ring-${card.status}${compact ? " compact" : ""}`}>
    <header className="g-ring-claim">
      <p>{card.claim}</p>
      <div className="g-ring-claim-meta">
        <span className="g-muted">{card.audienceLabel} · {t(`${card.reach} personas`, `${card.reach} persones`)}</span>
        {card.canReport && <button type="button" className="g-ring-report" onClick={() => void g.act("report", { id: card.id })} aria-label={t("Denunciar la afirmación", "Denunciar l'afirmació")}><Flag aria-hidden="true" /></button>}
        {card.reported && <span className="g-muted">{t("Denunciada", "Denunciada")}</span>}
      </div>
    </header>
    {card.status === "open" && <OpenState g={g} card={card} />}
    {card.status === "pending" && <PendingState g={g} card={card} />}
    {card.status === "coin" && <CoinState g={g} card={card} proposer={proposer} opponent={opponent} />}
    {card.status === "live" && <LiveState g={g} card={card} proposer={proposer} opponent={opponent} />}
    {card.status === "voting" && <VotingState g={g} card={card} proposer={proposer} opponent={opponent} />}
    {card.status === "verdict" && <VerdictState g={g} card={card} proposer={proposer} opponent={opponent} />}
    {card.status === "abandoned" && <AbandonedState g={g} card={card} />}
  </article>;
}

function OpenState({ g, card }: { g: Game<State>; card: DebateCard }) {
  const t = g.t;
  if (card.amProposer) return <div className="g-ring-wait">
    <p role="status">{t("Buscando rival: esperando a quien se atreva.", "Buscant rival: esperant qui s'atrevisca.")}</p>
    <div className="g-actions">
      <Action secondary onClick={() => void g.act("cancel", { id: card.id })}>{t("Retirar el reto", "Retirar el repte")}</Action>
      <Action onClick={() => void g.act("demoAccept", { id: card.id })}>{t("Demo: alguien acepta el reto", "Demo: algú accepta el repte")}</Action>
    </div>
  </div>;
  if (card.canAcceptOpen) return <div className="g-ring-wait">
    <p>{t("¿Te atreves a ser el rival?", "T'atrevixes a ser el rival?")}</p>
    <Action onClick={() => void g.act("accept", { id: card.id })}>{t("Aceptar el reto", "Acceptar el repte")}</Action>
  </div>;
  return <p className="g-muted">{t("Esperando a que alguien acepte el reto.", "Esperant que algú accepte el repte.")}</p>;
}

function PendingState({ g, card }: { g: Game<State>; card: DebateCard }) {
  const t = g.t;
  if (card.amProposer) return <div className="g-ring-wait">
    <p role="status">{t(`Esperando respuesta de ${card.targetName ?? "tu rival"}. Tiene 48 horas.`, `Esperant resposta de ${card.targetName ?? "el teu rival"}. Té 48 hores.`)}</p>
    <div className="g-actions">
      <Action secondary onClick={() => void g.act("cancel", { id: card.id })}>{t("Retirar el reto", "Retirar el repte")}</Action>
      <Action onClick={() => void g.act("demoAccept", { id: card.id })}>{t("Demo: el rival acepta", "Demo: el rival accepta")}</Action>
    </div>
  </div>;
  if (card.canAcceptDirect) return <div className="g-ring-wait">
    <p role="status">{t("Te han retado a un debate.", "T'han reptat a un debat.")}</p>
    <div className="g-actions">
      <Action onClick={() => void g.act("accept", { id: card.id })}>{t("Aceptar", "Acceptar")}</Action>
      <Action secondary onClick={() => void g.act("decline", { id: card.id })}>{t("Declinar", "Declinar")}</Action>
    </div>
  </div>;
  return null;
}

function CoinState({ g, proposer, opponent }: { g: Game<State>; card: DebateCard; proposer?: Profile; opponent?: Profile }) {
  const t = g.t;
  return <div className="g-coin-flip" role="status">
    <span className="g-coin" aria-hidden="true"><span className="g-coin-face g-coin-front">{t("DEFIENDE", "DEFÉN")}</span><span className="g-coin-face g-coin-back">{t("ATACA", "ATACA")}</span></span>
    <p>{t("Sorteando las posturas…", "Sortejant les postures…")}</p>
    <p className="g-muted">{proposer?.name ?? "—"} · {opponent?.name ?? "—"}</p>
  </div>;
}

function Corner({ person, stance, mine, t }: { person?: Profile; stance: DebateStance | null; mine: boolean; t: (es: string, va: string) => string }) {
  return <div className={`g-ring-corner${mine ? " mine" : ""}`}>
    <Avatar person={person} />
    <strong>{person?.name ?? "—"}</strong>
    {stance && <span className={`g-stance g-stance-${stance}`}>{stance === "defends" ? t("Defiende", "Defén") : t("Ataca", "Ataca")}</span>}
  </div>;
}

function LiveState({ g, card, proposer, opponent }: { g: Game<State>; card: DebateCard; proposer?: Profile; opponent?: Profile }) {
  const t = g.t;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useTick(1000);
  const submit = async () => {
    const value = text.trim();
    if (!value) return;
    setBusy(true);
    if (await g.act("turn", { id: card.id, text: value })) setText("");
    setBusy(false);
  };
  return <div className="g-ring-live">
    <div className="g-ring-corners">
      <Corner person={proposer} stance={card.proposer.stance} mine={card.amProposer} t={t} />
      <span className="g-ring-vs" aria-hidden="true">{t("VS", "VS")}</span>
      <Corner person={opponent} stance={card.opponent?.stance ?? null} mine={card.amOpponent} t={t} />
    </div>
    <ol className="g-ring-turns">{card.turns.map(turn => <li key={turn.index} className={turn.mine ? "mine" : ""}>
      {turn.expired
        ? <p className="g-muted g-ring-skip">{t(`${turn.byName} agotó su tiempo. Pierde el turno.`, `${turn.byName} va esgotar el seu temps. Perd el torn.`)}</p>
        : <>
          <strong>{turn.byName}</strong>
          <p>{turn.text}</p>
          {!card.amRival && <button type="button" className={turn.clapped ? "g-clap on" : "g-clap"} disabled={turn.clapped} onClick={() => void g.act("clap", { id: card.id, turnIndex: turn.index })} aria-pressed={turn.clapped}>
            <PartyPopper aria-hidden="true" />{turn.claps}
          </button>}
          {card.amRival && <span className="g-clap-count"><PartyPopper aria-hidden="true" />{turn.claps}</span>}
        </>}
    </li>)}</ol>
    {card.amRival && <p className="g-muted">{t(`Te quedan ${card.turnsLeftMine} de 3 turnos.`, `Et queden ${card.turnsLeftMine} de 3 torns.`)}</p>}
    {card.isMyTurn
      ? <div className="g-ring-turn-form">
        <Countdown until={card.turnDeadline} total={card.turnSeconds * 1000} label={t("Te toca a ti", "Et toca a tu")} />
        <textarea className="g-input" rows={3} maxLength={600} value={text} onChange={event => setText(event.target.value)} placeholder={t("Convence al público…", "Convenç el públic…")} />
        <div className="g-actions"><Action disabled={busy || !text.trim()} onClick={() => void submit()}>{t("Enviar turno", "Enviar torn")}</Action></div>
      </div>
      : <div className="g-ring-turn-wait">
        <Countdown until={card.turnDeadline} total={card.turnSeconds * 1000} label={card.turnUserName ? t(`${card.turnUserName} está escribiendo su turno`, `${card.turnUserName} està escrivint el seu torn`) : ""} />
        {card.canDemoTurn && <Action secondary onClick={() => void g.act("demoTurn", { id: card.id })}>{t("Demo: el rival escribe su turno", "Demo: el rival escriu el seu torn")}</Action>}
      </div>}
    {card.canDemoClap && <Action secondary onClick={() => void g.act("demoClap", { id: card.id })}>{t("Demo: el público aplaude", "Demo: el públic aplaudix")}</Action>}
  </div>;
}

function VotingState({ g, card, proposer, opponent }: { g: Game<State>; card: DebateCard; proposer?: Profile; opponent?: Profile }) {
  const t = g.t;
  useTick(60000);
  return <div className="g-ring-voting">
    <p role="status">{t("Turnos cerrados. Vota quién argumentó mejor, no quién tenía razón. El recuento se ve al cerrar la votación.", "Torns tancats. Vota qui va argumentar millor, no qui tenia raó. El recompte es veu en tancar la votació.")}</p>
    <Countdown until={card.votingDeadline} label={t("Cierra en", "Tanca en")} />
    {card.canVote && <div className="g-ring-vote-options">
      <button type="button" className="g-ring-vote" onClick={() => void g.act("vote", { id: card.id, winner: card.proposer.id })}><Avatar person={proposer} /><span>{proposer?.name}</span></button>
      <button type="button" className="g-ring-vote" onClick={() => card.opponent && void g.act("vote", { id: card.id, winner: card.opponent.id })}><Avatar person={opponent} /><span>{opponent?.name}</span></button>
    </div>}
    {!card.canVote && card.myVote && <p className="g-muted">{t("Ya has votado. Gracias.", "Ja has votat. Gràcies.")}</p>}
    {!card.canVote && !card.myVote && card.amRival && <p className="g-muted">{t("Los rivales no votan su propio debate.", "Els rivals no voten el seu propi debat.")}</p>}
    {card.canDemoVotes && <Action secondary onClick={() => void g.act("demoVotes", { id: card.id })}>{t("Demo: simular los votos del público", "Demo: simular els vots del públic")}</Action>}
  </div>;
}

function VerdictState({ g, card, proposer, opponent }: { g: Game<State>; card: DebateCard; proposer?: Profile; opponent?: Profile }) {
  const t = g.t;
  void proposer; void opponent;
  return <div className="g-ring-verdict">
    <Trophy aria-hidden="true" />
    <h4>{card.winner === "tie" ? t("Empate técnico", "Empat tècnic") : t(`Gana ${card.winnerName ?? "—"}`, `Guanya ${card.winnerName ?? "—"}`)}</h4>
    {card.winnerShare !== undefined && <Bar label={card.winnerName ?? ""} share={card.winnerShare / 100} total={card.totalVotes} accent />}
    {card.bestTurn && <div className="g-ring-best">
      <span className="g-muted">{t("El turno más aplaudido", "El torn més aplaudit")}</span>
      <p>“{card.bestTurn.text}”</p>
      <small>{card.bestTurn.byName} · {card.bestTurn.claps} <PartyPopper aria-hidden="true" /></small>
    </div>}
    {card.canRematch && <div className="g-actions"><Action onClick={() => void g.act("rematch", { id: card.id })}><RotateCcw aria-hidden="true" />{t("Revancha con las posturas cambiadas", "Revenja amb les postures canviades")}</Action></div>}
  </div>;
}

function AbandonedState({ g, card }: { g: Game<State>; card: DebateCard }) {
  const t = g.t;
  void g;
  const text = card.outcome === "declined" ? t("El reto fue declinado.", "El repte va ser declinat.")
    : card.outcome === "cancelled" ? t("Retiraste este reto.", "Vas retirar este repte.")
    : card.outcome === "forfeit" ? t(`Gana ${card.winnerName ?? "el rival"} por abandono.`, `Guanya ${card.winnerName ?? "el rival"} per abandonament.`)
    : t("El reto caducó sin encontrar rival.", "El repte va caducar sense trobar rival.");
  return <div className="g-ring-abandoned"><p role="status">{text}</p></div>;
}
