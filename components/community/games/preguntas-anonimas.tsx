"use client";
import { useEffect, useState } from "react";
import { Ban, Flag, Heart, MessageCircle, PenLine, Send, Settings2, ShieldCheck, SkipForward, Sparkles } from "lucide-react";
import { GameShell, useGame, useGameTarget, type Game } from "./shared";
import { GameHead, Segmented, Tiles, AudiencePicker, Suggestions, Steps, Deck, IdentityNote, Nothing } from "./ui";
import { Action, Avatar, Confirm, Modal } from "../controls";
import { useCommunity } from "../context";
import { audienceLabel } from "@/lib/community/games/audience";
import type { Audience, AudienceKind, GameWorld } from "@/lib/community/games/types";
import { NOTE_MAX_LENGTH, type AllowKind, type BoardQuestionView, type BoardView, type InboxCard, type QuestionStatus, type SentQuestion, type State } from "@/lib/community/games/demo/questions";
import type { Profile } from "@/lib/community/types";
import "./preguntas-anonimas.css";

type Tab = "sent" | "inbox" | "boards";
type NoteKind = Exclude<AudienceKind, "site">;
type ReplyMode = "private" | "public";
type AnswerMode = "named" | "anon";

const ASK_KINDS: AudienceKind[] = ["campus", "degree", "course", "group", "contacts", "person"];
const ALLOW_TILES: AllowKind[] = ["campus", "degree", "course", "group", "contacts"];

export default function PreguntasAnonimas() {
  const g = useGame<State>("questions");
  const { data } = useCommunity();
  return <GameShell game={g}>{g.state && <Screen g={g} state={g.state} profiles={data.profiles} />}</GameShell>;
}

// ---- the screen, once we know the state exists -----------------------------

function Screen({ g, state, profiles }: { g: Game<State>; state: State; profiles: Profile[] }) {
  const t = g.t;
  // Coming from someone's profile: the question is already addressed, so start at what to ask.
  const target = useGameTarget();
  const [tab, setTab] = useState<Tab>("sent");
  const [asking, setAsking] = useState(!!target);
  const [step, setStep] = useState(target ? 1 : 0);
  const [audience, setAudience] = useState<Audience>(target ? { kind: "person", ref: target } : { kind: "campus" });
  const [text, setText] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyMode, setReplyMode] = useState<ReplyMode>("private");
  const [boardKey, setBoardKey] = useState<string | null>(null);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [answerMode, setAnswerMode] = useState<AnswerMode>("named");

  const topCard = state.inbox[0];
  useEffect(() => { if (topCard) void g.act("open", { id: topCard.id }); }, [topCard?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- marking as seen, not a navigation dependency

  const startAsking = () => { setAsking(true); setStep(0); setAudience({ kind: "campus" }); setText(""); };
  const closeAsking = (landOnSent: boolean) => { setAsking(false); setStep(0); setText(""); if (landOnSent) setTab("sent"); };

  return <div className="g-questions">
    <GameHead title={t("Sin dar la cara", "Sense donar la cara")} body={t("Lo que no te atreves a preguntar con tu nombre, a quien tú elijas. Nadie sabrá que has sido tú.", "Allò que no t'atreveixes a preguntar amb el teu nom, a qui tu vulgues. Ningú sabrà que has sigut tu.")}
      aside={!asking ? <Action onClick={startAsking}><PenLine aria-hidden="true" />{t("Escribir una pregunta", "Escriure una pregunta")}</Action> : undefined} />

    <div className="g-questions-daily" role="status">
      {/* The quota reads as what is left, not as a share used: a bar at 0 % reads like a fault. */}
      <p className="g-questions-quota" aria-hidden="true">{Array.from({ length: state.dailyLimit }, (_, index) => <i key={index} className={index < state.dailyLeft ? "left" : ""} />)}</p>
      <p className="g-muted">{state.dailyLeft > 0
        ? t(`Te quedan ${state.dailyLeft} preguntas hoy, cuentan todos los destinatarios.`, `Et queden ${state.dailyLeft} preguntes hui, compten tots els destinataris.`)
        : t("Hoy ya no te quedan preguntas. Vuelve mañana.", "Hui ja no et queden preguntes. Torna demà.")}</p>
    </div>

    {asking
      ? <AskFlow g={g} state={state} profiles={profiles} audience={audience} setAudience={setAudience} text={text} setText={setText} step={step} setStep={setStep} onClose={closeAsking} />
      : <>
        <Segmented label={t("Secciones de Sin dar la cara", "Seccions de Sense donar la cara")} value={tab} onChange={value => setTab(value as Tab)}
          options={[
            { value: "sent", label: t("Mis preguntas", "Les meues preguntes") },
            { value: "inbox", label: t(`Mi buzón${state.inbox.length ? ` (${state.inbox.length})` : ""}`, `La meua bústia${state.inbox.length ? ` (${state.inbox.length})` : ""}`) },
            { value: "boards", label: t("Tablones", "Taulers") },
          ]} />

        {tab === "sent" && <SentList items={state.sent} t={t} />}
        {tab === "inbox" && <InboxPanel g={g} state={state}
          settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen}
          replyingId={replyingId} setReplyingId={setReplyingId} replyText={replyText} setReplyText={setReplyText} replyMode={replyMode} setReplyMode={setReplyMode} />}
        {tab === "boards" && <BoardsPanel g={g} state={state}
          boardKey={boardKey} setBoardKey={setBoardKey}
          answeringId={answeringId} setAnsweringId={setAnsweringId} answerText={answerText} setAnswerText={setAnswerText} answerMode={answerMode} setAnswerMode={setAnswerMode} />}
      </>}

    {settingsOpen && <SettingsModal g={g} state={state} open={settingsOpen} onOpenChange={setSettingsOpen} />}
  </div>;
}

