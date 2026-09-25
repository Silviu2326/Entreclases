"use client";
import { useState } from "react";
import { Gavel, Scale, Sparkles, ThumbsUp, Trash2 } from "lucide-react";
import { audienceReach } from "@/lib/community/games/audience";
import { minAnonymousAudience, type Audience, type AudienceKind } from "@/lib/community/games/types";
import type { ArgumentView, CaseView, Choice, State } from "@/lib/community/games/demo/jury";
import { Action, Confirm } from "../controls";
import { type Game, GameShell, useGame } from "./shared";
import { AudiencePicker, Bar, Countdown, Deck, GameHead, IdentityNote, Nothing, PersonLine, Steps, Suggestions, Tiles } from "./ui";
import "./jurado-del-campus.css";

const audienceKinds: AudienceKind[] = ["campus", "degree", "course", "group"];
const DAY = 24 * 3600000;

const dilemmaSuggestions: ReadonlyArray<readonly [string, string]> = [
  ["¿Está mal irse de un grupo de trabajo a una semana de la entrega?", "Està mal anar-se'n d'un grup de treball a una setmana del lliurament?"],
  ["¿Se puede cambiar de piso a mitad de curso sin dar explicaciones?", "Es pot canviar de pis a mitjan curs sense donar explicacions?"],
  ["¿Hay que avisar antes de dejar de ir a las clases de una asignatura?", "Cal avisar abans de deixar d'anar a classe d'una assignatura?"],
  ["¿Está mal no devolver los apuntes que te prestan?", "Està mal no tornar els apunts que et deixen?"],
  ["¿Se puede cancelar un plan el mismo día si surge algo mejor?", "Es pot cancel·lar un pla el mateix dia si sorgeix una cosa millor?"],
  ["¿Hay que repartir los gastos de un viaje en grupo exactamente igual?", "Cal repartir les despeses d'un viatge en grup exactament igual?"],
];

export default function JuradoDelCampus() {
  const g = useGame<State>("jury");
  const [creating, setCreating] = useState(false);
  return <GameShell game={g}>{g.state && (creating
    ? <CreateCase g={g} onDone={() => setCreating(false)} />
    : <Browse g={g} onCreate={() => setCreating(true)} />)}</GameShell>;
}

function Browse({ g, onCreate }: { g: Game<State>; onCreate: () => void }) {
  const s = g.state as State;
  const [index, setIndex] = useState(0);
  const deck = s.deck;
  const safeIndex = deck.length ? Math.min(index, deck.length - 1) : 0;
  return <div className="g-jury">
    <GameHead title={g.t("El jurado del campus", "El jurat del campus")}
      body={g.t("Un dilema, dos posturas y el veredicto de la gente. Vota a ciegas y después argumenta.", "Un dilema, dues postures i el veredicte de la gent. Vota a cegues i després argumenta.")}
      aside={<Action onClick={onCreate} disabled={!s.canCreate}>{g.t("Abrir un caso", "Obrir un cas")}</Action>} />
    {!s.canCreate && <p className="g-muted">{g.t("Ya tienes dos casos abiertos. Cierra o retira uno antes de abrir otro.", "Ja tens dos casos oberts. Tanca'n o retira'n un abans d'obrir-ne un altre.")}</p>}

    {s.weekly && <section className="g-jury-section">
      <h3 className="g-jury-section-title"><Gavel aria-hidden="true" />{g.t("Caso de la semana", "Cas de la setmana")}</h3>
      <CaseCard g={g} view={s.weekly} />
    </section>}

    <section className="g-jury-section">
      <h3 className="g-jury-section-title">{g.t("Para juzgar", "Per a jutjar")}</h3>
      <Deck position={safeIndex} total={deck.length} skipLabel={g.t("Siguiente caso", "Cas següent")}
        onSkip={safeIndex < deck.length - 1 ? () => setIndex(safeIndex + 1) : undefined}
        empty={<Nothing title={g.t("No hay más casos que juzgar", "No hi ha més casos per a jutjar")} body={g.t("Vuelve más tarde o abre tú el primer caso.", "Torna més tard o obri tu el primer cas.")} />}>
        {deck[safeIndex] && <CaseCard g={g} view={deck[safeIndex]} />}
      </Deck>
    </section>

    {s.mine.length > 0 && <section className="g-jury-section">
      <h3 className="g-jury-section-title">{g.t("Mis casos", "Els meus casos")}</h3>
      <div className="g-jury-mine-list">{s.mine.map(view => <div key={view.id} className="g-jury-mine-item">
        <CaseCard g={g} view={view} />
        <Confirm title={g.t("¿Retirar este caso?", "Retirar este cas?")} description={g.t("Desaparecerá para todo el mundo y no se puede deshacer.", "Desapareixerà per a tothom i no es pot desfer.")} onConfirm={() => g.act("withdraw", { caseId: view.id })}>
          <Action secondary><Trash2 aria-hidden="true" />{g.t("Retirar", "Retirar")}</Action>
        </Confirm>
      </div>)}</div>
    </section>}
  </div>;
}

