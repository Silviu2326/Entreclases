"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, BookOpen, CalendarDays, Check, CirclePlus, Clock3, FileText, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useCommunity } from "../context";
import { languageIndex, toolPath } from "@/lib/community/student/catalog";
import { useNotesStore, notesStoreKey } from "@/lib/community/student/notes";
import { newId, storageKey, useToolStore } from "@/lib/community/student/storage";
import { useTool } from "./shared";
import "./subjects.css";

type Subject = { id: string; name: string; examDate: string; noteIds: string[]; createdAt: string };
type SubjectState = { subjects: Subject[] };
type ExamAttempt = { id: string; date: string; subject: string; score: number };
type ExamState = { attempts: ExamAttempt[] };
const emptySubjects: SubjectState = { subjects: [] };
const emptyExams: ExamState = { attempts: [] };

function dateDistance(date: string, locale: string, t: (es: string, va: string) => string) {
  if (!date) return t("Sin fecha de examen", "Sense data d’examen");
  const day = new Date(date + "T12:00:00");
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const days = Math.ceil((day.getTime() - today.getTime()) / 86400000);
  if (days < 0) return t("Examen pasado", "Examen passat");
  if (days === 0) return t("Examen hoy", "Examen hui");
  if (days === 1) return t("Mañana", "Demà");
  if (days < 14) return t("En " + days + " días", "D’ací a " + days + " dies");
  return day.toLocaleDateString(locale === "va" ? "ca-ES" : "es-ES", { day: "numeric", month: "short" });
}