// ---- asking: who, what, send -----------------------------------------------

function identityHint(audience: Audience, world: GameWorld, t: (es: string, va: string) => string) {
  if (audience.kind === "person") return t("Llegará en privado a su buzón. No sabrá que has sido tú, a menos que tú se lo digas después.", "Arribarà en privat a la seua bústia. No sabrà que has sigut tu, llevat que tu li ho digues després.");
  if (audience.kind === "contacts") return t("Llegará por separado a cada uno de tus contactos, sin tu nombre.", "Arribarà per separat a cadascun dels teus contactes, sense el teu nom.");
  return t(`Se publicará sin tu nombre en el tablón de ${audienceLabel(audience, world)}. Nadie podrá saber que la escribiste tú.`, `Es publicarà sense el teu nom en el tauler de ${audienceLabel(audience, world)}. Ningú podrà saber que la vas escriure tu.`);
}

function suggestionsFor(kind: NoteKind, t: (es: string, va: string) => string): string[] {
  const table: Record<NoteKind, [string, string][]> = {
    person: [
      ["¿Qué piensas de verdad de mí?", "Què penses de veritat de mi?"],
      ["¿Alguna vez te has fijado en mí en clase?", "Alguna vegada t'has fixat en mi a classe?"],
      ["Si pudieras decirme algo sin que sepa que eres tú, ¿qué sería?", "Si pogueres dir-me alguna cosa sense que sàpia que eres tu, què seria?"],
      ["¿Te caigo tan bien como a mí me caes tú?", "Et caic tan bé com a mi em caus tu?"],
    ],
    contacts: [
      ["¿Qué es lo que nunca me dirías a la cara?", "Què és allò que mai em diries a la cara?"],
      ["De nuestro grupo, ¿a quién salvarías primero?", "Del nostre grup, a qui salvaries primer?"],
      ["¿Qué manía mía te vuelve loco/a?", "Quina mania meua et torna boig o boja?"],
    ],
    course: [
      ["¿De verdad alguien lleva la asignatura al día?", "De veres algú porta l'assignatura al dia?"],
      ["¿Qué examen de este cuatrimestre os da más miedo?", "Quin examen d'este quadrimestre us fa més por?"],
      ["¿Cambiaríais de grupo de prácticas si pudierais?", "Canviaríeu de grup de pràctiques si poguéreu?"],
    ],
    degree: [
      ["¿Volveríais a elegir esta carrera?", "Tornaríeu a triar esta carrera?"],
      ["¿Qué es lo que nadie os contó antes de empezar?", "Què és allò que ningú us va contar abans de començar?"],
      ["¿Qué salida profesional os da más miedo?", "Quina eixida professional us fa més por?"],
    ],
    group: [
      ["¿Qué opináis de verdad del último plan?", "Què opineu de veritat de l'últim pla?"],
      ["¿Quién debería organizar la próxima quedada?", "Qui hauria d'organitzar la pròxima quedada?"],
      ["¿Hay algo del grupo que nadie se atreve a decir?", "Hi ha alguna cosa del grup que ningú s'atrevisca a dir?"],
    ],
    campus: [
      ["¿Qué es lo peor de estudiar aquí?", "Què és el pitjor d'estudiar ací?"],
      ["¿A quién admiráis del campus sin conocerlo?", "A qui admireu del campus sense conéixer-lo?"],
      ["¿Qué rumor del campus os gustaría confirmar?", "Quin rumor del campus us agradaria confirmar?"],
    ],
  };
  return table[kind].map(([es, va]) => t(es, va));
}

