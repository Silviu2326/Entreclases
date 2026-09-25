"use client";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { Plus, Trash2, Check, Undo2, Upload, Download, ChevronLeft, ChevronRight, CalendarDays, ListChecks, GraduationCap } from "lucide-react";
import { ToolShell, Panel, Notice, useTool } from "./shared";
import { useToolStore, newId } from "@/lib/community/student/storage";
import {
  type CalendarState, type Course, type Deadline, type DeadlineKind,
  emptyState, todayKey, todayAgenda, upcoming, weekGrid,
  toIcs, importIcs, formatLongDate, formatShortDate, formatWeekdayShort, addDays, startOfWeek,
} from "@/lib/community/student/calendar";
import "./mi-semana.css";

type Tab = "week" | "upcoming" | "courses";
type T = (es: string, va: string) => string;

const WEEKDAY_LABELS: readonly [string, string][] = [
  ["Lunes", "Dilluns"], ["Martes", "Dimarts"], ["Miércoles", "Dimecres"], ["Jueves", "Dijous"],
  ["Viernes", "Divendres"], ["Sábado", "Dissabte"], ["Domingo", "Diumenge"],
];

function kindLabel(t: T, kind: DeadlineKind) {
  return kind === "exam" ? t("Examen", "Examen") : kind === "delivery" ? t("Entrega", "Lliurament") : t("Otro", "Altre");
}

function plural(t: T, n: number, es: string, va: string) {
  return t(`${n} ${es}${n === 1 ? "" : "s"}`, `${n} ${va}${n === 1 ? "" : "s"}`);
}

function daysLabel(t: T, daysLeft: number) {
  if (daysLeft === 0) return t("Hoy", "Hui");
  if (daysLeft > 0) return t(`En ${plural(t, daysLeft, "día", "dia")}`, `En ${plural(t, daysLeft, "día", "dia")}`);
  return t(`Hace ${plural(t, Math.abs(daysLeft), "día", "dia")}`, `Fa ${plural(t, Math.abs(daysLeft), "día", "dia")}`);
}

type NoticeItem = { id: string; tone: "warn" | "error"; text: string };

/** Notices for the "Hoy" block: overdue items always warn, exams warn up to 10 days
 * out (they need more lead time), deliveries/other only inside the last 3 days.
 * Today's own items are skipped here since they already show in the today list. */
function buildNotices(state: CalendarState, today: string, t: T): NoticeItem[] {
  const notices: NoticeItem[] = [];
  for (const item of upcoming(state, today, 14)) {
    const { deadline, daysLeft } = item;
    if (deadline.date === today) continue;
    if (daysLeft < 0) {
      notices.push({ id: deadline.id, tone: "error", text: t(`🔴 ${deadline.title} lleva ${plural(t, Math.abs(daysLeft), "día", "dia")} de retraso.`, `🔴 ${deadline.title} porta ${plural(t, Math.abs(daysLeft), "dia", "dia")} de retard.`) });
    } else if (deadline.kind === "exam" && daysLeft <= 10) {
      const subject = state.courses.find(course => course.id === deadline.courseId)?.name ?? deadline.title;
      notices.push({ id: deadline.id, tone: "warn", text: t(`🔥 Examen de ${subject} en ${plural(t, daysLeft, "día", "dia")}.`, `🔥 Examen de ${subject} en ${plural(t, daysLeft, "dia", "dia")}.`) });
    } else if (deadline.kind !== "exam" && daysLeft <= 3) {
      notices.push({ id: deadline.id, tone: "warn", text: t(`⚠️ Quedan ${plural(t, daysLeft, "día", "dia")} para entregar ${deadline.title}.`, `⚠️ Queden ${plural(t, daysLeft, "dia", "dia")} per a lliurar ${deadline.title}.`) });
    }
  }
  return notices;
}

