"use client";
import { useState } from "react";
import { Coffee, Eye, Flag, GraduationCap, Heart, Hourglass, Lock, LogOut, MapPin, Shuffle, Sparkles, Unlock, X } from "lucide-react";
import { gamePath } from "@/lib/community/games/catalog";
import type { Decision, Looking, State } from "@/lib/community/games/demo/blind";
import { GameShell, useGame } from "./shared";
import { GameHead, Steps, Tiles, Countdown, Conversation, Bubble, Composer, IdentityNote, Nothing } from "./ui";
import { Action, Avatar, Confirm } from "../controls";
import "./cita-a-ciegas.css";

// Demo-only controls: the other side of a blind date does not exist in the demo.
function DemoBar({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="g-blind-demo" role="group" aria-label={label}><span>Demo</span><div className="g-blind-demo-row">{children}</div></div>;
}

const onOff = (t: (es: string, va: string) => string) => [{ value: "on", label: t("Sí, evitar", "Sí, evitar") }, { value: "off", label: t("Da igual", "Tant se val") }];

function lookingOptions(t: (es: string, va: string) => string) {
  return [
    { value: "meet", label: t("Conocer gente", "Conéixer gent"), icon: <Shuffle aria-hidden="true" /> },
    { value: "date", label: t("Una cita", "Una cita"), icon: <Heart aria-hidden="true" /> },
    { value: "open", label: t("Lo que surja", "El que sorgisca"), icon: <Sparkles aria-hidden="true" /> },
  ];
}

function decisionOptions(t: (es: string, va: string) => string, canExtend: boolean) {
  return [
    { value: "reveal", label: t("Revelar perfiles", "Revelar perfils"), detail: t("Quiero saber quién eres.", "Vull saber qui eres."), icon: <Eye aria-hidden="true" /> },
    { value: "meet", label: t("Quedar", "Quedar"), detail: t("Revelarnos y vernos.", "Revelar-nos i vore'ns."), icon: <Coffee aria-hidden="true" /> },
    { value: "more", label: t("Un día más", "Un dia més"), detail: t("24 horas más en anónimo.", "24 hores més en anònim."), icon: <Hourglass aria-hidden="true" />, blocked: canExtend ? undefined : t("Ya se usó", "Ja s'ha usat") },
    { value: "stop", label: t("Dejarlo aquí", "Deixar-ho ací"), detail: t("Ha estado bien, pero no sigo.", "Ha estat bé, però no continue."), icon: <X aria-hidden="true" /> },
  ];
}

const HINT_ICON = { site: <MapPin aria-hidden="true" />, interest: <Sparkles aria-hidden="true" />, year: <GraduationCap aria-hidden="true" /> } as const;

type Signup = { adult: "" | "yes" | "no"; looking: Looking | ""; avoidCourse: boolean; avoidGroups: boolean };

export default function CitaACiegas() {
  const g = useGame<State>("blind");
  const s = g.state;
  const [began, setBegan] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Signup>({ adult: "", looking: "", avoidCourse: true, avoidGroups: true });
  if (!s) return <GameShell game={g}>{null}</GameShell>;
  const t = g.t;


  // --- Not signed up: three bullets, then a three-step wizard. ---
  if (s.stage === "signup") {
    if (!began) return <GameShell game={g}><div className="g-blind g-blind-intro">
      <GameHead title={t("La cita empieza hablando", "La cita comença parlant")} body={t("Conocer a alguien por lo que dice antes que por su foto.", "Conéixer algú pel que diu abans que per la seua foto.")} />
      <ul className="g-blind-bullets">
        <li><Sparkles aria-hidden="true" /><span>{t("Un alias durante 48 horas, sin foto ni nombre.", "Un àlies durant 48 hores, sense foto ni nom.")}</span></li>
        <li><Hourglass aria-hidden="true" /><span>{t("Rompehielos y pistas mutuas que dan ritmo a la conversación.", "Trenca-gels i pistes mútues que donen ritme a la conversa.")}</span></li>
        <li><Eye aria-hidden="true" /><span>{t("A las 48 horas, una decisión privada: revelaros, quedar o dejarlo aquí.", "A les 48 hores, una decisió privada: revelar-vos, quedar o deixar-ho ací.")}</span></li>
      </ul>
      <Action onClick={() => setBegan(true)}>{t("Apuntarme", "Apuntar-me")}</Action>
    </div></GameShell>;

    const steps = [t("Mayoría de edad", "Majoria d'edat"), t("Qué busco", "Què busque"), t("Qué evitar", "Què evitar")];
    return <GameShell game={g}><div className="g-blind g-blind-onboarding">
      <Steps steps={steps} current={step} onBack={step > 0 ? () => setStep(value => value - 1) : undefined} />
      {step === 0 && <div className="g-stack">
        <Tiles label={t("¿Tienes 18 años o más?", "Tens 18 anys o més?")} columns={2} value={draft.adult}
          onChange={value => setDraft(d => ({ ...d, adult: value as "yes" | "no" }))}
          options={[{ value: "yes", label: t("Sí, tengo 18 o más", "Sí, tinc 18 o més") }, { value: "no", label: t("Todavía no", "Encara no") }]} />
        {draft.adult === "no" && <Nothing title={t("Este juego es solo para mayores de edad.", "Este joc és només per a majors d'edat.")} body={t("Vuelve cuando cumplas 18.", "Torna quan complisques 18.")} />}
        {draft.adult === "yes" && <Action onClick={() => setStep(1)}>{t("Continuar", "Continuar")}</Action>}
      </div>}
      {step === 1 && <div className="g-stack">
        <Tiles label={t("¿Qué buscas?", "Què busques?")} columns={3} value={draft.looking} onChange={value => setDraft(d => ({ ...d, looking: value as Looking }))} options={lookingOptions(t)} />
        {draft.looking && <Action onClick={() => setStep(2)}>{t("Continuar", "Continuar")}</Action>}
      </div>}
      {step === 2 && <div className="g-stack">
        <Tiles label={t("Evitar a mi curso", "Evitar el meu curs")} columns={2} value={draft.avoidCourse ? "on" : "off"} onChange={value => setDraft(d => ({ ...d, avoidCourse: value === "on" }))} options={onOff(t)} />
        <Tiles label={t("Evitar a mis grupos", "Evitar els meus grups")} columns={2} value={draft.avoidGroups ? "on" : "off"} onChange={value => setDraft(d => ({ ...d, avoidGroups: value === "on" }))} options={onOff(t)} />
        <IdentityNote>{t("Hablarás con un alias hasta la decisión final. Nadie ve tu nombre ni tu foto antes.", "Parlaràs amb un àlies fins a la decisió final. Ningú veu el teu nom ni la teua foto abans.")}</IdentityNote>
        <Action disabled={g.busy} onClick={() => void g.act("signup", { adult: true, looking: draft.looking, avoidCourse: draft.avoidCourse, avoidGroups: draft.avoidGroups })}>{t("Terminar", "Acabar")}</Action>
      </div>}
    </div></GameShell>;
  }

  // --- Signed up, waiting for or inside the weekly round. ---
  if (s.stage === "round" || s.stage === "confirmed") {
    return <GameShell game={g}><div className="g-blind g-blind-round">
      <GameHead title={t("La cita empieza hablando", "La cita comença parlant")} />
      <div className="g-panel g-blind-round-card">
        <Countdown until={s.round.nextRoundAt} label={t("hasta la próxima ronda", "fins a la pròxima ronda")} />
        <p>{s.stage === "confirmed"
          ? t("Estás dentro. El jueves a las 19:30 te presentamos a alguien.", "Estàs dins. El dijous a les 19:30 et presentem algú.")
          : t("Apuntado. Confirma cada semana para entrar en la ronda del jueves.", "Apuntat. Confirma cada setmana per a entrar en la ronda del dijous.")}</p>
        {s.resting && <p className="g-muted">{t("Has salido de varias conversaciones seguidas: tu próximo intento no contará esta vez.", "Has eixit de diverses converses seguides: el teu pròxim intent no comptarà esta vegada.")}</p>}
        {s.stage === "round" && <Action disabled={g.busy} onClick={() => void g.act("confirm")}>{t("Confirmar para el jueves", "Confirmar per al dijous")}</Action>}
      </div>
      <DemoBar label={t("Acciones de demostración", "Accions de demostració")}>
        <Action secondary disabled={g.busy} onClick={() => void g.act("demoStart")}>{t("Empezar una conversación ahora", "Començar una conversa ara")}</Action>
      </DemoBar>
    </div></GameShell>;
  }

  // --- 48 hours of chat. ---
  if (s.stage === "chat" && s.conversation) {
    const conv = s.conversation;
    const unlockedHint = conv.hints.find(hint => hint.offered && !hint.theirs);
    return <GameShell game={g}><div className="g-blind g-blind-chat">
      <header className="g-blind-chat-head">
        <div className={`g-blind-alias g-blind-alias-${conv.partnerAliasColor}`}><span /><strong>{conv.partnerAlias}</strong></div>
        <Countdown until={conv.endsAt} total={conv.totalMs} label={conv.extended ? t("de prórroga", "de pròrroga") : t("de conversación", "de conversa")} />
      </header>
      <IdentityNote>{t(`Te ven como ${conv.myAlias}. Nadie ve tu nombre ni tu foto todavía.`, `Et veuen com ${conv.myAlias}. Ningú veu el teu nom ni la teua foto encara.`)}</IdentityNote>

      {conv.silence && <p className="g-blind-silence" role="status">{t("La otra persona no ha escrito nada todavía. Puedes cerrar y tener prioridad en la próxima ronda.", "L'altra persona encara no ha escrit res. Pots tancar i tindre prioritat en la pròxima ronda.")}</p>}

      <Conversation>
        {conv.messages.map(message => message.icebreaker
          ? <div key={message.id} className="g-blind-icebreaker"><Sparkles aria-hidden="true" /><span>{message.text}</span></div>
          : <Bubble key={message.id} mine={message.from === "me"}>{message.text}</Bubble>)}
        {conv.messages.length === 0 && <p className="g-muted">{t("El primer rompehielos ya está arriba. Cuando quieras, escribe.", "El primer trenca-gels ja està a dalt. Quan vulgues, escriu.")}</p>}
      </Conversation>

      <section className="g-blind-hints">
        {conv.hints.map(hint => <div key={hint.key} className={hint.revealed ? "g-blind-hint on" : "g-blind-hint"}>
          {HINT_ICON[hint.key]}
          <div className="g-blind-hint-body">
            <strong>{hint.label}</strong>
            {hint.revealed
              ? <span>{hint.value}</span>
              : hint.offered
                ? <span className="g-muted">{hint.mine ? t("Esperando a que acepte también.", "Esperant que accepte també.") : t("Disponible: ¿la desbloqueáis?", "Disponible: la desbloqueu?")}</span>
                : <span className="g-muted">{t("Todavía no toca.", "Encara no toca.")}</span>}
          </div>
          {hint.offered && !hint.revealed && !hint.mine && <Action secondary onClick={() => void g.act("acceptHint", { hint: hint.key })} disabled={g.busy}><Unlock aria-hidden="true" />{t("Aceptar", "Acceptar")}</Action>}
          {!hint.offered && <Lock aria-hidden="true" className="g-blind-hint-lock" />}
        </div>)}
      </section>

      <Composer label={t("Escribe tu mensaje…", "Escriu el teu missatge…")} busy={g.busy} onSend={text => g.act("send", { text })} />

      <DemoBar label={t("Acciones de demostración", "Accions de demostració")}>
        <Action secondary disabled={g.busy} onClick={() => void g.act("demoReply")}>{t("Mensaje de la otra persona", "Missatge de l'altra persona")}</Action>
        {unlockedHint && <Action secondary disabled={g.busy} onClick={() => void g.act("demoAcceptHint", { hint: unlockedHint.key })}>{t("Acepta la pista", "Accepta la pista")}</Action>}
        <Action secondary disabled={g.busy} onClick={() => void g.act("demoFastForward")}>{t("Adelantar a la decisión", "Avançar a la decisió")}</Action>
      </DemoBar>

      <div className="g-actions g-blind-exit">
        <Confirm title={t("¿Salir de la conversación?", "Eixir de la conversa?")} description={t("La otra persona solo verá que la conversación ha terminado.", "L'altra persona només veurà que la conversa ha finalitzat.")} onConfirm={() => g.act("leave")}>
          <Action secondary><LogOut aria-hidden="true" />{t("Salir", "Eixir")}</Action>
        </Confirm>
        <Confirm title={t("¿Denunciar y cerrar?", "Denunciar i tancar?")} description={t("Se cierra la conversación para las dos personas y queda registrada para moderación.", "Es tanca la conversa per a les dues persones i queda registrada per a moderació.")} onConfirm={() => g.act("report")}>
          <Action secondary className="g-blind-report"><Flag aria-hidden="true" />{t("Denunciar", "Denunciar")}</Action>
        </Confirm>
      </div>
    </div></GameShell>;
  }

  // --- The final, private decision. ---
  if (s.stage === "decision" && s.decision) {
    const decision = s.decision;
    return <GameShell game={g}><div className="g-blind g-blind-decision">
      <GameHead title={t("¿Qué quieres hacer?", "Què vols fer?")} body={t("Tu respuesta es privada. Solo pasa algo si coincide con la suya.", "La teua resposta és privada. Només passa alguna cosa si coincidix amb la seua.")} aside={<Countdown until={decision.deadline} total={decision.totalMs} label={t("para decidir", "per a decidir")} />} />
      {!decision.mine && <Tiles label={t("Tu decisión", "La teua decisió")} columns={2} value="" onChange={value => void g.act("decide", { choice: value })} options={decisionOptions(t, decision.canExtend)} />}
      {decision.mine && <div className="g-panel g-blind-waiting" role="status">
        <p>{t("Tu respuesta está guardada. Esperando a la otra persona.", "La teua resposta està guardada. Esperant l'altra persona.")}</p>
      </div>}
      <DemoBar label={t("Acciones de demostración", "Accions de demostració")}>
        {(["reveal", "meet", "more", "stop"] as Decision[]).filter(choice => choice !== "more" || decision.canExtend).map(choice =>
          <Action key={choice} secondary disabled={g.busy} onClick={() => void g.act("demoDecide", { choice })}>{t("La otra persona: ", "L'altra persona: ") + decisionOptions(t, decision.canExtend).find(option => option.value === choice)?.label}</Action>)}
      </DemoBar>
    </div></GameShell>;
  }

  // --- Done: revealed match, or a neutral close. ---
  if (s.stage === "done" && s.result) {
    const result = s.result;
    if (result.kind === "match" && result.partnerId) {
      const partner = g.person(result.partnerId);
      return <GameShell game={g}><div className="g-blind g-blind-result">
        <h2>{t("¡Hay coincidencia!", "Hi ha coincidència!")}</h2>
        <div className="g-blind-profile">
          <Avatar person={partner} size="large" />
          <div><strong>{partner?.name}</strong><p className="g-muted">{partner?.degree} · {partner?.year}º · {partner?.campus}</p></div>
        </div>
        {partner?.bio && <p className="g-blind-bio">{partner.bio}</p>}
        {!!partner?.interests?.length && <div className="g-blind-chips">{partner.interests.map(interest => <span key={interest}>{interest}</span>)}</div>}
        <IdentityNote>{t("Ya os habéis revelado. Esto sigue como un chat normal en Charlas.", "Ja vos heu revelat. Açò continua com un xat normal a Xarrades.")}</IdentityNote>
        <div className="g-actions">
          <Action onClick={() => void g.chat(result.partnerId!)}>{t("Abrir el chat", "Obrir el xat")}</Action>
          {result.meet && <a className="u-button g-blind-hangout-link" href={gamePath(g.world.locale, g.demo, "hangout")}>{t("Proponer un hueco para los dos", "Proposar un forat per als dos")}</a>}
        </div>
        <Action secondary disabled={g.busy} onClick={() => void g.act("dismiss")}>{t("Jugar otra ronda", "Jugar una altra ronda")}</Action>
      </div></GameShell>;
    }
    const closingText: Record<string, [string, string]> = {
      "no-match": ["Esta conversación termina aquí. Gracias por hablar.", "Esta conversa acaba ací. Gràcies per parlar."],
      left: ["Has salido de la conversación.", "Has eixit de la conversa."],
      reported: ["Has denunciado y cerrado la conversación. Gracias por avisar.", "Has denunciat i tancat la conversa. Gràcies per avisar."],
      silence: ["Has cerrado la conversación por silencio. Tendrás prioridad en la próxima ronda.", "Has tancat la conversa per silenci. Tindràs prioritat en la pròxima ronda."],
    };
    const [es, va] = closingText[result.reason ?? "no-match"];
    return <GameShell game={g}><div className="g-blind g-blind-result">
      <Nothing title={t(es, va)} action={<Action disabled={g.busy} onClick={() => void g.act("dismiss")}>{t("Confirmar la semana que viene", "Confirmar la setmana que ve")}</Action>} />
    </div></GameShell>;
  }

  return <GameShell game={g}>{null}</GameShell>;
}
