"use client";
import { useState } from "react";
import { Flame, MessageCircle, RotateCcw, Sparkles, Users } from "lucide-react";
import { GameShell, useGame, useGameTarget, type Game } from "./shared";
import { GameHead, Steps, Suggestions, AudiencePicker, Deck, PersonLine, Bar, IdentityNote, Nothing, Countdown, Tiles } from "./ui";
import { Action } from "../controls";
import { useCommunity } from "../context";
import type { GroupRoundView, State, TruthRound } from "@/lib/community/games/demo/truth";
import type { Audience } from "@/lib/community/games/types";
import type { Profile } from "@/lib/community/types";
import "./dos-verdades.css";

const starters = ["Una vez…", "Nunca he…", "Tengo…", "Sé…"];
const isActive = (round: TruthRound) => !!round.expires && Date.parse(round.expires) > Date.now();

export default function DosVerdades() {
  const g = useGame<State>("truth");
  return g.state ? <Screen g={g} state={g.state} /> : <GameShell game={g}><></></GameShell>;
}

// Mounted once the first state exists, so where it starts can depend on it.
function Screen({ g, state }: { g: Game<State>; state: State }) {
  const { data } = useCommunity();
  // Coming from someone's profile: their round if they have one I have not
  // played, otherwise a direct challenge to them.
  const target = useGameTarget();
  const [theirs] = useState(() => target ? state.deck.find(round => round.owner === target && !round.played)?.id ?? null : null);
  const challenge = !!target && !theirs;
  const [creating, setCreating] = useState(challenge);
  const [step, setStep] = useState(0);
  const [cards, setCards] = useState<[string, string, string]>(["", "", ""]);
  const [lieIndex, setLieIndex] = useState<number | null>(null);
  const [audience, setAudience] = useState<Audience>(challenge && target ? { kind: "person", ref: target } : { kind: "campus" });
  // Keep the active round by id. The demo refreshes the deck after a guess,
  // so tracking only an array position can swap the card out before its
  // result is shown.
  const [deckRoundId, setDeckRoundId] = useState<string | null>(theirs);
  const t = g.t;

  const start = (preset?: Audience) => { setCreating(true); setStep(0); setCards(["", "", ""]); setLieIndex(null); setAudience(preset ?? { kind: "campus" }); };
  const cancel = () => setCreating(false);
  const setCard = (index: number, text: string) => setCards(current => { const next = [...current] as [string, string, string]; next[index] = text; return next; });
  const trimmed = cards.map(card => card.trim());
  const validCards = trimmed.every(text => text.length > 0 && text.length <= 180) && new Set(trimmed.map(text => text.toLocaleLowerCase())).size === 3;
  const canPublish = validCards && lieIndex !== null;

  const publish = async () => {
    if (lieIndex === null) return;
    const ok = await g.act("create", { cards: cards.map((text, index) => ({ text: text.trim(), lie: index === lieIndex })), audience });
    if (ok) setCreating(false);
  };

  const deck = state.deck;
  const selectedPosition = deckRoundId ? deck.findIndex(round => round.id === deckRoundId) : -1;
  const position = selectedPosition >= 0 ? selectedPosition : 0;
  const current = deck[position];
  const next = () => {
    if (!current) return;
    const nextRound = deck[position + 1];
    if (nextRound) setDeckRoundId(nextRound.id);
  };
  const guess = async (index: number) => {
    if (!current) return;
    // Set this before the async action completes so the revealed round stays
    // mounted when the returned state reorders or refreshes the deck.
    setDeckRoundId(current.id);
    await g.act("play", { round: current.id, guess: index });
  };

  const myGroups = g.world.groups.filter(group => group.members.includes(g.world.me.id));
  const groupState = state.groups;
  const launchable = myGroups.filter(group => !groupState.some(entry => entry.group === group.id && entry.active));

  return <GameShell game={g}>
    <div className="g-truth">
      <GameHead title={t("Dos verdades y una trola", "Dues veritats i una mentida")}
        body={t("Tres frases sobre ti. Una es mentira. Adivinarla es la excusa para empezar a hablar.", "Tres frases sobre tu. Una és mentida. Endevinar-la és l'excusa per a començar a parlar.")}
        aside={state.streak > 0 ? <span className="g-truth-streak"><Flame aria-hidden="true" />{t(`Racha de ${state.streak}`, `Ratxa de ${state.streak}`)}</span> : undefined} />

      {!creating && <Action onClick={() => start()}><Sparkles aria-hidden="true" />{t("Crear una ronda", "Crear una ronda")}</Action>}

      {creating && <div className="g-panel g-stack">
        <Steps steps={[t("Tus tres frases", "Les teues tres frases"), t("Para quién", "Per a qui")]} current={step} onBack={step > 0 ? () => setStep(0) : cancel} />

        {step === 0 && <div className="g-stack">
          <p className="g-muted">{t("Escribe tres frases sobre ti. Luego dale la vuelta a la que es mentira.", "Escriu tres frases sobre tu. Després gira la que és mentida.")}</p>
          {cards.map((text, index) => <div key={index} className={`g-truth-card g-truth-edit ${lieIndex === index ? "lie" : ""}`}>
            <div className="g-truth-face">
              <textarea className="g-input" maxLength={180} rows={2} placeholder={t("Escribe algo sobre ti…", "Escriu alguna cosa sobre tu…")} value={text} onChange={event => setCard(index, event.target.value)} />
              <Suggestions label={t("Ideas", "Idees")} seed={index} options={starters} onUse={value => setCard(index, value)} />
            </div>
            <button type="button" className="g-truth-flag" aria-pressed={lieIndex === index} onClick={() => setLieIndex(current => current === index ? null : index)}>
              <RotateCcw aria-hidden="true" />{lieIndex === index ? t("Esta es la mentira", "Esta és la mentida") : t("Marcar como mentira", "Marcar com a mentida")}
            </button>
          </div>)}
          <div className="g-actions"><Action disabled={!validCards || lieIndex === null} onClick={() => setStep(1)}>{t("Siguiente", "Següent")}</Action></div>
        </div>}

        {step === 1 && <div className="g-stack">
          <AudiencePicker world={g.world} kinds={state.audienceKinds} value={audience} onChange={setAudience} people={data.profiles} label={t("¿Para quién es esta ronda?", "Per a qui és esta ronda?")} />
          <IdentityNote><Users aria-hidden="true" />{t("Va con tu nombre y tu foto. No hay rondas anónimas en este juego.", "Va amb el teu nom i la teua foto. No hi ha rondes anònimes en este joc.")}</IdentityNote>
          <div className="g-actions"><Action disabled={g.busy || !canPublish} onClick={() => void publish()}>{g.busy ? t("Publicando…", "Publicant…") : t("Publicar ronda", "Publicar ronda")}</Action></div>
        </div>}
      </div>}

      <section className="g-stack">
        <GameHead title={t("Juega", "Juga")} body={t("Una carta cada vez. Toca la que crees que es la trola.", "Una carta cada vegada. Toca la que creus que és la mentida.")} />
        <Deck position={position} total={deck.length} onSkip={current?.played && position < deck.length - 1 ? next : undefined} skipLabel={t("Siguiente ronda", "Següent ronda")}
          empty={<Nothing title={t("No hay rondas para ti ahora mismo", "No hi ha rondes per a tu ara mateix")} body={t("Vuelve más tarde o crea la tuya para empezar algo.", "Torna més tard o crea la teua per a començar alguna cosa.")} />}>
          {current && <RoundCard round={current} person={g.person(current.owner)} onGuess={guess} onChat={id => void g.chat(id)} busy={g.busy} t={t} />}
        </Deck>
      </section>

      <section className="g-stack">
        <GameHead title={t("Mis rondas", "Les meues rondes")} />
        {!state.mine.length && <Nothing title={t("Aún no has creado ninguna", "Encara no has creat cap")} body={t("Crea tu primera ronda de tres frases.", "Crea la teua primera ronda de tres frases.")} />}
        {state.mine.map(round => <MyRoundCard key={round.id} round={round} t={t} busy={g.busy} onDemoPlay={() => void g.act("demoPlay", { round: round.id })} />)}
      </section>

      {(groupState.length > 0 || launchable.length > 0) && <section className="g-stack">
        <GameHead title={t("Ronda de grupo", "Ronda de grup")} body={t("Tres días. Cada miembro publica la suya y juega las de los demás.", "Tres dies. Cada membre publica la seua i juga les dels altres.")} />
        {groupState.map(entry => <GroupRoundCard key={entry.id} entry={entry} t={t}
          onPublish={() => start({ kind: "group", ref: entry.group })} />)}
        {launchable.length > 0 && <Tiles label={t("Lanzar una ronda de grupo", "Llançar una ronda de grup")} columns={3} value=""
          options={launchable.map(group => ({ value: group.id, label: group.name, detail: t("Empezar ronda de grupo", "Començar ronda de grup") }))}
          onChange={value => void g.act("startGroupRound", { group: value })} />}
      </section>}
    </div>
  </GameShell>;
}

