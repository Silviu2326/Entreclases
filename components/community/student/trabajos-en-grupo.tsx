"use client";
import { Confirm } from "../controls";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, CheckCircle2, Circle, CircleDashed, ListPlus, Plus, Trash2, Copy, X } from "lucide-react";
import { ToolShell, Panel, Stat, Notice, useTool } from "./shared";
import { useToolStore, newId } from "@/lib/community/student/storage";
import {
  balanceMessage, daysLeft, formatDate, groupSummary, progress, sampleWork, splitBrief, todayISO,
  type Member, type Task, type TaskStatus, type Translate, type Work,
} from "@/lib/community/student/teamwork";
import "./trabajos-en-grupo.css";

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = { todo: "doing", doing: "done", done: "todo" };
const STATUS_ICON: Record<TaskStatus, ReactNode> = {
  todo: <Circle aria-hidden="true" />, doing: <CircleDashed aria-hidden="true" />, done: <CheckCircle2 aria-hidden="true" />,
};

/** Clipboard write with a silent fallback for browsers without the async Clipboard API. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy textarea + execCommand fallback below
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export default function Screen() {
  const { t, locale, me, key } = useTool("teamwork");
  const today = useMemo(() => todayISO(), []);
  const [works, setWorks, ready] = useToolStore<Work[]>(key, [sampleWork(me.name, t, today)]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = works.find(work => work.id === selectedId) ?? null;

  const updateWork = (id: string, updater: (work: Work) => Work) => {
    setWorks(current => current.map(work => (work.id === id ? updater(work) : work)));
  };

  // ---- Creating a new work ----
  const [creating, setCreating] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftDue, setDraftDue] = useState("");
  const createWork = () => {
    if (!draftTitle.trim()) return;
    const work: Work = {
      id: newId(), title: draftTitle.trim(), subject: draftSubject.trim(), due: draftDue || null,
      members: [{ id: me.user_id, name: me.name }], tasks: [], notes: "", createdAt: new Date().toISOString(),
    };
    setWorks(current => [work, ...current]);
    setDraftTitle(""); setDraftSubject(""); setDraftDue(""); setCreating(false);
    setSelectedId(work.id);
  };

  // ---- Members ----
  const [memberName, setMemberName] = useState("");
  const addMember = () => {
    if (!selected || !memberName.trim()) return;
    updateWork(selected.id, work => ({ ...work, members: [...work.members, { id: newId(), name: memberName.trim() }] }));
    setMemberName("");
  };
  const removeMember = (memberId: string) => {
    if (!selected) return;
    updateWork(selected.id, work => ({
      ...work,
      members: work.members.filter(member => member.id !== memberId),
      tasks: work.tasks.map(task => (task.assignee === memberId ? { ...task, assignee: null } : task)),
    }));
  };

  // ---- Tasks ----
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const addTask = () => {
    if (!selected || !taskTitle.trim()) return;
    const task: Task = { id: newId(), title: taskTitle.trim(), assignee: taskAssignee || null, status: "todo", due: taskDue || null };
    updateWork(selected.id, work => ({ ...work, tasks: [...work.tasks, task] }));
    setTaskTitle(""); setTaskAssignee(""); setTaskDue("");
  };
  const cycleStatus = (taskId: string) => {
    if (!selected) return;
    updateWork(selected.id, work => ({ ...work, tasks: work.tasks.map(task => (task.id === taskId ? { ...task, status: NEXT_STATUS[task.status] } : task)) }));
  };
  const setTaskAssigneeFor = (taskId: string, assignee: string) => {
    if (!selected) return;
    updateWork(selected.id, work => ({ ...work, tasks: work.tasks.map(task => (task.id === taskId ? { ...task, assignee: assignee || null } : task)) }));
  };
  const setTaskDueFor = (taskId: string, due: string) => {
    if (!selected) return;
    updateWork(selected.id, work => ({ ...work, tasks: work.tasks.map(task => (task.id === taskId ? { ...task, due: due || null } : task)) }));
  };
  const removeTask = (taskId: string) => {
    if (!selected) return;
    updateWork(selected.id, work => ({ ...work, tasks: work.tasks.filter(task => task.id !== taskId) }));
  };

  // ---- Repartir el enunciado ----
  const [briefText, setBriefText] = useState("");
  const [proposals, setProposals] = useState<string[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const proposeTasks = () => {
    const result = splitBrief(briefText);
    setProposals(result);
    setChecked(new Set(result.map((_, index) => index)));
  };
  const toggleProposal = (index: number) => {
    setChecked(current => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };
  const addProposals = () => {
    if (!selected) return;
    const chosen = proposals.filter((_, index) => checked.has(index));
    if (chosen.length === 0) return;
    const newTasks: Task[] = chosen.map(title => ({ id: newId(), title, assignee: null, status: "todo", due: null }));
    updateWork(selected.id, work => ({ ...work, tasks: [...work.tasks, ...newTasks] }));
    setProposals([]); setBriefText(""); setChecked(new Set());
  };

  // ---- Copy summary ----
  const [copied, setCopied] = useState(false);
  const copySummary = async () => {
    if (!selected) return;
    const ok = await copyText(groupSummary(selected, locale, today));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const removeWork = (id: string) => {
    setWorks(current => current.filter(work => work.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  if (!ready) return <ToolShell id="teamwork"><Panel>{t("Cargando…", "Carregant…")}</Panel></ToolShell>;

  if (!selected) {
    return <ToolShell id="teamwork">
      <Panel title={t("Tus trabajos en grupo", "Els teus treballs en grup")}>
        <div className="tw-list-actions">
          <button type="button" className="st-button" onClick={() => setCreating(value => !value)}>
            <Plus aria-hidden="true" />{t("Nuevo trabajo", "Nou treball")}
          </button>
        </div>
        {creating && <div className="st-stack">
          <label className="st-label">{t("Título", "Títol")}
            <input className="st-input" value={draftTitle} onChange={event => setDraftTitle(event.target.value)} maxLength={80} autoFocus />
          </label>
          <label className="st-label">{t("Asignatura", "Assignatura")}
            <input className="st-input" value={draftSubject} onChange={event => setDraftSubject(event.target.value)} maxLength={60} />
          </label>
          <label className="st-label">{t("Fecha de entrega", "Data d'entrega")}
            <input type="date" className="st-input" value={draftDue} onChange={event => setDraftDue(event.target.value)} />
          </label>
          <div className="st-row">
            <button type="button" className="st-button" disabled={!draftTitle.trim()} onClick={createWork}>{t("Crear", "Crear")}</button>
            <button type="button" className="st-button-ghost" onClick={() => setCreating(false)}>{t("Cancelar", "Cancel·lar")}</button>
          </div>
        </div>}
        {works.length === 0
          ? <p className="st-muted">{t("Todavía no tienes ningún trabajo en grupo.", "Encara no tens cap treball en grup.")}</p>
          : <div className="tw-cards">
            {works.map(work => <WorkCard key={work.id} work={work} t={t} today={today} onOpen={() => setSelectedId(work.id)} />)}
          </div>}
      </Panel>
    </ToolShell>;
  }

  const stats = progress(selected);
  const notice = balanceMessage(selected, t);
  const left = daysLeft(selected.due, today);
  const dueLabel = left === null ? t("Sin fecha", "Sense data")
    : left < 0 ? t(`Hace ${Math.abs(left)} días`, `Fa ${Math.abs(left)} dies`)
    : left === 0 ? t("Hoy", "Hui")
    : t(`${left} días`, `${left} dies`);
  const dueTone: "plain" | "warn" | "bad" = left === null ? "plain" : left < 0 ? "bad" : left <= 3 ? "warn" : "plain";

  return <ToolShell id="teamwork">
    <div className="st-stack">
      <button type="button" className="st-button-ghost" onClick={() => setSelectedId(null)}>
        <ArrowLeft aria-hidden="true" />{t("Todos los trabajos", "Tots els treballs")}
      </button>

      <Panel>
        <div className="tw-detail-head">
          <div className="tw-detail-title">
            <h3>{selected.title}</h3>
            {selected.subject && <p>{selected.subject}</p>}
          </div>
          <Confirm title={t("¿Borrar este trabajo?", "Vols esborrar este treball?")} description={t("Se borran sus tareas y su reparto. No se puede deshacer.", "S’esborren les seues tasques i el seu repartiment. No es pot desfer.")} onConfirm={async () => { removeWork(selected.id); return true; }}><button type="button" className="st-button-ghost">
            <Trash2 aria-hidden="true" />{t("Borrar trabajo", "Esborrar treball")}
          </button></Confirm>
        </div>
        <div className="tw-progress"><span style={{ width: `${stats.percent}%` }} /></div>
        <div className="st-grid">
          <Stat label={t("Hecho", "Fet")} value={`${stats.percent}% (${stats.done}/${stats.total})`} tone={stats.total > 0 && stats.percent === 100 ? "good" : "plain"} />
          <Stat label={t("Días para entregar", "Dies per a entregar")} value={dueLabel} tone={dueTone} />
        </div>
      </Panel>

      {notice && <Notice tone="warn">{notice}</Notice>}

      <Panel title={t("Quién está en el equipo", "Qui és a l'equip")}>
        <div className="tw-chips">
          {selected.members.map(member => <span className="tw-chip" key={member.id}>
            {member.name}
            <button type="button" onClick={() => removeMember(member.id)} aria-label={t(`Quitar a ${member.name}`, `Traure ${member.name}`)}>
              <X aria-hidden="true" />
            </button>
          </span>)}
        </div>
        <div className="tw-add-row">
          <input className="st-input" placeholder={t("Nombre", "Nom")} value={memberName} maxLength={40}
            onChange={event => setMemberName(event.target.value)}
            onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addMember(); } }} />
          <button type="button" className="st-button-secondary" disabled={!memberName.trim()} onClick={addMember}>
            <Plus aria-hidden="true" />{t("Añadir", "Afig")}
          </button>
        </div>
      </Panel>

      <Panel title={t("Tareas", "Tasques")}>
        <div className="tw-tasks">
          {selected.tasks.map(task => <TaskRow key={task.id} task={task} members={selected.members} t={t} locale={locale} today={today}
            onCycle={() => cycleStatus(task.id)} onAssign={value => setTaskAssigneeFor(task.id, value)}
            onDue={value => setTaskDueFor(task.id, value)} onRemove={() => removeTask(task.id)} />)}
          {selected.tasks.length === 0 && <p className="st-muted">{t("Todavía no hay tareas.", "Encara no hi ha tasques.")}</p>}
        </div>
        <div className="tw-task-form">
          <input className="st-input" placeholder={t("Nueva tarea", "Nova tasca")} value={taskTitle} maxLength={120}
            onChange={event => setTaskTitle(event.target.value)} />
          <div className="st-row">
            <select className="st-select" value={taskAssignee} onChange={event => setTaskAssignee(event.target.value)}>
              <option value="">{t("Sin asignar", "Sense assignar")}</option>
              {selected.members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
            <input type="date" className="st-input" value={taskDue} onChange={event => setTaskDue(event.target.value)} />
            <button type="button" className="st-button-secondary" disabled={!taskTitle.trim()} onClick={addTask}>
              <Plus aria-hidden="true" />{t("Añadir tarea", "Afig tasca")}
            </button>
          </div>
        </div>
      </Panel>

      <Panel title={t("Repartir el enunciado", "Repartir l'enunciat")} className="tw-brief">
        <p className="st-muted">{t(
          "Pega aquí el enunciado y lo dividimos en frases, por líneas, viñetas y verbos como «buscar» o «redactar». No es inteligencia artificial, solo un reparto mecánico: revísalo antes de asignarlo.",
          "Enganxa ací l'enunciat i el dividim en frases, per línies, vinyetes i verbs com «cercar» o «redactar». No és intel·ligència artificial, només un repartiment mecànic: revisa-ho abans d'assignar-ho.",
        )}</p>
        <textarea className="st-textarea" value={briefText} onChange={event => setBriefText(event.target.value)}
          placeholder={t("Pega aquí el enunciado del trabajo…", "Enganxa ací l'enunciat del treball…")} />
        <div className="st-row">
          <button type="button" className="st-button-secondary" disabled={!briefText.trim()} onClick={proposeTasks}>
            <ListPlus aria-hidden="true" />{t("Proponer tareas", "Proposar tasques")}
          </button>
        </div>
        {proposals.length > 0 && <>
          <div className="tw-proposals">
            {proposals.map((proposal, index) => <label className="tw-proposal" key={`${index}-${proposal}`}>
              <input type="checkbox" checked={checked.has(index)} onChange={() => toggleProposal(index)} />
              <span>{proposal}</span>
            </label>)}
          </div>
          <div className="st-row">
            <button type="button" className="st-button" disabled={checked.size === 0} onClick={addProposals}>
              {t("Añadir seleccionadas", "Afig les seleccionades")}
            </button>
          </div>
        </>}
      </Panel>

      <Panel>
        <div className="tw-summary-actions">
          <button type="button" className="st-button" onClick={() => void copySummary()}>
            <Copy aria-hidden="true" />{t("Copiar resumen para el grupo", "Copia el resum per al grup")}
          </button>
          {copied && <span className="tw-copied">{t("Copiado", "Copiat")}</span>}
        </div>
      </Panel>
    </div>
  </ToolShell>;
}

function WorkCard({ work, t, today, onOpen }: { work: Work; t: Translate; today: string; onOpen: () => void }) {
  const stats = progress(work);
  const left = daysLeft(work.due, today);
  const dueClass = left === null ? "tw-due" : left < 0 ? "tw-due tw-due-bad" : left <= 3 ? "tw-due tw-due-warn" : "tw-due";
  const dueText = !work.due || left === null ? t("Sin fecha", "Sense data")
    : left < 0 ? t(`Venció hace ${Math.abs(left)} días`, `Va véncer fa ${Math.abs(left)} dies`)
    : left === 0 ? t("Entrega hoy", "Entrega hui")
    : t(`Quedan ${left} días`, `Queden ${left} dies`);
  return <button type="button" className="tw-card" onClick={onOpen}>
    <span className="tw-card-title">{work.title}</span>
    {work.subject && <span className="tw-card-subject">{work.subject}</span>}
    <span className="tw-card-bar"><span style={{ width: `${stats.percent}%` }} /></span>
    <span className="tw-card-foot">
      <span>{stats.percent}% · {stats.done}/{stats.total}</span>
      <span className={dueClass}>{dueText}</span>
    </span>
  </button>;
}

function TaskRow({ task, members, t, locale, today, onCycle, onAssign, onDue, onRemove }: {
  task: Task; members: Member[]; t: Translate; locale: string; today: string;
  onCycle: () => void; onAssign: (value: string) => void; onDue: (value: string) => void; onRemove: () => void;
}) {
  const left = daysLeft(task.due, today);
  const overdue = task.status !== "done" && left !== null && left < 0;
  return <div className="tw-task">
    <button type="button" className="tw-task-status" onClick={onCycle} aria-label={t(`Cambiar estado de ${task.title}`, `Canvia l'estat de ${task.title}`)}>
      {STATUS_ICON[task.status]}
    </button>
    <div className="tw-task-main">
      <span className={task.status === "done" ? "tw-task-title is-done" : "tw-task-title"}>{task.title}</span>
      <div className="tw-task-meta">
        <select value={task.assignee ?? ""} onChange={event => onAssign(event.target.value)}>
          <option value="">{t("Sin asignar", "Sense assignar")}</option>
          {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select>
        <input type="date" value={task.due ?? ""} onChange={event => onDue(event.target.value)} />
        {task.due && <span className={overdue ? "tw-task-due tw-task-due-bad" : "tw-task-due"}>{formatDate(task.due, locale)}</span>}
      </div>
    </div>
    <button type="button" className="tw-task-remove" onClick={onRemove} aria-label={t(`Borrar ${task.title}`, `Esborra ${task.title}`)}>
      <Trash2 aria-hidden="true" />
    </button>
  </div>;
}