function AskFlow({ g, state, profiles, audience, setAudience, text, setText, step, setStep, onClose }: {
  g: Game<State>; state: State; profiles: Profile[]; audience: Audience; setAudience: (audience: Audience) => void;
  text: string; setText: (text: string) => void; step: number; setStep: (step: number) => void; onClose: (landOnSent: boolean) => void;
}) {
  const t = g.t;
  const canAdvance = audience.kind !== "person" || !!audience.ref;
  const kind = (audience.kind === "site" ? "campus" : audience.kind) as NoteKind;

  return <div className="g-panel g-stack">
    <Steps steps={[t("¿A quién?", "A qui?"), t("¿Qué?", "Què?"), t("Enviar", "Enviar")]} current={step} onBack={() => step > 0 ? setStep(step - 1) : onClose(false)} />

    {step === 0 && <div className="g-stack">
      <AudiencePicker world={g.world} kinds={ASK_KINDS} value={audience} onChange={setAudience} anonymous label={t("¿A quién le preguntas?", "A qui li preguntes?")} people={profiles} />
      <IdentityNote><Sparkles aria-hidden="true" />{identityHint(audience, g.world, t)}</IdentityNote>
      <div className="g-actions"><Action secondary onClick={() => onClose(false)}>{t("Cancelar", "Cancel·lar")}</Action><Action disabled={!canAdvance} onClick={() => setStep(1)}>{t("Continuar", "Continuar")}</Action></div>
    </div>}

    {step === 1 && <div className="g-stack">
      {audience.kind === "person" && <p className="g-muted">{t(`Para ${audienceLabel(audience, g.world)}, sin tu nombre.`, `Per a ${audienceLabel(audience, g.world)}, sense el teu nom.`)}</p>}
      <div className="g-questions-note on">
        <label className="sr-only" htmlFor="g-questions-text">{t("Tu pregunta", "La teua pregunta")}</label>
        <textarea id="g-questions-text" className="g-questions-note-input" value={text} maxLength={NOTE_MAX_LENGTH} onChange={event => setText(event.target.value)} placeholder={t("Escribe tu pregunta…", "Escriu la teua pregunta…")} />
        <small className="g-questions-note-count">{text.length}/{NOTE_MAX_LENGTH}</small>
      </div>
      <Suggestions label={t("Ideas para empezar", "Idees per a començar")} options={suggestionsFor(kind, t)} onUse={setText} />
      <div className="g-actions"><Action secondary onClick={() => setStep(0)}>{t("Atrás", "Arrere")}</Action><Action disabled={!text.trim()} onClick={() => setStep(2)}>{t("Continuar", "Continuar")}</Action></div>
    </div>}

    {step === 2 && <div className="g-stack">
      {!state.onboarded && <div className="g-questions-consent">
        <ShieldCheck aria-hidden="true" />
        <p>{t("Antes de tu primera pregunta anónima: nadie verá tu nombre, ni quien la recibe ni el tablón. La moderación sí puede identificarte si alguien te denuncia.", "Abans de la teua primera pregunta anònima: ningú veurà el teu nom, ni qui la reb ni el tauler. La moderació sí que et pot identificar si algú et denuncia.")}</p>
      </div>}
      <div className="g-questions-note on"><p className="g-questions-note-text">{text}</p></div>
      <IdentityNote><Sparkles aria-hidden="true" />{identityHint(audience, g.world, t)}</IdentityNote>
      <div className="g-actions">
        <Action secondary onClick={() => setStep(1)}>{t("Atrás", "Arrere")}</Action>
        <Action disabled={g.busy || state.dailyLeft <= 0} onClick={async () => { if (await g.act("ask", { audienceKind: audience.kind, audienceRef: audience.ref, text: text.trim() })) onClose(true); }}>
          <Send aria-hidden="true" />{state.onboarded ? t("Enviar mi pregunta", "Enviar la meua pregunta") : t("Aceptar y enviar mi primera pregunta", "Acceptar i enviar la meua primera pregunta")}
        </Action>
      </div>
    </div>}
  </div>;
}