function RoundCard({ round, person, onGuess, onChat, busy, t }: { round: TruthRound; person?: Profile; onGuess: (index: number) => void; onChat: (id: string) => void; busy: boolean; t: (es: string, va: string) => string }) {
  return <div className="g-truth-round">
    <PersonLine person={person} detail={round.audienceLabel} right={isActive(round) ? <Countdown until={round.expires} /> : undefined} />
    <div className="g-truth-cards">
      {round.cards.map((card, index) => {
        if (!round.played) return <button key={index} type="button" className="g-truth-card g-truth-guess" disabled={busy} onClick={() => onGuess(index)}>{card.text}</button>;
        return <div key={index} className={`g-truth-card g-truth-revealed ${card.lie ? "lie" : "truth"} ${card.picked ? "picked" : ""}`}>
          <p>{card.text}</p>
          <Bar label={card.lie ? t("La trola", "La mentida") : t("Verdad", "Veritat")} share={card.share ?? 0} total={round.playedCount} accent={!!card.picked} />
          {!card.lie && <Action secondary onClick={() => onChat(round.owner)}><MessageCircle aria-hidden="true" />{t("Cuéntame más", "Conta'm més")}</Action>}
        </div>;
      })}
    </div>
    {round.played && <p className="g-muted" role="status">{round.correct ? t("Has acertado la trola.", "Has encertat la mentida.") : t("Esta vez te ha engañado.", "Esta vegada t'ha enganyat.")}</p>}
  </div>;
}