function CaseHeader({ g, view }: { g: Game<State>; view: CaseView }) {
  const person = view.ownerId ? g.person(view.ownerId) : undefined;
  return <div className="g-jury-head">
    {view.weekly
      ? <span className="g-jury-owner g-jury-owner-weekly"><Gavel aria-hidden="true" />{view.ownerName}</span>
      : person
        ? <PersonLine person={person} detail={view.audienceLabel} />
        : <span className="g-jury-owner">{view.ownerName}<small>{view.audienceLabel}</small></span>}
    {view.mine && <span className="g-jury-badge">{g.t("Tuyo", "Teu")}</span>}
    {view.status === "open" && <Countdown until={view.expires} total={3 * DAY} label={g.t("quedan", "queden")} />}
  </div>;
}

function CaseCard({ g, view }: { g: Game<State>; view: CaseView }) {
  const [busy, setBusy] = useState(false);
  const act = async (command: string, input: Record<string, unknown> = {}) => {
    setBusy(true);
    const ok = await g.act(command, { caseId: view.id, ...input });
    setBusy(false);
    return ok;
  };

  if (view.status === "closed") return <VerdictCard g={g} view={view} />;

  if (view.myVote === null) {
    return <div className="g-jury-card">
      <CaseHeader g={g} view={view} />
      <p className="g-jury-dilemma">{view.dilemma}</p>
      <Tiles label={g.t("Vota a ciegas", "Vota a cegues")} columns={2} value=""
        options={[{ value: "a", label: view.stanceA }, { value: "b", label: view.stanceB }]}
        onChange={choice => void act("vote", { choice })} />
      {view.canDemoVote && <p className="g-jury-demo"><Action secondary disabled={busy} onClick={() => void act("demoVote")}>{g.t("Demo: simular un voto", "Demo: simular un vot")}</Action></p>}
    </div>;
  }

  return <div className="g-jury-card">
    <CaseHeader g={g} view={view} />
    <p className="g-jury-dilemma">{view.dilemma}</p>
    <div className="g-jury-result" role="status">
      <Bar label={view.stanceA} share={view.shareA} total={view.totalVotes} accent={view.myVote === "a"} />
      <Bar label={view.stanceB} share={view.shareB} total={view.totalVotes} accent={view.myVote === "b"} />
    </div>
    {(view.breakdownDegree || view.breakdownCourse) && <div className="g-jury-breakdown">
      {view.breakdownDegree && <BreakdownRow g={g} label={g.t("Tu carrera", "La teua carrera")} data={view.breakdownDegree} stanceA={view.stanceA} stanceB={view.stanceB} />}
      {view.breakdownCourse && <BreakdownRow g={g} label={g.t("Tu curso", "El teu curs")} data={view.breakdownCourse} stanceA={view.stanceA} stanceB={view.stanceB} />}
    </div>}
    {view.canDemoVote && <p className="g-jury-demo"><Action secondary disabled={busy} onClick={() => void act("demoVote")}>{g.t("Demo: simular un voto", "Demo: simular un vot")}</Action></p>}
    <Deliberation g={g} view={view} act={act} busy={busy} />
  </div>;
}

function BreakdownRow({ g, label, data, stanceA, stanceB }: { g: Game<State>; label: string; data: { shareA: number; shareB: number; total: number }; stanceA: string; stanceB: string }) {
  return <div className="g-jury-breakdown-row">
    <p className="g-muted">{label} · {g.t(`${data.total} votos`, `${data.total} vots`)}</p>
    <Bar label={stanceA} share={data.shareA} />
    <Bar label={stanceB} share={data.shareB} />
  </div>;
}