// ---- sent questions --------------------------------------------------------

function statusLabel(status: QuestionStatus, t: (es: string, va: string) => string) {
  switch (status) {
    case "delivered": return t("Entregada", "Entregada");
    case "seen": return t("Vista", "Vista");
    case "answered_private": return t("Respondida en privado", "Responguda en privat");
    case "answered_public": return t("Respondida y publicada", "Responguda i publicada");
    case "discarded": return t("Descartada", "Descartada");
    case "expired": return t("Caducada", "Caducada");
  }
}

function SentList({ items, t }: { items: SentQuestion[]; t: (es: string, va: string) => string }) {
  if (!items.length) return <Nothing title={t("Todavía no has preguntado nada", "Encara no has preguntat res")} body={t("Escribe tu primera nota sin firma.", "Escriu la teua primera nota sense firma.")} />;
  return <ul className="g-questions-sent">{items.map(item => <li key={item.id} className="g-questions-note">
    <p className="g-questions-note-text">{item.text}</p>
    <div className="g-questions-sent-meta">
      <span className={`g-questions-status s-${item.status}`}>{statusLabel(item.status, t)}</span>
      <span className="g-muted">{item.audienceLabel}{item.targets > 1 ? ` · ${item.targets}` : ""}</span>
      {item.daysLeft !== null && <span className="g-muted">{t(`${item.daysLeft} días`, `${item.daysLeft} dies`)}</span>}
    </div>
    {item.answers.length > 0 && <ul className="g-questions-sent-answers">{item.answers.map((answer, index) => <li key={index}>{answer.text}<small>{answer.public ? t("Pública", "Pública") : t("Solo para ti", "Només per a tu")}</small></li>)}</ul>}
  </li>)}</ul>;
}

// ---- my mailbox ------------------------------------------------------------