function MyRoundCard({ round, t, busy, onDemoPlay }: { round: TruthRound; t: (es: string, va: string) => string; busy: boolean; onDemoPlay: () => void }) {
  const active = isActive(round);
  return <div className="g-truth-round g-truth-mine">
    <div className="g-row" style={{ justifyContent: "space-between" }}>
      <strong>{round.audienceLabel}</strong>
      {active ? <Countdown until={round.expires} /> : <span className="g-muted">{t("Terminada", "Acabada")}</span>}
    </div>
    <p className="g-muted">{round.playedCount ? t(`${round.playedCount} personas han jugado · has engañado a ${round.deceived}`, `${round.playedCount} persones han jugat · has enganyat ${round.deceived}`) : t("Nadie ha jugado todavía.", "Encara ningú ha jugat.")}</p>
    <div className="g-truth-cards g-truth-cards-compact">
      {round.cards.map((card, index) => <div key={index} className={`g-truth-card g-truth-revealed small ${card.lie ? "lie" : "truth"}`}>
        <p>{card.text}</p>
        <Bar label={card.lie ? t("La trola", "La mentida") : t("Verdad", "Veritat")} share={card.share ?? 0} total={round.playedCount} accent={card.lie} />
      </div>)}
    </div>
    {active && <Action secondary onClick={onDemoPlay} disabled={busy}>{t("Demo: que alguien juegue tu ronda", "Demo: que algú jugue la teua ronda")}</Action>}
  </div>;
}

function GroupRoundCard({ entry, t, onPublish }: { entry: GroupRoundView; t: (es: string, va: string) => string; onPublish: () => void }) {
  return <div className="g-panel-soft g-stack">
    <div className="g-row" style={{ justifyContent: "space-between" }}>
      <strong>{entry.groupName}</strong>
      {entry.active ? <Countdown until={entry.expires} /> : <span className="g-muted">{t("Terminada", "Acabada")}</span>}
    </div>
    <p className="g-muted">{t(`${entry.posted} de ${entry.members} ya han publicado la suya.`, `${entry.posted} de ${entry.members} ja han publicat la seua.`)}</p>
    {entry.active && !entry.myRound && <Action onClick={onPublish}>{t("Publicar la mía para el grupo", "Publicar la meua per al grup")}</Action>}
    {entry.finished && entry.summary && (entry.summary.mostDeceiving || entry.summary.mostAccurate) && <p className="g-muted">
      {entry.summary.mostDeceiving && t(`Quien más engañó: ${entry.summary.mostDeceiving}.`, `Qui més va enganyar: ${entry.summary.mostDeceiving}.`)}{" "}
      {entry.summary.mostAccurate && t(`Quien más acertó: ${entry.summary.mostAccurate}.`, `Qui més va encertar: ${entry.summary.mostAccurate}.`)}
    </p>}
  </div>;
}