function Deliberation({ g, view, act, busy }: { g: Game<State>; view: CaseView; act: (command: string, input?: Record<string, unknown>) => Promise<boolean>; busy: boolean }) {
  const opposite: Choice = view.myVote === "a" ? "b" : "a";
  return <div className="g-jury-deliberation">
    <div className="g-jury-columns">
      <ArgColumn g={g} view={view} side="a" label={view.stanceA} list={view.argumentsA} act={act} busy={busy} />
      <ArgColumn g={g} view={view} side="b" label={view.stanceB} list={view.argumentsB} act={act} busy={busy} />
    </div>
    <div className="g-jury-argue">
      <ArgueForm g={g} act={act} busy={busy} side={view.myVote as Choice} />
    </div>
    {view.canSwitch
      ? <Confirm title={g.t("¿Cambiar tu voto?", "Canviar el teu vot?")} description={g.t("Solo puedes hacerlo una vez en este caso.", "Només ho pots fer una vegada en este cas.")} onConfirm={() => act("switch", { choice: opposite })}>
          <Action secondary className="g-jury-convinced"><Sparkles aria-hidden="true" />{g.t("Me habéis convencido", "M'heu convençut")}</Action>
        </Confirm>
      : view.switched && <p className="g-muted">{g.t("Ya has cambiado de opinión una vez en este caso.", "Ja has canviat d'opinió una vegada en este cas.")}</p>}
  </div>;
}

function ArgueForm({ g, act, busy, side }: { g: Game<State>; act: (command: string, input?: Record<string, unknown>) => Promise<boolean>; busy: boolean; side: Choice }) {
  const [text, setText] = useState("");
  return <form className="g-jury-argue-form" onSubmit={async event => { event.preventDefault(); const value = text.trim(); if (value && await act("argue", { side, text: value })) setText(""); }}>
    <label className="sr-only" htmlFor="g-jury-argument">{g.t("Argumenta tu voto…", "Argumenta el teu vot…")}</label>
    <input id="g-jury-argument" className="g-input" value={text} maxLength={280} autoComplete="off" placeholder={g.t("Argumenta tu voto…", "Argumenta el teu vot…")} onChange={event => setText(event.target.value)} />
    <Action type="submit" disabled={busy || !text.trim()}>{g.t("Enviar", "Enviar")}</Action>
  </form>;
}

function ArgColumn({ g, view, side, label, list, act, busy }: { g: Game<State>; view: CaseView; side: Choice; label: string; list: ArgumentView[]; act: (command: string, input?: Record<string, unknown>) => Promise<boolean>; busy: boolean }) {
  const sorted = [...list].sort((a, b) => (b.top ? 1 : 0) - (a.top ? 1 : 0) || b.supports - a.supports);
  return <div className="g-jury-column">
    <h4>{label}{view.myVote === side && <span className="g-jury-mine-side">{g.t("tu voto", "el teu vot")}</span>}</h4>
    <ul>
      {sorted.map(argument => <li key={argument.id} className={argument.top ? "g-jury-top" : ""}>
        <PersonLine person={g.person(argument.authorId)} right={
          <button type="button" className="g-jury-support" aria-pressed={argument.supportedByMe} disabled={busy} onClick={() => void act("support", { argumentId: argument.id })}>
            <ThumbsUp aria-hidden="true" /><span>{argument.supports}</span>
          </button>} />
        <p>{argument.text}</p>
      </li>)}
      {!sorted.length && <li className="g-muted">{g.t("Nadie ha argumentado este lado todavía.", "Ningú ha argumentat este costat encara.")}</li>}
    </ul>
    {g.demo && <Action secondary disabled={busy} onClick={() => void act("demoArgue", { side })}>{g.t("Demo: nuevo argumento", "Demo: nou argument")}</Action>}
  </div>;
}

function VerdictCard({ g, view }: { g: Game<State>; view: CaseView }) {
  const verdict = view.verdict;
  if (!verdict) return null;
  const leaning = verdict.switchedToA >= verdict.switchedToB ? view.stanceA : view.stanceB;
  return <div className="g-jury-card g-jury-verdict">
    <CaseHeader g={g} view={view} />
    <p className="g-jury-dilemma">{view.dilemma}</p>
    {verdict.result === "split"
      ? <p className="g-jury-split"><Scale aria-hidden="true" />{g.t("Jurado dividido", "Jurat dividit")}</p>
      : <div className="g-jury-result" role="status">
          <Bar label={view.stanceA} share={verdict.shareA} total={verdict.total} accent={verdict.result === "a"} />
          <Bar label={view.stanceB} share={verdict.shareB} total={verdict.total} accent={verdict.result === "b"} />
        </div>}
    <div className="g-jury-best">
      {verdict.bestArgumentA && <blockquote><strong>{view.stanceA}</strong><p>&ldquo;{verdict.bestArgumentA.text}&rdquo;</p><cite>{verdict.bestArgumentA.authorName}</cite></blockquote>}
      {verdict.bestArgumentB && <blockquote><strong>{view.stanceB}</strong><p>&ldquo;{verdict.bestArgumentB.text}&rdquo;</p><cite>{verdict.bestArgumentB.authorName}</cite></blockquote>}
    </div>
    <p className="g-jury-switched" role="status"><strong>{verdict.switched}</strong> {g.t("personas cambiaron de opinión después de leer la deliberación.", "persones van canviar d'opinió després de llegir la deliberació.")}
      {verdict.switched > 0 && <> {g.t(`La mayoría, hacia «${leaning}».`, `La majoria, cap a «${leaning}».`)}</>}</p>
  </div>;
}

