"use client";
import { useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Copy, RotateCcw, CheckCircle2, XCircle } from "lucide-react";
import { ToolShell, Panel, Stat, Notice, useTool } from "./shared";
import { toolPath } from "@/lib/community/student/catalog";
import { useNotesStore, notesStoreKey, combineNotes, gradeQuiz, wrongQuestionIds, shareText, type QuizResult, type TopicLevel } from "@/lib/community/student/notes";
import { useToolStore, newId } from "@/lib/community/student/storage";
import { askTutor, TutorUnavailableError, type QuizKind, type QuizQuestion } from "@/lib/community/student/ai";
import "./examiname.css";

type Step = "setup" | "exam" | "result";
type Attempt = { id: string; date: string; subject: string; score: number };
type History = { attempts: Attempt[] };
const emptyHistory: History = { attempts: [] };
const COUNTS = [5, 10, 20] as const;
const KINDS: readonly QuizKind[] = ["test", "truefalse", "short"];

function kindLabel(kind: QuizKind, t: (es: string, va: string) => string): string {
  if (kind === "test") return t("Test", "Test");
  if (kind === "truefalse") return t("Verdadero/Falso", "Veritat/Fals");
  return t("Desarrollo corto", "Desenvolupament curt");
}
function levelLabel(level: TopicLevel, t: (es: string, va: string) => string): string {
  if (level === "strong") return t("Dominado", "Dominat");
  if (level === "ok") return t("Bien", "Bé");
  return t("Flojo", "Fluix");
}
function levelTone(level: TopicLevel): "good" | "plain" | "bad" {
  return level === "strong" ? "good" : level === "ok" ? "plain" : "bad";
}