function InboxPanel({ g, state, setSettingsOpen, replyingId, setReplyingId, replyText, setReplyText, replyMode, setReplyMode }: {
  g: Game<State>; state: State; settingsOpen: boolean; setSettingsOpen: (open: boolean) => void;
  replyingId: string | null; setReplyingId: (id: string | null) => void; replyText: string; setReplyText: (text: string) => void; replyMode: ReplyMode; setReplyMode: (mode: ReplyMode) => void;
}) {
  const t = g.t;
  const card = state.inbox[0];
  return <div className="g-stack">
    <div className="g-row">
      <Action secondary onClick={() => setSettingsOpen(true)}><Settings2 aria-hidden="true" />{t("Quién puede preguntarme", "Qui em pot preguntar")}</Action>
      <Action secondary onClick={() => void g.act("demo_incoming")}>{t("Demo: recibir una pregunta nueva", "Demo: rebre una pregunta nova")}</Action>
    </div>
    {!state.settings.open && <p className="g-muted">{t("Tu buzón está cerrado: no te llegan preguntas nuevas.", "La teua bústia està tancada: no et arriben preguntes noves.")}</p>}
    <Deck position={0} total={state.inbox.length} empty={<Nothing title={t("Tu buzón está vacío", "La teua bústia està buida")} body={t("Cuando alguien te pregunte sin dar la cara, aparecerá aquí, una nota cada vez.", "Quan algú et pregunte sense donar la cara, apareixerà ací, una nota cada vegada.")} />}>
      {card && (replyingId === card.id
        ? <ReplyCard g={g} card={card} text={replyText} setText={setReplyText} mode={replyMode} setMode={setReplyMode} onDone={() => setReplyingId(null)} />
        : <NoteCard g={g} card={card} onReply={() => { setReplyingId(card.id); setReplyText(""); }} />)}
    </Deck>
  </div>;
}

function NoteCard({ g, card, onReply }: { g: Game<State>; card: InboxCard; onReply: () => void }) {
  const t = g.t;
  return <div className="g-questions-note on">
    <p className="g-questions-note-text">{card.text}</p>
    <p className="g-muted">{t(`Caduca en ${card.daysLeft} días si nadie responde.`, `Caduca en ${card.daysLeft} dies si ningú respon.`)}</p>
    <div className="g-actions">
      <Action onClick={onReply}><MessageCircle aria-hidden="true" />{t("Responder", "Respondre")}</Action>
      <Action secondary onClick={() => void g.act("pass", { id: card.id })}><SkipForward aria-hidden="true" />{t("Pasar", "Passar")}</Action>
      <Confirm title={t("¿Bloquear a quien pregunta?", "Bloquejar qui pregunta?")} description={t("No sabrás quién es. Esa cuenta no podrá volver a preguntarte.", "No sabràs qui és. Eixe compte no podrà tornar a preguntar-te.")} onConfirm={() => g.act("block", { id: card.id })}>
        <Action secondary><Ban aria-hidden="true" />{t("Bloquear", "Bloquejar")}</Action>
      </Confirm>
      <Confirm title={t("¿Denunciar esta pregunta?", "Denunciar esta pregunta?")} description={t("Se retira, queda una copia para moderación y esa cuenta se bloquea.", "Es retira, en queda una còpia per a moderació i eixe compte es bloqueja.")} onConfirm={() => g.act("report", { id: card.id })}>
        <Action secondary><Flag aria-hidden="true" />{t("Denunciar", "Denunciar")}</Action>
      </Confirm>
    </div>
  </div>;
}

function ReplyCard({ g, card, text, setText, mode, setMode, onDone }: {
  g: Game<State>; card: InboxCard; text: string; setText: (text: string) => void; mode: ReplyMode; setMode: (mode: ReplyMode) => void; onDone: () => void;
}) {
  const t = g.t;
  return <div className="g-questions-note on">
    <p className="g-questions-note-text">{card.text}</p>
    <label className="sr-only" htmlFor="g-questions-reply">{t("Tu respuesta", "La teua resposta")}</label>
    <textarea id="g-questions-reply" className="g-input" value={text} onChange={event => setText(event.target.value)} placeholder={t("Escribe tu respuesta…", "Escriu la teua resposta…")} maxLength={600} />
    <Segmented label={t("Dónde va tu respuesta", "On va la teua resposta")} value={mode} onChange={value => setMode(value as ReplyMode)}
      options={[{ value: "private", label: t("Solo a quien preguntó", "Només a qui va preguntar") }, { value: "public", label: t("Pública en mi tablón", "Pública en el meu tauler") }]} />
    <div className="g-actions">
      <Action secondary onClick={onDone}>{t("Cancelar", "Cancel·lar")}</Action>
      <Action disabled={!text.trim() || g.busy} onClick={async () => { if (await g.act("reply", { id: card.id, text: text.trim(), public: mode === "public" })) onDone(); }}>
        <Send aria-hidden="true" />{t("Enviar respuesta", "Enviar resposta")}
      </Action>
    </div>
  </div>;
}