export function SubjectsWorkspace() {
  const { locale, demo, me } = useCommunity();
  const lang = languageIndex(locale);
  const { t } = useTool("notes");
  const scope = { demo, userId: me.user_id };
  const subjectKey = storageKey(scope, "subjects");
  const examKey = storageKey(scope, "exam");
  const [state, setState, ready] = useToolStore<SubjectState>(subjectKey, emptySubjects);
  const [examState] = useToolStore<ExamState>(examKey, emptyExams);
  const { docs } = useNotesStore(notesStoreKey({ demo, userId: me.user_id }));
  const [editing, setEditing] = useState<Subject | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

  const subjects = state.subjects;
  const now = new Date();
  const today = String(now.getFullYear()).padStart(4, "0") + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  const nextSubject = subjects.filter(subject => subject.examDate && subject.examDate >= today).sort((a, b) => a.examDate.localeCompare(b.examDate))[0] ?? subjects[0];

  const beginEdit = (subject?: Subject) => {
    setEditing(subject ?? null); setModalOpen(true);
    setName(subject?.name ?? ""); setExamDate(subject?.examDate ?? ""); setSelectedDocs(subject?.noteIds ?? []);
  };
  const saveSubject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    const next: Subject = { id: editing?.id ?? newId(), name: cleanName, examDate, noteIds: selectedDocs, createdAt: editing?.createdAt ?? new Date().toISOString() };
    setState(current => ({ subjects: editing ? current.subjects.map(item => item.id === editing.id ? next : item) : [...current.subjects, next] }));
    setModalOpen(false);
  };
  const quizHref = (subject: Subject) => {
    const params = new URLSearchParams({ subject: subject.name, docs: subject.noteIds.join(","), count: "5" });
    return toolPath(locale, demo, "exam") + "&" + params.toString();
  };
  const latestFor = (subjectName: string) => examState.attempts.find(attempt => attempt.subject.trim().toLocaleLowerCase() === subjectName.trim().toLocaleLowerCase());

  if (!ready) return <section className="sw-workspace" aria-busy="true"><p>{t("Preparando tus asignaturas…", "Preparant les teues assignatures…")}</p></section>;
  return <section className="sw-workspace" aria-labelledby="sw-title">
    <div className="sw-heading">
      <div><span className="sw-kicker">{lang ? "EL TEU ESPAI D’ESTUDI" : "TU ESPACIO DE ESTUDIO"}</span><h2 id="sw-title">{t("Una asignatura cada vez.", "Una assignatura cada vegada.")}</h2><p>{t("Apuntes, examen y siguiente paso en el mismo sitio.", "Apunts, examen i el pas següent al mateix lloc.")}</p></div>
      <button type="button" className="sw-add" onClick={() => beginEdit()}><Plus aria-hidden="true"/><span>{t("Añadir asignatura", "Afegir assignatura")}</span></button>
    </div>
    {nextSubject && <div className="sw-today">
      <span className="sw-today-icon"><Sparkles aria-hidden="true"/></span>
      <div className="sw-today-copy"><span>{t("EL SIGUIENTE PASO", "EL PAS SEGÜENT")}</span><strong>{nextSubject.name}</strong><p>{nextSubject.noteIds.length ? t(nextSubject.noteIds.length + " documentos listos para repasar.", nextSubject.noteIds.length + " documents preparats per a repassar.") : t("Añade apuntes para preparar un repaso basado en tu material.", "Afig apunts per a preparar un repàs basat en el teu material.")}</p></div>
      {nextSubject.noteIds.length ? <Link className="sw-session" href={quizHref(nextSubject)}><Clock3 aria-hidden="true"/>{t("Hacer un repaso", "Fer un repàs")}<ArrowRight aria-hidden="true"/></Link> : <Link className="sw-session" href={toolPath(locale, demo, "notes")}><BookOpen aria-hidden="true"/>{t("Añadir apuntes", "Afegir apunts")}<ArrowRight aria-hidden="true"/></Link>}
    </div>}
    {subjects.length ? <div className="sw-grid">
      {subjects.map((subject, index) => {
        const latest = latestFor(subject.name);
        const attached = docs.filter(doc => subject.noteIds.includes(doc.id));
        return <article className={"sw-card sw-card-" + (index % 4)} key={subject.id}>
          <div className="sw-card-top"><span className="sw-card-mark"><BookOpen aria-hidden="true"/></span><div className="sw-card-tools"><button type="button" aria-label={t("Editar " + subject.name, "Editar " + subject.name)} onClick={() => beginEdit(subject)}><Pencil aria-hidden="true"/></button><button type="button" aria-label={t("Eliminar " + subject.name, "Eliminar " + subject.name)} onClick={() => { if (window.confirm(t("¿Eliminar esta asignatura y su organización?", "Vols eliminar aquesta assignatura i la seua organització?"))) setState(current => ({ subjects: current.subjects.filter(item => item.id !== subject.id) })); }}><Trash2 aria-hidden="true"/></button></div></div>
          <h3>{subject.name}</h3>
          <div className="sw-meta"><span><CalendarDays aria-hidden="true"/>{dateDistance(subject.examDate, locale, t)}</span><span><FileText aria-hidden="true"/>{t(attached.length + " apuntes", attached.length + " apunts")}</span></div>
          <div className="sw-docs">{attached.length ? attached.slice(0, 2).map(doc => <span key={doc.id}><FileText aria-hidden="true"/>{doc.name}</span>) : <span className="sw-no-docs">{t("Todavía sin apuntes vinculados", "Encara sense apunts vinculats")}</span>}{attached.length > 2 && <span>+{attached.length - 2} {t("más", "més")}</span>}</div>
          <div className="sw-card-bottom">{latest ? <span className="sw-result"><Check aria-hidden="true"/>{t("Último repaso · " + latest.score + "%", "Últim repàs · " + latest.score + "%")}</span> : <span className="sw-result sw-result-empty">{t("Tu progreso aparecerá aquí", "El teu progrés apareixerà ací")}</span>}
            {attached.length ? <Link href={quizHref(subject)}>{t("Repasar", "Repassar")}<ArrowRight aria-hidden="true"/></Link> : <button type="button" onClick={() => beginEdit(subject)}>{t("Vincular apuntes", "Vincular apunts")}<ArrowRight aria-hidden="true"/></button>}
          </div>
        </article>;
      })}
    </div> : <div className="sw-empty"><span className="sw-empty-illustration"><BookOpen aria-hidden="true"/><CirclePlus aria-hidden="true"/></span><div><h3>{t("Empieza por una asignatura.", "Comença per una assignatura.")}</h3><p>{t("Guarda aquí los apuntes y la fecha del examen. Luego podrás preparar un repaso desde este mismo sitio.", "Guarda ací els apunts i la data de l’examen. Després podràs preparar un repàs des d’ací mateix.")}</p><button type="button" className="sw-empty-action" onClick={() => beginEdit()}><Plus aria-hidden="true"/>{t("Crear mi primera asignatura", "Crear la primera assignatura")}</button></div></div>}
    {modalOpen && <div className="sw-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setModalOpen(false); }}>
      <section className="sw-modal" role="dialog" aria-modal="true" aria-labelledby="sw-modal-title">
        <div className="sw-modal-heading"><div><span className="sw-kicker">{t("TU ESPACIO", "EL TEU ESPAI")}</span><h3 id="sw-modal-title">{editing ? t("Organizar asignatura", "Organitzar assignatura") : t("Nueva asignatura", "Nova assignatura")}</h3></div><button type="button" aria-label={t("Cerrar", "Tancar")} onClick={() => setModalOpen(false)}>×</button></div>
        <form onSubmit={saveSubject}>
          <label>{t("Nombre de la asignatura", "Nom de l’assignatura")}<input autoFocus required maxLength={70} value={name} onChange={event => setName(event.target.value)} placeholder={t("Ej. Microeconomía", "Ex. Microeconomia")}/></label>
          <label>{t("Fecha del examen (opcional)", "Data de l’examen (opcional)")}<input type="date" value={examDate} onChange={event => setExamDate(event.target.value)}/></label>
          <fieldset><legend>{t("Apuntes de tu Tutor", "Apunts del teu Tutor")}</legend>{docs.length ? <div className="sw-doc-picker">{docs.map(doc => <label key={doc.id} className={selectedDocs.includes(doc.id) ? "selected" : ""}><input type="checkbox" checked={selectedDocs.includes(doc.id)} onChange={() => setSelectedDocs(current => current.includes(doc.id) ? current.filter(id => id !== doc.id) : [...current, doc.id])}/><span><FileText aria-hidden="true"/><span><strong>{doc.name}</strong><small>{doc.chars.toLocaleString()} {t("caracteres", "caràcters")}</small></span></span></label>)}</div> : <p className="sw-no-library">{t("Aún no hay apuntes guardados. Súbelos en el Tutor y vuelve para vincularlos.", "Encara no hi ha apunts guardats. Puja’ls al Tutor i torna per a vincular-los.")} <Link href={toolPath(locale, demo, "notes")} onClick={() => setModalOpen(false)}>{t("Abrir el Tutor", "Obrir el Tutor")}<ArrowRight aria-hidden="true"/></Link></p>}</fieldset>
          <p className="sw-storage-note">{t("Por ahora esta organización se guarda en este navegador.", "De moment, aquesta organització es guarda en aquest navegador.")}</p>
          <div className="sw-modal-actions"><button type="button" onClick={() => setModalOpen(false)}>{t("Cancelar", "Cancel·lar")}</button><button type="submit" className="primary">{editing ? t("Guardar cambios", "Guardar canvis") : t("Crear asignatura", "Crear assignatura")}<ArrowRight aria-hidden="true"/></button></div>
        </form>
      </section>
    </div>}
  </section>;
}