export default function Screen() {
  const { t, locale, key, language } = useTool("calendar");
  const [state, setState, ready] = useToolStore<CalendarState>(key, emptyState());
  // Lazy initializers: read once at mount (like useTick's `Date.now()` in games/ui.tsx),
  // not on every render and not from an effect that would just set it synchronously.
  const [today] = useState(() => todayKey());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayKey()));
  const [tab, setTab] = useState<Tab>("week");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const agenda = useMemo(() => todayAgenda(state, today), [state, today]);
  const notices = useMemo(() => buildNotices(state, today, t), [state, today, t]);
  const week = useMemo(() => weekGrid(state, weekStart), [state, weekStart]);
  const pending = useMemo(() => upcoming(state, today, 36500), [state, today]);
  const done = useMemo(() => [...state.deadlines].filter(d => d.done).sort((a, b) => b.date.localeCompare(a.date)), [state.deadlines]);
  const isEmpty = state.courses.length === 0 && state.classes.length === 0 && state.deadlines.length === 0;

  if (!ready) return <ToolShell id="calendar"><Panel>{t("Cargando…", "Carregant…")}</Panel></ToolShell>;

  const markDone = (id: string, done: boolean) => setState(current => ({ ...current, deadlines: current.deadlines.map(d => d.id === id ? { ...d, done } : d) }));
  const deleteDeadline = (id: string) => setState(current => ({ ...current, deadlines: current.deadlines.filter(d => d.id !== id) }));
  const addDeadline = (draft: Omit<Deadline, "id" | "done">) => setState(current => ({ ...current, deadlines: [...current.deadlines, { ...draft, id: newId(), done: false }] }));
  const addCourse = (name: string, color: number) => setState(current => ({ ...current, courses: [...current.courses, { id: newId(), name, color }] }));
  const deleteCourse = (id: string) => setState(current => ({
    courses: current.courses.filter(course => course.id !== id),
    classes: current.classes.filter(slot => slot.courseId !== id),
    deadlines: current.deadlines.map(d => d.courseId === id ? { ...d, courseId: null } : d),
  }));
  const addSlot = (courseId: string, draft: { weekday: number; start: string; end: string; room: string }) =>
    setState(current => ({ ...current, classes: [...current.classes, { id: newId(), courseId, ...draft }] }));
  const deleteSlot = (id: string) => setState(current => ({ ...current, classes: current.classes.filter(slot => slot.id !== id) }));

  const onImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const result = importIcs(state, text);
      setState(result.state);
      const parts = [t(`${plural(t, result.addedClasses, "clase", "classe")} y ${plural(t, result.addedDeadlines, "fecha", "data")} añadidas.`, `${plural(t, result.addedClasses, "classe", "classe")} i ${plural(t, result.addedDeadlines, "data", "data")} afegides.`)];
      const duplicates = result.duplicateClasses + result.duplicateDeadlines;
      if (duplicates > 0) parts.push(t(`${plural(t, duplicates, "duplicado", "duplicat")} sin repetir.`, `${plural(t, duplicates, "duplicat", "duplicat")} sense repetir.`));
      setImportMsg(parts.join(" "));
    };
    reader.readAsText(file);
  };

  const onExport = () => {
    const blob = new Blob([toIcs(state)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mi-semana.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return <ToolShell id="calendar">
    <Panel className="cal-today">
      <div className="cal-today-date">{formatLongDate(today, locale)}</div>
      {agenda.classes.length === 0 && agenda.deadlines.length === 0 && notices.length === 0
        ? <p className="st-muted">{t("Hoy no tienes nada apuntado. Buen día para respirar.", "Hui no tens res apuntat. Bon dia per a respirar.")}</p>
        : <ul className="cal-today-list">
          {agenda.classes.map(slot => <li key={slot.id} className={`cal-today-row cal-color-${slot.course?.color ?? 0}`}>
            <span className="cal-today-time">{slot.start}<small>{slot.end}</small></span>
            <span className="cal-today-body"><strong>{slot.course?.name ?? t("Clase", "Classe")}</strong><span>{slot.room}</span></span>
          </li>)}
          {agenda.deadlines.map(item => <li key={item.id} className={`cal-today-row cal-color-${state.courses.find(c => c.id === item.courseId)?.color ?? 0}`}>
            <span className="cal-today-time">{item.time ?? "—"}</span>
            <span className="cal-today-body"><strong className={item.done ? "cal-strike" : ""}>{item.title}</strong><span>{kindLabel(t, item.kind)}{item.courseId && ` · ${state.courses.find(c => c.id === item.courseId)?.name ?? ""}`}</span></span>
            <span className="cal-today-kind">{item.kind === "exam" ? <GraduationCap aria-hidden="true" /> : <ListChecks aria-hidden="true" />}</span>
          </li>)}
        </ul>}
      {notices.map(notice => <Notice key={notice.id} tone={notice.tone}>{notice.text}</Notice>)}
      <p className="st-muted">{t("Esta herramienta avisa cuando la abres, no manda notificaciones: no hay servidor detrás. Échale un vistazo cada mañana.", "Esta ferramenta avisa quan l'obris, no envia notificacions: no hi ha servidor darrere. Fes-hi una ullada cada matí.")}</p>
    </Panel>

    {isEmpty && <Panel className="st-panel-soft cal-empty">
      <strong>{t("Empieza añadiendo una asignatura o importa el calendario de tu aula virtual.", "Comença afegint una assignatura o importa el calendari de la teua aula virtual.")}</strong>
      <div className="st-row">
        <button type="button" className="st-button" onClick={() => setTab("courses")}><Plus aria-hidden="true" />{t("Añadir asignatura", "Afegir assignatura")}</button>
        <button type="button" className="st-button st-button-secondary" onClick={() => fileRef.current?.click()}><Upload aria-hidden="true" />{t("Importar .ics", "Importar .ics")}</button>
      </div>
    </Panel>}

    <div className="cal-tabs" role="tablist">
      <button type="button" role="tab" aria-selected={tab === "week"} className={`cal-tab ${tab === "week" ? "cal-tab-active" : ""}`} onClick={() => setTab("week")}><CalendarDays aria-hidden="true" />{t("Semana", "Setmana")}</button>
      <button type="button" role="tab" aria-selected={tab === "upcoming"} className={`cal-tab ${tab === "upcoming" ? "cal-tab-active" : ""}`} onClick={() => setTab("upcoming")}><ListChecks aria-hidden="true" />{t("Próximo", "Pròxim")}</button>
      <button type="button" role="tab" aria-selected={tab === "courses"} className={`cal-tab ${tab === "courses" ? "cal-tab-active" : ""}`} onClick={() => setTab("courses")}><GraduationCap aria-hidden="true" />{t("Asignaturas", "Assignatures")}</button>
    </div>

    {tab === "week" && <Panel>
      <div className="cal-week-nav">
        <span className="cal-week-label">{formatShortDate(weekStart, locale)} – {formatShortDate(addDays(weekStart, 6), locale)}</span>
        <div className="cal-week-nav-buttons">
          <button type="button" className="cal-icon-button" aria-label={t("Semana anterior", "Setmana anterior")} onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft aria-hidden="true" /></button>
          <button type="button" className="st-button st-button-ghost" onClick={() => setWeekStart(startOfWeek(today))}>{t("Hoy", "Hui")}</button>
          <button type="button" className="cal-icon-button" aria-label={t("Semana siguiente", "Setmana següent")} onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight aria-hidden="true" /></button>
        </div>
      </div>
      <div className="cal-grid">
        {week.map(day => <div key={day.date} className={`cal-day ${day.date === today ? "cal-day-today" : ""}`}>
          <div className="cal-day-head"><span>{formatWeekdayShort(day.date, locale)}</span><strong>{Number(day.date.slice(8, 10))}</strong></div>
          {day.classes.length === 0
            ? <p className="cal-day-empty">{t("Sin clases", "Sense classes")}</p>
            : <ul className="cal-day-classes">
              {day.classes.map(slot => <li key={slot.id} className={`cal-day-class cal-color-${slot.course?.color ?? 0}`}>
                <strong>{slot.course?.name ?? t("Clase", "Classe")}</strong>
                <span>{slot.start}–{slot.end}{slot.room && ` · ${slot.room}`}</span>
              </li>)}
            </ul>}
        </div>)}
      </div>
    </Panel>}

    {tab === "upcoming" && <div className="st-stack">
      <Panel>
        <AddDeadlineForm t={t} courses={state.courses} onAdd={addDeadline} />
      </Panel>
      <Panel>
        <h3>{t("Importar o exportar", "Importar o exportar")}</h3>
        <div className="cal-ics-row">
          <input ref={fileRef} type="file" accept=".ics,text/calendar" onChange={onImportFile} hidden />
          <button type="button" className="st-button st-button-secondary" onClick={() => fileRef.current?.click()}><Upload aria-hidden="true" />{t("Importar .ics", "Importar .ics")}</button>
          <button type="button" className="st-button st-button-secondary" disabled={isEmpty} onClick={onExport}><Download aria-hidden="true" />{t("Exportar .ics", "Exportar .ics")}</button>
        </div>
        {importMsg && <Notice>{importMsg}</Notice>}
      </Panel>
      <Panel>
        <h3>{t("Pendiente", "Pendent")}</h3>
        {pending.length === 0
          ? <p className="st-muted">{t("No hay entregas ni exámenes pendientes.", "No hi ha entregues ni examens pendents.")}</p>
          : <ul className="cal-upcoming-list">
            {pending.map(item => <li key={item.deadline.id} className={`cal-item ${["past", "today", "soon"].includes(item.urgency) ? `cal-item-${item.urgency}` : ""}`}>
              <span className={`cal-item-dot cal-color-${state.courses.find(c => c.id === item.deadline.courseId)?.color ?? 0}`} aria-hidden="true" />
              <span className="cal-item-body">
                <strong>{item.deadline.title}</strong>
                <span>{kindLabel(t, item.deadline.kind)}{item.deadline.courseId && ` · ${state.courses.find(c => c.id === item.deadline.courseId)?.name ?? ""}`} · {formatShortDate(item.deadline.date, locale)}{item.deadline.time && ` · ${item.deadline.time}`} · {daysLabel(t, item.daysLeft)}</span>
              </span>
              <span className="cal-item-actions">
                <button type="button" aria-label={t("Marcar como hecho", "Marcar com a fet")} onClick={() => markDone(item.deadline.id, true)}><Check aria-hidden="true" /></button>
                <button type="button" aria-label={t("Borrar", "Esborrar")} onClick={() => deleteDeadline(item.deadline.id)}><Trash2 aria-hidden="true" /></button>
              </span>
            </li>)}
          </ul>}
      </Panel>
      {done.length > 0 && <Panel>
        <h3>{t("Hecho", "Fet")}</h3>
        <ul className="cal-upcoming-list">
          {done.map(item => <li key={item.id} className="cal-item cal-item-done">
            <span className={`cal-item-dot cal-color-${state.courses.find(c => c.id === item.courseId)?.color ?? 0}`} aria-hidden="true" />
            <span className="cal-item-body">
              <strong className="cal-strike">{item.title}</strong>
              <span>{kindLabel(t, item.kind)} · {formatShortDate(item.date, locale)}</span>
            </span>
            <span className="cal-item-actions">
              <button type="button" aria-label={t("Marcar como pendiente", "Marcar com a pendent")} onClick={() => markDone(item.id, false)}><Undo2 aria-hidden="true" /></button>
              <button type="button" aria-label={t("Borrar", "Esborrar")} onClick={() => deleteDeadline(item.id)}><Trash2 aria-hidden="true" /></button>
            </span>
          </li>)}
        </ul>
      </Panel>}
    </div>}

    {tab === "courses" && <div className="st-stack">
      <Panel>
        <AddCourseForm t={t} onAdd={addCourse} />
      </Panel>
      {state.courses.length === 0
        ? <p className="st-muted">{t("Todavía no has añadido ninguna asignatura.", "Encara no has afegit cap assignatura.")}</p>
        : <ul className="cal-course-list">
          {state.courses.map(course => <li key={course.id}>
            <CourseCard t={t} language={language} course={course} slots={state.classes.filter(slot => slot.courseId === course.id)}
              onDelete={() => deleteCourse(course.id)} onAddSlot={draft => addSlot(course.id, draft)} onDeleteSlot={deleteSlot} />
          </li>)}
        </ul>}
    </div>}
  </ToolShell>;
}

function AddDeadlineForm({ t, courses, onAdd }: { t: T; courses: Course[]; onAdd: (draft: Omit<Deadline, "id" | "done">) => void }) {
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [kind, setKind] = useState<DeadlineKind>("delivery");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const submit = () => {
    if (!title.trim() || !date) return;
    onAdd({ title: title.trim(), courseId: courseId || null, kind, date, time: time || undefined });
    setTitle(""); setDate(""); setTime("");
  };

  return <div className="cal-form">
    <label className="st-label cal-form-wide">{t("Título", "Títol")}<input className="st-input" maxLength={80} placeholder={t("Entrega del tema 3", "Lliurament del tema 3")} value={title} onChange={event => setTitle(event.target.value)} /></label>
    <label className="st-label">{t("Asignatura", "Assignatura")}<select className="st-select" value={courseId} onChange={event => setCourseId(event.target.value)}>
      <option value="">{t("Sin asignatura", "Sense assignatura")}</option>
      {courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
    </select></label>
    <label className="st-label">{t("Tipo", "Tipus")}<select className="st-select" value={kind} onChange={event => setKind(event.target.value as DeadlineKind)}>
      <option value="delivery">{t("Entrega", "Lliurament")}</option>
      <option value="exam">{t("Examen", "Examen")}</option>
      <option value="other">{t("Otro", "Altre")}</option>
    </select></label>
    <label className="st-label">{t("Fecha", "Data")}<input className="st-input" type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
    <label className="st-label">{t("Hora (opcional)", "Hora (opcional)")}<input className="st-input" type="time" value={time} onChange={event => setTime(event.target.value)} /></label>
    <button type="button" className="st-button cal-form-submit" disabled={!title.trim() || !date} onClick={submit}><Plus aria-hidden="true" />{t("Añadir", "Afegir")}</button>
  </div>;
}

function AddCourseForm({ t, onAdd }: { t: T; onAdd: (name: string, color: number) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(0);
  const submit = () => { if (!name.trim()) return; onAdd(name.trim(), color); setName(""); setColor(0); };
  return <div className="st-stack">
    <div className="cal-form">
      <label className="st-label cal-form-wide">{t("Nueva asignatura", "Nova assignatura")}<input className="st-input" maxLength={60} placeholder={t("Economía", "Economia")} value={name} onChange={event => setName(event.target.value)} /></label>
    </div>
    <div className="cal-colors" role="radiogroup" aria-label={t("Color", "Color")}>
      {Array.from({ length: 7 }, (_, index) => index).map(n => <button key={n} type="button" role="radio" aria-checked={color === n} aria-label={t(`Color ${n + 1}`, `Color ${n + 1}`)}
        className={`cal-color-swatch cal-color-${n} ${color === n ? "cal-color-swatch-on" : ""}`} onClick={() => setColor(n)} />)}
    </div>
    <button type="button" className="st-button" disabled={!name.trim()} onClick={submit}><Plus aria-hidden="true" />{t("Añadir asignatura", "Afegir assignatura")}</button>
  </div>;
}

function CourseCard({ t, language, course, slots, onDelete, onAddSlot, onDeleteSlot }: {
  t: T; language: number; course: Course; slots: { id: string; weekday: number; start: string; end: string; room: string }[];
  onDelete: () => void; onAddSlot: (draft: { weekday: number; start: string; end: string; room: string }) => void; onDeleteSlot: (id: string) => void;
}) {
  return <div className="cal-course">
    <div className="cal-course-head">
      <span className={`cal-course-dot cal-color-${course.color}`} aria-hidden="true" />
      <strong>{course.name}</strong>
      <button type="button" className="st-button st-button-ghost" onClick={onDelete}><Trash2 aria-hidden="true" />{t("Borrar", "Esborrar")}</button>
    </div>
    {slots.length > 0 && <ul className="cal-course-slots">
      {[...slots].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start)).map(slot => <li key={slot.id} className="cal-course-slot">
        <span>{WEEKDAY_LABELS[slot.weekday - 1][language]} · {slot.start}–{slot.end}{slot.room && ` · ${slot.room}`}</span>
        <button type="button" className="cal-icon-button" aria-label={t("Borrar horario", "Esborrar horari")} onClick={() => onDeleteSlot(slot.id)}><Trash2 aria-hidden="true" /></button>
      </li>)}
    </ul>}
    <ScheduleForm t={t} language={language} onAdd={onAddSlot} />
  </div>;
}

function ScheduleForm({ t, language, onAdd }: { t: T; language: number; onAdd: (draft: { weekday: number; start: string; end: string; room: string }) => void }) {
  const [weekday, setWeekday] = useState(1);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [room, setRoom] = useState("");
  const submit = () => {
    if (!start || !end) return;
    onAdd({ weekday, start, end, room: room.trim() });
    setStart(""); setEnd(""); setRoom("");
  };
  return <div className="cal-form">
    <label className="st-label">{t("Día", "Dia")}<select className="st-select" value={weekday} onChange={event => setWeekday(Number(event.target.value))}>
      {WEEKDAY_LABELS.map((label, index) => <option key={index} value={index + 1}>{label[language]}</option>)}
    </select></label>
    <label className="st-label">{t("Hora inicio", "Hora d'inici")}<input className="st-input" type="time" value={start} onChange={event => setStart(event.target.value)} /></label>
    <label className="st-label">{t("Hora fin", "Hora de fi")}<input className="st-input" type="time" value={end} onChange={event => setEnd(event.target.value)} /></label>
    <label className="st-label">{t("Aula", "Aula")}<input className="st-input" maxLength={40} value={room} onChange={event => setRoom(event.target.value)} /></label>
    <button type="button" className="st-button st-button-secondary cal-form-submit" disabled={!start || !end} onClick={submit}><Plus aria-hidden="true" />{t("Añadir horario", "Afegir horari")}</button>
  </div>;
}