function CreateCase({ g, onDone }: { g: Game<State>; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [dilemma, setDilemma] = useState("");
  const [stanceA, setStanceA] = useState(g.t("Sí", "Sí"));
  const [stanceB, setStanceB] = useState(g.t("No", "No"));
  const [audience, setAudience] = useState<Audience>({ kind: "campus" });
  const [anon, setAnon] = useState(false);
  const reach = audienceReach(audience, g.world);
  const anonBlocked = reach < minAnonymousAudience;
  const steps = [g.t("El dilema", "El dilema"), g.t("Las posturas", "Les postures"), g.t("Quién y cómo", "Qui i com")];

  const submit = async () => {
    const ok = await g.act("create", { dilemma, stanceA, stanceB, audienceKind: audience.kind, audienceRef: audience.ref, anon: anon && !anonBlocked });
    if (ok) onDone();
  };

  return <div className="g-jury g-jury-create">
    <Steps steps={steps} current={step} onBack={() => step === 0 ? onDone() : setStep(step - 1)} />

    {step === 0 && <div className="g-stack">
      <p className="g-jury-caution">{g.t("Cuenta la situación sin nombrar a nadie: ni nombres, ni detalles que la identifiquen.", "Conta la situació sense nomenar ningú: ni noms, ni detalls que la identifiquen.")}</p>
      <label className="sr-only" htmlFor="g-jury-dilemma">{g.t("El dilema", "El dilema")}</label>
      <textarea id="g-jury-dilemma" className="g-input" rows={3} maxLength={220} value={dilemma} placeholder={g.t("¿Está mal…?", "Està mal…?")} onChange={event => setDilemma(event.target.value)} />
      <Suggestions label={g.t("Ideas", "Idees")} options={dilemmaSuggestions.map(([es, va]) => g.t(es, va))} onUse={setDilemma} />
      <Action onClick={() => setStep(1)} disabled={dilemma.trim().length < 10}>{g.t("Siguiente", "Següent")}</Action>
    </div>}

    {step === 1 && <div className="g-stack">
      <label className="g-jury-stance"><span>{g.t("Primera postura", "Primera postura")}</span><input className="g-input" maxLength={40} value={stanceA} onChange={event => setStanceA(event.target.value)} /></label>
      <label className="g-jury-stance"><span>{g.t("Segunda postura", "Segona postura")}</span><input className="g-input" maxLength={40} value={stanceB} onChange={event => setStanceB(event.target.value)} /></label>
      <Action onClick={() => setStep(2)} disabled={!stanceA.trim() || !stanceB.trim() || stanceA.trim().toLocaleLowerCase() === stanceB.trim().toLocaleLowerCase()}>{g.t("Siguiente", "Següent")}</Action>
    </div>}

    {step === 2 && <div className="g-stack">
      <AudiencePicker world={g.world} kinds={audienceKinds} value={audience} onChange={setAudience} anonymous={anon} label={g.t("¿Quién juzga tu caso?", "Qui jutja el teu cas?")} />
      <Tiles label={g.t("¿Con nombre o anónimo?", "Amb nom o anònim?")} columns={2} value={anon ? "anon" : "named"}
        onChange={value => setAnon(value === "anon")}
        options={[
          { value: "named", label: g.t("Con mi nombre", "Amb el meu nom"), detail: g.me.name },
          { value: "anon", label: g.t("Anónimo", "Anònim"), detail: g.t("Nadie ve tu nombre", "Ningú veu el teu nom"), blocked: anonBlocked ? g.t(`Hacen falta ${minAnonymousAudience} personas en ese destinatario.`, `Calen ${minAnonymousAudience} persones en eixe destinatari.`) : undefined },
        ]} />
      <IdentityNote>{anon && !anonBlocked
        ? g.t("Tu caso se verá sin tu nombre. La moderación puede identificarte si alguien denuncia.", "El teu cas es veurà sense el teu nom. La moderació et pot identificar si algú ho denuncia.")
        : g.t(`Se verá con tu nombre: ${g.me.name}.`, `Es veurà amb el teu nom: ${g.me.name}.`)}</IdentityNote>
      <Action onClick={() => void submit()} disabled={g.busy}>{g.t("Abrir el caso", "Obrir el cas")}</Action>
    </div>}
  </div>;
}
