// Pure data model and logic for "Trabajos en grupo" (group project tracker).
// No React here on purpose: every function below is plain data in, data out,
// so it can be unit tested without mounting a component.

export type MemberId = string;
export type TaskStatus = "todo" | "doing" | "done";

export interface Member {
  id: MemberId;
  name: string;
}

export interface Task {
  id: string;
  title: string;
  assignee: MemberId | null;
  status: TaskStatus;
  due: string | null; // YYYY-MM-DD
}

export interface Work {
  id: string;
  title: string;
  subject: string;
  due: string | null; // YYYY-MM-DD
  members: Member[];
  tasks: Task[];
  notes: string;
  createdAt: string; // ISO timestamp
}

export type Translate = (es: string, va: string) => string;

const pad = (value: number) => String(value).padStart(2, "0");

/** Today's date as YYYY-MM-DD, in the viewer's local calendar. */
export function todayISO(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Adds (or subtracts) whole days to a YYYY-MM-DD date, in UTC to avoid DST drift. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * 86400000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** Short localized date (e.g. "12 oct"), matching the rest of the student tools. */
export function formatDate(date: string, locale: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const asDate = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat(locale === "va" ? "ca-ES" : "es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(asDate);
}

/** Whole days between today and a due date; negative once it has passed. Null when there is no due date. */
export function daysLeft(due: string | null, today: string): number | null {
  if (!due) return null;
  const [dy, dm, dd] = due.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const dueUtc = Date.UTC(dy, dm - 1, dd);
  const todayUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((dueUtc - todayUtc) / 86400000);
}

export interface Progress {
  done: number;
  total: number;
  percent: number;
}

export function progress(work: Work): Progress {
  const total = work.tasks.length;
  const done = work.tasks.filter(task => task.status === "done").length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export interface BalanceEntry {
  member: Member;
  count: number;
}

export interface Balance {
  entries: BalanceEntry[];
  even: boolean;
  overloaded: MemberId[];
  idle: MemberId[];
}

/**
 * How tasks are spread across members. Descompensado ("uneven") when someone
 * carries at least twice the average, or when someone has zero tasks while
 * the work already has three or more tasks in total.
 */
export function balance(work: Work): Balance {
  const counts = new Map<MemberId, number>();
  for (const member of work.members) counts.set(member.id, 0);
  for (const task of work.tasks) {
    if (task.assignee && counts.has(task.assignee)) counts.set(task.assignee, (counts.get(task.assignee) ?? 0) + 1);
  }
  const entries = work.members.map(member => ({ member, count: counts.get(member.id) ?? 0 }));
  const total = work.tasks.length;
  const average = work.members.length > 0 ? total / work.members.length : 0;
  const overloaded = average > 0 ? entries.filter(entry => entry.count >= average * 2).map(entry => entry.member.id) : [];
  const idle = total >= 3 ? entries.filter(entry => entry.count === 0).map(entry => entry.member.id) : [];
  return { entries, even: overloaded.length === 0 && idle.length === 0, overloaded, idle };
}

/** A one-line warning naming who is overloaded and/or idle, or null when it is balanced. */
export function balanceMessage(work: Work, t: Translate): string | null {
  const result = balance(work);
  if (result.even) return null;
  const overloaded = result.entries.filter(entry => result.overloaded.includes(entry.member.id)).sort((a, b) => b.count - a.count);
  const idle = result.entries.filter(entry => result.idle.includes(entry.member.id));
  if (overloaded.length > 0 && idle.length > 0) {
    return t(
      `${overloaded[0].member.name} tiene ${overloaded[0].count} tareas y ${idle[0].member.name} ninguna.`,
      `${overloaded[0].member.name} té ${overloaded[0].count} tasques i ${idle[0].member.name} cap.`,
    );
  }
  if (overloaded.length > 0) {
    const names = overloaded.map(entry => entry.member.name).join(", ");
    return t(`${names} ${overloaded.length > 1 ? "tienen" : "tiene"} muchas más tareas que el resto.`, `${names} ${overloaded.length > 1 ? "tenen" : "té"} moltes més tasques que la resta.`);
  }
  const names = idle.map(entry => entry.member.name).join(", ");
  return t(`${names} ${idle.length > 1 ? "no tienen" : "no tiene"} ninguna tarea todavía.`, `${names} ${idle.length > 1 ? "no tenen" : "no té"} cap tasca encara.`);
}

// ---- Splitting a pasted brief into task proposals (no AI: just punctuation) ----

const ACTION_VERBS = [
  "analizar", "analitzar", "buscar", "cercar", "calcular", "coordinar", "corregir",
  "crear", "desarrollar", "desenvolupar", "diseñar", "dissenyar", "editar", "elaborar",
  "entregar", "escribir", "escriure", "exponer", "exposar", "grabar", "gravar", "hacer",
  "fer", "investigar", "leer", "llegir", "maquetar", "montar", "muntar", "organizar",
  "organitzar", "planificar", "preparar", "presentar", "programar", "recopilar",
  "redactar", "resumir", "revisar", "traducir", "traduir",
];

const BULLET_RE = /^[-*•▪·]\s+/;
const NUMBER_RE = /^\(?\d{1,2}[.)]\s+/;
const LETTER_RE = /^\(?[a-zA-Z][.)]\s+/;

function stripMarker(line: string): string {
  return line.replace(BULLET_RE, "").replace(NUMBER_RE, "").replace(LETTER_RE, "").trim();
}

function startsWithActionVerb(sentence: string): boolean {
  const first = sentence.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-zàáéèíïòóúü]/gi, "");
  return !!first && ACTION_VERBS.includes(first);
}

/** Splits a chunk of text at sentence boundaries, but only where the next sentence opens with an action verb. */
function splitByVerbSentences(text: string): string[] {
  const chunks = text.split(/(?<=[.;])\s+/);
  const sentences: string[] = [];
  let current = "";
  for (const chunk of chunks) {
    if (current && startsWithActionVerb(chunk)) {
      sentences.push(current.trim());
      current = chunk;
    } else {
      current = current ? `${current} ${chunk}` : chunk;
    }
  }
  if (current.trim()) sentences.push(current.trim());
  return sentences;
}

/**
 * Turns a pasted assignment brief into a list of task proposals: one per
 * line/bullet/numbered item, further split at sentences that open with an
 * action verb. Plain punctuation splitting, no AI. Capped at 12 proposals.
 */
export function splitBrief(text: string): string[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const proposals: string[] = [];
  for (const line of lines) {
    const stripped = stripMarker(line);
    if (!stripped) continue;
    for (const piece of splitByVerbSentences(stripped)) {
      const clean = piece.replace(/\s+/g, " ").replace(/[.;]+$/, "").trim();
      if (clean.length >= 4) proposals.push(clean);
    }
  }
  const unique: string[] = [];
  for (const proposal of proposals) {
    if (unique.length >= 12) break;
    if (!unique.some(existing => existing.toLowerCase() === proposal.toLowerCase())) unique.push(proposal);
  }
  return unique;
}

// ---- Summary ready to paste in the group chat ----

function statusIcon(status: TaskStatus): string {
  return status === "done" ? "✅" : status === "doing" ? "🟡" : "⬜";
}

export function groupSummary(work: Work, locale: string, today: string): string {
  const t: Translate = (es, va) => (locale === "va" ? va : es);
  const lines: string[] = [work.title || t("Trabajo en grupo", "Treball en grup")];
  if (work.subject) lines.push(work.subject);
  const left = daysLeft(work.due, today);
  if (work.due && left !== null) {
    const date = formatDate(work.due, locale);
    if (left < 0) lines.push(t(`Entrega: ${date} (hace ${Math.abs(left)} días)`, `Entrega: ${date} (fa ${Math.abs(left)} dies)`));
    else if (left === 0) lines.push(t(`Entrega: ${date} (hoy)`, `Entrega: ${date} (hui)`));
    else lines.push(t(`Entrega: ${date} (quedan ${left} días)`, `Entrega: ${date} (queden ${left} dies)`));
  } else {
    lines.push(t("Sin fecha de entrega", "Sense data d'entrega"));
  }
  lines.push("");

  const byMember = new Map<MemberId, Task[]>();
  const unassigned: Task[] = [];
  for (const task of work.tasks) {
    if (task.assignee) byMember.set(task.assignee, [...(byMember.get(task.assignee) ?? []), task]);
    else unassigned.push(task);
  }
  for (const member of work.members) {
    const tasks = byMember.get(member.id) ?? [];
    if (tasks.length === 0) continue;
    lines.push(`${member.name}:`);
    for (const task of tasks) lines.push(`${statusIcon(task.status)} ${task.title}`);
  }
  if (unassigned.length > 0) {
    lines.push(t("Sin asignar:", "Sense assignar:"));
    for (const task of unassigned) lines.push(`${statusIcon(task.status)} ${task.title}`);
  }
  return lines.join("\n");
}

// ---- Sample work shown before the student has created any of their own ----

export function sampleWork(meName: string, t: Translate, today: string): Work {
  const me: Member = { id: "me", name: meName };
  const ana: Member = { id: "sample-ana", name: "Ana" };
  const marc: Member = { id: "sample-marc", name: "Marc" };
  return {
    id: "sample-work",
    title: t("Trabajo de Marketing", "Treball de Màrqueting"),
    subject: t("Marketing", "Màrqueting"),
    due: addDays(today, 12),
    members: [me, ana, marc],
    tasks: [
      { id: "sample-task-1", title: t("Buscar datos del sector", "Cercar dades del sector"), assignee: ana.id, status: "done", due: null },
      { id: "sample-task-2", title: t("Redactar el análisis DAFO", "Redactar l'anàlisi DAFO"), assignee: marc.id, status: "doing", due: null },
      { id: "sample-task-3", title: t("Preparar las diapositivas", "Preparar les diapositives"), assignee: me.id, status: "todo", due: addDays(today, 10) },
      { id: "sample-task-4", title: t("Presentar en clase", "Presentar a classe"), assignee: null, status: "todo", due: addDays(today, 12) },
    ],
    notes: "",
    createdAt: new Date().toISOString(),
  };
}