function allowLabel(kind: AllowKind, t: (es: string, va: string) => string) {
  switch (kind) {
    case "campus": return t("Todo el campus", "Tot el campus");
    case "degree": return t("Mi carrera", "La meua carrera");
    case "course": return t("Mi curso", "El meu curs");
    case "group": return t("Mis grupos", "Els meus grups");
    case "contacts": return t("Solo mis contactos", "Només els meus contactes");
  }
}

function SettingsModal({ g, state, open, onOpenChange }: { g: Game<State>; state: State; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = g.t;
  return <Modal open={open} onOpenChange={onOpenChange} title={t("Mi buzón de preguntas", "La meua bústia de preguntes")} description={t("Decide quién puede preguntarte sin dar la cara y si tu buzón está abierto.", "Decidix qui et pot preguntar sense donar la cara i si la teua bústia està oberta.")}>
    <div className="g-stack">
      <Segmented label={t("Estado del buzón", "Estat de la bústia")} value={state.settings.open ? "open" : "closed"} onChange={value => void g.act("settings", { open: value === "open" })}
        options={[{ value: "open", label: t("Abierto", "Obert") }, { value: "closed", label: t("Cerrado", "Tancat") }]} />
      <Tiles label={t("Quién puede preguntarme", "Qui em pot preguntar")} columns={2} value={state.settings.allow} onChange={value => void g.act("settings", { allow: value })}
        options={ALLOW_TILES.map(kind => ({ value: kind, label: allowLabel(kind, t) }))} />
    </div>
  </Modal>;
}

// ---- the boards -------------------------------------------------------------

function AnswerRow({ g, answer }: { g: Game<State>; answer: BoardQuestionView["answers"][number] }) {
  const t = g.t;
  if (answer.anon || !answer.authorId) return <div className="g-person"><Avatar /><span><strong>{t("Alguien anónimo", "Algú anònim")}</strong></span></div>;
  const person = g.person(answer.authorId);
  return <div className="g-person"><Avatar person={person} size="small" /><span><strong>{person?.name ?? answer.authorName}</strong></span>
    {!answer.mine && <Action secondary onClick={() => void g.chat(answer.authorId!)}><MessageCircle aria-hidden="true" />{t("Chat", "Xat")}</Action>}
  </div>;
}

function BoardAnswerForm({ g, question, text, setText, mode, setMode, onDone }: {
  g: Game<State>; question: BoardQuestionView; text: string; setText: (text: string) => void; mode: AnswerMode; setMode: (mode: AnswerMode) => void; onDone: () => void;
}) {
  const t = g.t;
  return <div className="g-questions-answer-form">
    <label className="sr-only" htmlFor={`g-questions-answer-${question.id}`}>{t("Tu respuesta", "La teua resposta")}</label>
    <textarea id={`g-questions-answer-${question.id}`} className="g-input" value={text} onChange={event => setText(event.target.value)} placeholder={t("Escribe tu respuesta…", "Escriu la teua resposta…")} maxLength={600} />
    <Segmented label={t("Firma tu respuesta", "Firma la teua resposta")} value={mode} onChange={value => setMode(value as AnswerMode)}
      options={[{ value: "named", label: t("Con mi nombre", "Amb el meu nom") }, { value: "anon", label: t("Anónima", "Anònima") }]} />
    <div className="g-actions">
      <Action secondary onClick={onDone}>{t("Cancelar", "Cancel·lar")}</Action>
      <Action disabled={!text.trim()} onClick={async () => { if (await g.act("answer_board", { id: question.id, text: text.trim(), anon: mode === "anon" })) onDone(); }}>
        <Send aria-hidden="true" />{t("Enviar", "Enviar")}
      </Action>
    </div>
  </div>;
}

function BoardsPanel({ g, state, boardKey, setBoardKey, answeringId, setAnsweringId, answerText, setAnswerText, answerMode, setAnswerMode }: {
  g: Game<State>; state: State; boardKey: string | null; setBoardKey: (key: string) => void;
  answeringId: string | null; setAnsweringId: (id: string | null) => void; answerText: string; setAnswerText: (text: string) => void; answerMode: AnswerMode; setAnswerMode: (mode: AnswerMode) => void;
}) {
  const t = g.t;
  const boards = state.boards;
  if (!boards.length) return <Nothing title={t("Todavía no hay tablones disponibles", "Encara no hi ha taulers disponibles")} body={t("Hacen falta más personas en tu curso, carrera o grupo.", "Calen més persones al teu curs, carrera o grup.")} />;
  const keyOf = (board: BoardView) => `${board.kind}:${board.ref ?? ""}`;
  const current = boards.find(board => keyOf(board) === boardKey) ?? boards[0];

  return <div className="g-stack">
    <Tiles label={t("Elige un tablón", "Tria un tauler")} columns={3} value={keyOf(current)} onChange={setBoardKey}
      options={boards.map(board => ({ value: keyOf(board), label: board.label, detail: t(`${board.questions.length} preguntas · ${board.reach} personas`, `${board.questions.length} preguntes · ${board.reach} persones`) }))} />

    {!current.questions.length
      ? <Nothing title={t("Nadie ha preguntado aquí todavía", "Ningú ha preguntat ací encara")} body={t("Sé la primera nota anónima de este tablón.", "Sigues la primera nota anònima d'este tauler.")} />
      : <ul className="g-questions-board">{current.questions.map(question => <li key={question.id} className={question.mine ? "g-questions-note on mine" : "g-questions-note on"}>
        <p className="g-questions-note-text">{question.text}</p>
        <p className="g-muted">{t(`Se cierra en ${question.closesInDays} días.`, `Es tanca en ${question.closesInDays} dies.`)}</p>
        <div className="g-actions">
          <Action secondary aria-pressed={question.likedByMe} onClick={() => void g.act("like", { id: question.id })}><Heart aria-hidden="true" />{t(`Yo también me lo pregunto (${question.likes})`, `Jo també m'ho pregunte (${question.likes})`)}</Action>
          {answeringId !== question.id && <Action secondary onClick={() => { setAnsweringId(question.id); setAnswerText(""); }}>{t("Responder", "Respondre")}</Action>}
          {question.canWithdraw && <Confirm title={t("¿Retirar tu pregunta?", "Retirar la teua pregunta?")} description={t("Desaparecerá del tablón para todo el mundo.", "Desapareixerà del tauler per a tothom.")} onConfirm={() => g.act("withdraw", { id: question.id })}>
            <Action secondary>{t("Retirar", "Retirar")}</Action>
          </Confirm>}
        </div>
        {answeringId === question.id && <BoardAnswerForm g={g} question={question} text={answerText} setText={setAnswerText} mode={answerMode} setMode={setAnswerMode} onDone={() => setAnsweringId(null)} />}
        {question.answers.length > 0 && <ul className="g-questions-answers">{question.answers.map(answer => <li key={answer.id}><AnswerRow g={g} answer={answer} /><p>{answer.text}</p></li>)}</ul>}
      </li>)}</ul>}
  </div>;
}
