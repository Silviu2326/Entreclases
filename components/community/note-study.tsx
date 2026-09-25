"use client";
import { useEffect, useRef, useState } from "react";
import { Check, RotateCcw, Send, Share2, Sparkles, X } from "lucide-react";
import { useCommunity } from "./context";
import { Action, Chips, Empty, Loading, Modal, TextArea } from "./controls";
import { communityError } from "@/lib/community/copy";
import { challengeText, scoreLine, studyLink, type NoteStudy, type Study } from "@/lib/community/study";
import type { Note } from "@/lib/community/types";
import "./note-study.css";

type Tab = "summary" | "cards" | "quiz" | "ask";

// Estudiar con un apunte: lo prepara la IA una vez y queda para todo el que lo abra.
export function NoteStudyDialog({ note, open, onOpenChange, startOn = "summary" }: { note: Note; open: boolean; onOpenChange: (open: boolean) => void; startOn?: Tab }) {
 const { c, locale, repo } = useCommunity();
 const [study, setStudy] = useState<NoteStudy | null | undefined>(undefined);
 const [error, setError] = useState("");
 const [preparing, setPreparing] = useState(false);
 const [tab, setTab] = useState<Tab>(startOn);
 const alive = useRef(true);
 useEffect(() => () => { alive.current = false; }, []);

 // Al abrir se lee lo que ya haya. Si alguien lo está preparando, se espera sin gastar cupo.
 useEffect(() => {
  if (!open) return;
  let active = true, tries = 0, timer = 0;
  const read = () => repo.readStudy(note.id).then(found => {
   if (!active) return;
   setStudy(found);
   if (found?.status === "working" && tries++ < 25) timer = window.setTimeout(read, 4000);
  }, problem => { if (active) { setStudy(null); setError(communityError(problem, locale)); } });
  void read();
  return () => { active = false; window.clearTimeout(timer); };
 }, [open, note.id, repo, locale]);

 const prepare = async () => {
  setError(""); setPreparing(true);
  try { const result = await repo.prepareStudy(note.id); if (alive.current) setStudy(result); }
  catch (problem) { if (alive.current) setError(communityError(problem, locale)); }
  finally { if (alive.current) setPreparing(false); }
 };

 const ready = study?.status === "ready" && study.content;
 return <Modal open={open} onOpenChange={onOpenChange} title={c("studyTitle")} description={`${note.subject} · ${note.title}`} wide>
  <div className="ns">
   {error && <p className="ns-error" role="alert">{error}</p>}
   {study === undefined || preparing || study?.status === "working" ? <Loading label={c("studyWorking")} />
    : ready ? <>
     <Chips label={c("studySections")} value={tab} onChange={value => setTab(value as Tab)} options={[{ value: "summary", label: c("studySummary") }, { value: "cards", label: c("studyCards") }, { value: "quiz", label: c("studyQuiz") }, { value: "ask", label: c("studyAsk") }]} />
     {tab === "summary" && <Summary study={study.content!} />}
     {tab === "cards" && <Cards study={study.content!} />}
     {tab === "quiz" && <Quiz study={study.content!} note={note} />}
     {tab === "ask" && <Ask note={note} />}
     <p className="ns-notice"><Sparkles aria-hidden="true" />{c("studyNotice")}</p>
    </>
    : study?.status === "unreadable" ? <Empty title={c("studyUnreadable")} body={c("studyUnreadableBody")} />
    : study?.status === "too_long" ? <Empty title={c("studyTooLong")} body={c("studyTooLongBody")} />
    : study?.status === "failed" ? <Empty title={c("studyFailed")} body={c("studyFailedBody")} action={<Action onClick={() => void prepare()}><RotateCcw />{c("studyRetry")}</Action>} />
    : <Empty title={c("studyStartTitle")} body={c("studyStartBody")} action={<Action onClick={() => void prepare()}><Sparkles />{c("studyStart")}</Action>} />}
  </div>
 </Modal>;
}

function Summary({ study }: { study: Study }) {
 return <ol className="ns-summary">{study.summary.map((point, index) => <li key={index}>{point}</li>)}</ol>;
}

