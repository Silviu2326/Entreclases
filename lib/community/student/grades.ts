import type { Locale } from "@/lib/i18n/routes";

// «¿Qué necesito en el final?» — lógica pura, sin React ni almacenamiento.
// Una asignatura se divide en partes (examen, prácticas...) con un peso en
// puntos porcentuales; algunas ya tienen nota y otras están pendientes.

export type Part = {
  id: string;
  name: string;
  weight: number; // puntos porcentuales, se espera que sumen 100 en toda la asignatura
  grade: number | null; // 0-10, null mientras está pendiente
  minimum?: number | null; // nota mínima exigida en esta parte, opcional
};

export type Subject = {
  id: string;
  name: string;
  target: number; // nota que se quiere alcanzar, 5 por defecto
  parts: Part[];
};

export function weightSum(subject: Subject): number {
  return subject.parts.reduce((sum, part) => sum + (Number.isFinite(part.weight) ? part.weight : 0), 0);
}

export type ValidationIssue =
  | { kind: "weight"; total: number }
  | { kind: "grade"; partId: string }
  | { kind: "minimum"; partId: string };

/** Pesos que no suman 100, notas fuera de 0-10 y notas por debajo de su mínimo. */
export function validate(subject: Subject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const total = weightSum(subject);
  if (subject.parts.length > 0 && Math.round(total) !== 100) issues.push({ kind: "weight", total });
  for (const part of subject.parts) {
    if (part.grade !== null && (part.grade < 0 || part.grade > 10)) issues.push({ kind: "grade", partId: part.id });
    if (part.grade !== null && part.minimum != null && part.grade < part.minimum) issues.push({ kind: "minimum", partId: part.id });
  }
  return issues;
}

export type GradeSummary = {
  graded: number | null; // media ponderada sobre las partes ya evaluadas (null si ninguna lo está)
  accumulated: number; // nota acumulada sobre 10, contando las partes pendientes como 0
};

/** Si los pesos no suman 100, ambas medias se calculan proporcionalmente sobre el total real. */
export function currentGrade(subject: Subject): GradeSummary {
  const total = weightSum(subject);
  const done = subject.parts.filter(part => part.grade !== null);
  const doneWeight = done.reduce((sum, part) => sum + part.weight, 0);
  const doneSum = done.reduce((sum, part) => sum + part.weight * (part.grade as number), 0);
  const graded = doneWeight > 0 ? doneSum / doneWeight : null;
  const accumulated = total > 0 ? doneSum / total : 0;
  return { graded, accumulated };
}

export type NeededResult = {
  needed: number | null; // nota necesaria en el conjunto de partes pendientes; null si no hay ninguna pendiente
  possible: boolean; // si el objetivo todavía se puede alcanzar
  maxReachable: number; // nota final si se sacara un 10 en todo lo pendiente
};

/** La misma nota en todas las partes pendientes para llegar a `target`. */
export function neededGrade(subject: Subject, target: number): NeededResult {
  const total = weightSum(subject);
  if (total <= 0) return { needed: null, possible: false, maxReachable: 0 };
  const pending = subject.parts.filter(part => part.grade === null);
  const pendingWeight = pending.reduce((sum, part) => sum + part.weight, 0);
  const doneSum = subject.parts.reduce((sum, part) => sum + (part.grade !== null ? part.weight * part.grade : 0), 0);
  const maxReachable = (doneSum + pendingWeight * 10) / total;
  if (pendingWeight <= 0) {
    const final = doneSum / total;
    return { needed: null, possible: final >= target, maxReachable: final };
  }
  const needed = (target * total - doneSum) / pendingWeight;
  return { needed, possible: needed <= 10, maxReachable };
}

export function formatGrade(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "va" ? "ca-ES" : "es-ES", { maximumFractionDigits: 1 }).format(value);
}

/** Texto listo para copiar al portapapeles con el estado de la asignatura. */
export function summaryText(subject: Subject, locale: Locale): string {
  const t = (es: string, va: string) => (locale === "va" ? va : es);
  const fmt = (value: number) => formatGrade(value, locale);
  const lines: string[] = [`${subject.name} — ${t("Objetivo", "Objectiu")}: ${fmt(subject.target)}`];
  for (const part of subject.parts) {
    const grade = part.grade !== null ? fmt(part.grade) : t("pendiente", "pendent");
    lines.push(`- ${part.name} (${fmt(part.weight)}%): ${grade}`);
  }
  const { graded, accumulated } = currentGrade(subject);
  lines.push(t(
    `Llevas: ${graded !== null ? fmt(graded) : "—"} · Acumulado: ${fmt(accumulated)}/10`,
    `Portes: ${graded !== null ? fmt(graded) : "—"} · Acumulat: ${fmt(accumulated)}/10`,
  ));
  const result = neededGrade(subject, subject.target);
  if (result.needed === null) {
    lines.push(result.possible
      ? t("Ya tienes la nota hecha.", "Ja tens la nota feta.")
      : t("Con las notas que tienes no llegas al objetivo.", "Amb les notes que tens no arribes a l’objectiu."));
  } else if (result.needed <= 0) {
    lines.push(t("Ya has aprobado, aunque saques un 0 en lo que queda.", "Ja has aprovat, encara que traguesses un 0 en el que queda."));
  } else if (result.needed > 10) {
    lines.push(t(
      `No es posible llegar a ${fmt(subject.target)}: como mucho puedes sacar un ${fmt(result.maxReachable)}.`,
      `No és possible arribar a ${fmt(subject.target)}: com a molt pots traure un ${fmt(result.maxReachable)}.`,
    ));
  } else {
    lines.push(t(
      `Necesitas un ${fmt(result.needed)} en lo que queda para llegar a ${fmt(subject.target)}.`,
      `Necessites un ${fmt(result.needed)} en el que queda per a arribar a ${fmt(subject.target)}.`,
    ));
  }
  return lines.join("\n");
}

export type PartTemplate = { name: readonly [string, string]; weight: number };
export type SubjectTemplate = { id: string; label: readonly [string, string]; parts: readonly PartTemplate[] };

// Plantillas rápidas para rellenar las partes de una asignatura de un toque.
export const partTemplates: readonly SubjectTemplate[] = [
  { id: "exam-lab-work", label: ["Examen 60 / Prácticas 20 / Trabajo 20", "Examen 60 / Pràctiques 20 / Treball 20"], parts: [
    { name: ["Examen", "Examen"], weight: 60 },
    { name: ["Prácticas", "Pràctiques"], weight: 20 },
    { name: ["Trabajo", "Treball"], weight: 20 },
  ] },
  { id: "midterm-final", label: ["Parcial 40 / Final 60", "Parcial 40 / Final 60"], parts: [
    { name: ["Parcial", "Parcial"], weight: 40 },
    { name: ["Final", "Final"], weight: 60 },
  ] },
  { id: "exam-only", label: ["Todo al examen", "Tot a l’examen"], parts: [
    { name: ["Examen", "Examen"], weight: 100 },
  ] },
];