export default function Examiname() {
  const { t, locale, demo, me, key } = useTool("exam");
  const notesKey = notesStoreKey({ demo, userId: me.user_id });
  const { docs } = useNotesStore(notesKey);
  const [history, setHistory] = useToolStore<History>(key, emptyHistory);

  const [step, setStep] = useState<Step>("setup");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const included = docs.filter(doc => !excluded.has(doc.id));
  const toggle = (id: string) => setExcluded(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const [count, setCount] = useState<5 | 10 | 20>(10);
  const [kind, setKind] = useState<QuizKind>("test");
  const [subject, setSubject] = useState("");
  const [asking, setAsking] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);

  const startQuiz = async () => {
    if (!included.length || asking) return;
    const { notes, images } = combineNotes(docs, included.map(doc => doc.id));
    setAsking(true); setSetupError(null); setUnavailable(false);
    try {
      const response = await askTutor({ mode: "quiz", language: locale, notes, images, count, kind }, { demo });
      setQuiz(response.quiz ?? []);
      setAnswers({}); setIndex(0); setDraft(""); setRevealed(false); setResult(null);
      setStep("exam");
    } catch (error) {
      if (error instanceof TutorUnavailableError) setUnavailable(true);
      else setSetupError(error instanceof Error ? error.message : String(error));
    } finally {
      setAsking(false);
    }
  };

  const finish = (finalAnswers: Record<string, number | string>) => {
    const graded = gradeQuiz(quiz, finalAnswers, t);
    setResult(graded);
    setHistory(current => ({ attempts: [{ id: newId(), date: new Date().toISOString(), subject: subject.trim() || t("Sin nombre", "Sense nom"), score: graded.score }, ...current.attempts].slice(0, 8) }));
    setStep("result");
  };

  const advance = (finalAnswers: Record<string, number | string>) => {
    if (index + 1 < quiz.length) { setIndex(index + 1); setDraft(""); setRevealed(false); }
    else finish(finalAnswers);
  };

  const current = quiz[index];
  const pick = (optionIndex: number) => {
    if (!current) return;
    setAnswers(prev => ({ ...prev, [current.id]: optionIndex }));
  };
  const selfEval = (knew: boolean) => {
    if (!current) return;
    const next = { ...answers, [current.id]: knew ? 1 : 0 };
    setAnswers(next);
    advance(next);
  };

  const retryFails = () => {
    if (!result) return;
    const ids = wrongQuestionIds(quiz, answers);
    setQuiz(quiz.filter(question => ids.includes(question.id)));
    setAnswers({}); setIndex(0); setDraft(""); setRevealed(false); setResult(null);
    setStep("exam");
  };
  const restart = () => { setStep("setup"); setQuiz([]); setAnswers({}); setResult(null); };
  const copyResult = () => { if (result) void navigator.clipboard?.writeText(shareText(result, subject, locale)); };

  if (step === "exam" && current) {
    const progress = Math.round((index / quiz.length) * 100);
    const answered = answers[current.id] !== undefined;
    return (
      <ToolShell id="exam">
        <Panel>
          <div className="ex-progress" role="progressbar" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={quiz.length}>
            <div className="ex-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="st-muted">{t(`Pregunta ${index + 1} de ${quiz.length}`, `Pregunta ${index + 1} de ${quiz.length}`)}</p>
          <h3 className="ex-question">{current.question}</h3>

          {current.options && (
            <div className="ex-options" role="group" aria-label={t("Opciones", "Opcions")}>
              {current.options.map((option, i) => (
                <button key={i} type="button" className={answers[current.id] === i ? "ex-option on" : "ex-option"} aria-pressed={answers[current.id] === i} onClick={() => pick(i)}>
                  {option}
                </button>
              ))}
            </div>
          )}
          {current.options && (
            <button type="button" className="st-button" disabled={!answered} onClick={() => advance(answers)}>
              {index + 1 < quiz.length ? t("Siguiente", "Següent") : t("Terminar", "Acabar")}
            </button>
          )}

          {!current.options && !revealed && (
            <div className="st-stack">
              <textarea className="st-textarea" value={draft} onChange={event => setDraft(event.target.value)}
                placeholder={t("Escribe tu respuesta…", "Escriu la teua resposta…")} />
              <button type="button" className="st-button" onClick={() => setRevealed(true)}>{t("Ver respuesta modelo", "Veure resposta model")}</button>
            </div>
          )}
          {!current.options && revealed && (
            <div className="ex-model">
              <p className="st-muted">{t("Autoevaluación: compárala con la respuesta modelo.", "Autoavaluació: compara-la amb la resposta model.")}</p>
              <p className="ex-model-text">{String(current.answer)}</p>
              <div className="st-row">
                <button type="button" className="st-button" onClick={() => selfEval(true)}><CheckCircle2 aria-hidden="true" />{t("Lo sabía", "Ho sabia")}</button>
                <button type="button" className="st-button st-button-secondary" onClick={() => selfEval(false)}><XCircle aria-hidden="true" />{t("No lo sabía", "No ho sabia")}</button>
              </div>
            </div>
          )}
        </Panel>
      </ToolShell>
    );
  }

  if (step === "result" && result) {
    const tone = result.score >= 70 ? "good" : result.score >= 40 ? "warn" : "bad";
    return (
      <ToolShell id="exam">
        <div className="st-stack">
          <Panel>
            <Stat label={t("Tu nivel estimado", "El teu nivell estimat")} value={`${result.score} %`} tone={tone} />
            <p className="st-muted">{t(`${result.correct} de ${result.total} correctas.`, `${result.correct} de ${result.total} correctes.`)}</p>
          </Panel>

          {result.byTopic.length > 0 && (
            <Panel title={t("Por tema", "Per tema")}>
              <ul className="ex-topics">
                {result.byTopic.map(topic => (
                  <li key={topic.topic} className="ex-topic-row">
                    <span>{topic.topic}</span>
                    <span className={`ex-topic-badge ex-tone-${levelTone(topic.level)}`}>{levelLabel(topic.level, t)} · {topic.correct}/{topic.total}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {result.review.length > 0 && (
            <Panel title={t("Repaso", "Repàs")}>
              <ul className="ex-review">
                {result.review.map(item => (
                  <li key={item.id} className="ex-review-item">
                    <strong>{item.question}</strong>
                    <p className="st-muted">{t("Tu respuesta: ", "La teua resposta: ")}{item.yours}</p>
                    <p className="st-muted">{t("Correcta: ", "Correcta: ")}{item.right}</p>
                    <p>{item.explanation}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel>
            <div className="st-row">
              {result.review.length > 0 && <button type="button" className="st-button" onClick={retryFails}><RotateCcw aria-hidden="true" />{t("Repetir solo los fallos", "Repetir només les errades")}</button>}
              <button type="button" className="st-button st-button-secondary" onClick={restart}>{t("Otro test", "Un altre test")}</button>
              <button type="button" className="st-button-ghost st-button" onClick={copyResult}><Copy aria-hidden="true" />{t("Copiar resultado", "Copia el resultat")}</button>
            </div>
          </Panel>
        </div>
      </ToolShell>
    );
  }

  return (
    <ToolShell id="exam">
      <div className="st-stack">
        {demo && <Notice>{t("En la demo las preguntas se generan en tu navegador con reglas sencillas; con cuenta real responde la IA.", "En la demo les preguntes es generen en el teu navegador amb regles senzilles; amb compte real respon la IA.")}</Notice>}
        <Panel title={t("Elige tus documentos", "Tria els teus documents")}>
          {docs.length === 0
            ? <Notice tone="warn">
                {t("Todavía no has subido apuntes. ", "Encara no has pujat apunts. ")}
                <Link href={toolPath(locale, demo, "notes")}>{t("Súbelos en el Tutor de apuntes", "Puja’ls al Tutor d’apunts")}</Link>
              </Notice>
            : <ul className="ex-docs">
                {docs.map(doc => (
                  <li key={doc.id} className="ex-doc">
                    <label className="ex-doc-check">
                      <input type="checkbox" checked={!excluded.has(doc.id)} onChange={() => toggle(doc.id)} />
                      <span>{doc.name}</span>
                    </label>
                  </li>
                ))}
              </ul>}
        </Panel>

        <Panel title={t("¿Cuántas preguntas?", "Quantes preguntes?")}>
          <div className="ex-chips" role="group" aria-label={t("Número de preguntas", "Nombre de preguntes")}>
            {COUNTS.map(value => (
              <button key={value} type="button" className={count === value ? "ex-chip on" : "ex-chip"} aria-pressed={count === value} onClick={() => setCount(value)}>{value}</button>
            ))}
          </div>
        </Panel>

        <Panel title={t("¿De qué tipo?", "De quin tipus?")}>
          <div className="ex-chips" role="group" aria-label={t("Tipo de preguntas", "Tipus de preguntes")}>
            {KINDS.map(value => (
              <button key={value} type="button" className={kind === value ? "ex-chip on" : "ex-chip"} aria-pressed={kind === value} onClick={() => setKind(value)}>{kindLabel(value, t)}</button>
            ))}
          </div>
        </Panel>

        <Panel title={t("Asignatura", "Assignatura")}>
          <input className="st-input" value={subject} onChange={event => setSubject(event.target.value)} placeholder={t("Por ejemplo: Derecho Penal", "Per exemple: Dret Penal")} maxLength={60} />
        </Panel>

        {setupError && <Notice tone="error">{setupError}</Notice>}
        {unavailable && (
          <Notice tone="warn">
            {t("El tutor todavía no está activado en cuentas reales. ", "El tutor encara no està activat en comptes reals. ")}
            <Link href={toolPath(locale, true, "exam")}>{t("Pruébalo en la demo", "Prova-ho en la demo")}</Link>
          </Notice>
        )}
        <button type="button" className="st-button" disabled={!included.length || asking} onClick={() => void startQuiz()}>
          <ClipboardCheck aria-hidden="true" />{asking ? t("Preparando…", "Preparant…") : t("Examíname", "Examina’m")}
        </button>

        {history.attempts.length > 0 && (
          <Panel title={t("Tus últimos simulacros", "Els teus últims simulacres")}>
            <ul className="ex-history">
              {history.attempts.map(attempt => (
                <li key={attempt.id} className="ex-history-row">
                  <span>{new Date(attempt.date).toLocaleDateString(locale === "va" ? "ca-ES" : "es-ES")}</span>
                  <span>{attempt.subject}</span>
                  <strong>{attempt.score} %</strong>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </ToolShell>
  );
}