function Cards({ study }: { study: Study }) {
 const { c } = useCommunity();
 const [index, setIndex] = useState(0), [flipped, setFlipped] = useState(false);
 const card = study.cards[index];
 const move = (step: number) => { setIndex((index + step + study.cards.length) % study.cards.length); setFlipped(false); };
 return <div className="ns-cards">
  <button type="button" className={`ns-card${flipped ? " ns-card-back" : ""}`} onClick={() => setFlipped(!flipped)} aria-label={flipped ? c("cardHide") : c("cardShow")}>
   <span className="u-eyebrow">{index + 1} / {study.cards.length}</span>
   <strong aria-live="polite">{flipped ? card.back : card.front}</strong>
   <span className="ns-hint">{flipped ? c("cardHide") : c("cardShow")}</span>
  </button>
  <div className="ns-row"><Action secondary onClick={() => move(-1)}>{c("previous")}</Action><Action secondary onClick={() => move(1)}>{c("next")}</Action></div>
 </div>;
}

function Quiz({ study, note }: { study: Study; note: Note }) {
 const { c, locale, demo } = useCommunity();
 const [index, setIndex] = useState(0), [chosen, setChosen] = useState<number | null>(null), [right, setRight] = useState(0), [copied, setCopied] = useState(false);
 const total = study.quiz.length, done = index >= total, question = study.quiz[index];
 const choose = (option: number) => { if (chosen !== null) return; setChosen(option); if (option === question.answer) setRight(right + 1); };
 const restart = () => { setIndex(0); setChosen(null); setRight(0); setCopied(false); };
 // Compartir abre el menú del móvil; en el ordenador se copia para pegarlo en el grupo de clase.
 const share = async () => {
  const url = studyLink(locale, demo, note.id, window.location.origin), text = challengeText(locale, note.title, right, total);
  if (navigator.share) { try { await navigator.share({ text, url }); } catch { /* cancelado */ } return; }
  try { await navigator.clipboard.writeText(`${text} ${url}`); setCopied(true); } catch { window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener"); }
 };
 if (done) return <div className="ns-result">
  <strong>{scoreLine(locale, right, total)}</strong>
  <div className="ns-row"><Action onClick={() => void share()}><Share2 />{c("quizShare")}</Action><Action secondary onClick={restart}><RotateCcw />{c("quizRestart")}</Action></div>
  {copied && <p className="u-muted u-small" role="status">{c("quizCopied")}</p>}
 </div>;
 return <div className="ns-quiz">
  <p className="u-eyebrow">{index + 1} / {total}</p>
  <h3>{question.question}</h3>
  <div className="ns-options">{question.options.map((option, position) => {
   const state = chosen === null ? "" : position === question.answer ? " ns-right" : position === chosen ? " ns-wrong" : "";
   return <button type="button" key={position} className={`ns-option${state}`} disabled={chosen !== null} onClick={() => choose(position)}>
    {state === " ns-right" && <Check aria-hidden="true" />}{state === " ns-wrong" && <X aria-hidden="true" />}<span>{option}</span>
   </button>;
  })}</div>
  {chosen !== null && <div className="ns-why" role="status"><strong>{chosen === question.answer ? c("quizRight") : c("quizWrong")}</strong> {question.why}</div>}
  {chosen !== null && <Action onClick={() => { setIndex(index + 1); setChosen(null); }}>{c("next")}</Action>}
 </div>;
}

function Ask({ note }: { note: Note }) {
 const { c, locale, repo } = useCommunity();
 const [answer, setAnswer] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
 return <form className="ns-ask" onSubmit={async event => {
  event.preventDefault();
  const form = event.currentTarget, question = String(new FormData(form).get("question") ?? "").trim();
  if (question.length < 3) return;
  setBusy(true); setError(""); setAnswer("");
  try { setAnswer(await repo.askNote(note.id, question)); } catch (problem) { setError(communityError(problem, locale)); } finally { setBusy(false); }
 }}>
  <TextArea label={c("askLabel")} name="question" placeholder={c("askPlaceholder")} minLength={3} maxLength={400} required rows={3} />
  <p className="u-muted u-small">{c("askHelp")}</p>
  <Action type="submit" disabled={busy}><Send />{c("askSend")}</Action>
  {busy && <Loading label={c("studyWorking")} />}
  {error && <p className="ns-error" role="alert">{error}</p>}
  {answer && <div className="ns-answer" aria-live="polite">{answer}</div>}
 </form>;
}
