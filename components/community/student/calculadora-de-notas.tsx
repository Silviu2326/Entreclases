"use client";
import { useMemo, useState } from "react";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { ToolShell, Panel, Stat, Notice, useTool } from "./shared";
import { useToolStore, newId } from "@/lib/community/student/storage";
import {
  currentGrade, neededGrade, validate, weightSum, formatGrade, summaryText, partTemplates,
  type Subject, type Part,
} from "@/lib/community/student/grades";
import type { Locale } from "@/lib/i18n/routes";
import "./calculadora-de-notas.css";

type T = (es: string, va: string) => string;
const TARGETS = [5, 6, 7, 8, 9, 10];

function emptyPart(): Part {
  return { id: newId(), name: "", weight: 0, grade: null, minimum: null };
}

function demoSubject(t: T, language: number): Subject {
  const template = partTemplates[0];
  return {
    id: newId(),
    name: t("Estadística II", "Estadística II"),
    target: 5,
    parts: template.parts.map(part => ({ id: newId(), name: part.name[language], weight: part.weight, grade: null, minimum: null })),
  };
}

export default function Screen() {
  const { t, key, locale, language } = useTool("grades");
  const initial = useMemo(() => [demoSubject(t, language)], [t, language]);
  const [subjects, setSubjects, ready] = useToolStore<Subject[]>(key, initial);

  const patchSubject = (id: string, patch: Partial<Subject>) => setSubjects(current => current.map(subject => subject.id === id ? { ...subject, ...patch } : subject));
  const removeSubject = (id: string) => setSubjects(current => current.filter(subject => subject.id !== id));
  const addSubject = () => setSubjects(current => [...current, { id: newId(), name: t("Nueva asignatura", "Nova assignatura"), target: 5, parts: [] }]);

  return (
    <ToolShell id="grades">
      {ready && <div className="st-stack">
        <div className="gr-toolbar">
          <button type="button" className="st-button" onClick={addSubject}>
            <Plus aria-hidden="true" />{t("Añadir asignatura", "Afig assignatura")}
          </button>
        </div>
        {subjects.map(subject => (
          <SubjectPanel key={subject.id} subject={subject} t={t} locale={locale} language={language}
            onUpdate={patch => patchSubject(subject.id, patch)} onRemove={() => removeSubject(subject.id)} />
        ))}
        {subjects.length === 0 && <Panel>{t("Todavía no tienes ninguna asignatura.", "Encara no tens cap assignatura.")}</Panel>}
      </div>}
    </ToolShell>
  );
}

function SubjectPanel({ subject, t, locale, language, onUpdate, onRemove }: {
  subject: Subject; t: T; locale: Locale; language: number;
  onUpdate: (patch: Partial<Subject>) => void; onRemove: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fmt = (value: number) => formatGrade(value, locale);

  const updatePart = (partId: string, patch: Partial<Part>) => onUpdate({ parts: subject.parts.map(part => part.id === partId ? { ...part, ...patch } : part) });
  const removePart = (partId: string) => onUpdate({ parts: subject.parts.filter(part => part.id !== partId) });
  const addPart = () => onUpdate({ parts: [...subject.parts, emptyPart()] });
  const applyTemplate = (templateId: string) => {
    const template = partTemplates.find(item => item.id === templateId);
    if (!template) return;
    onUpdate({ parts: template.parts.map(part => ({ id: newId(), name: part.name[language], weight: part.weight, grade: null, minimum: null })) });
  };

  const total = weightSum(subject);
  const issues = validate(subject);
  const weightOff = issues.some(issue => issue.kind === "weight");
  const gradeIssues = new Set(issues.filter(issue => issue.kind === "grade").map(issue => issue.partId));
  const minimumIssues = new Set(issues.filter(issue => issue.kind === "minimum").map(issue => issue.partId));
  const { graded, accumulated } = currentGrade(subject);
  const result = neededGrade(subject, subject.target);

  let neededValue: string;
  let neededTone: "plain" | "good" | "warn" | "bad";
  if (result.needed === null) {
    neededValue = result.possible ? t("Hecho", "Fet") : t("No llega", "No hi arriba");
    neededTone = result.possible ? "good" : "bad";
  } else if (result.needed <= 0) {
    neededValue = fmt(0);
    neededTone = "good";
  } else if (result.needed > 10) {
    neededValue = fmt(result.needed);
    neededTone = "bad";
  } else {
    neededValue = fmt(result.needed);
    neededTone = result.needed <= 5 ? "good" : result.needed <= 8 ? "warn" : "bad";
  }

  const neededMessage = result.needed === null
    ? (result.possible ? t("Ya tienes la nota hecha.", "Ja tens la nota feta.") : t("Con las notas que tienes no llegas al objetivo.", "Amb les notes que tens no arribes a l’objectiu."))
    : result.needed <= 0
    ? t("Ya has aprobado, aunque saques un 0 en lo que queda.", "Ja has aprovat, encara que traguesses un 0 en el que queda.")
    : result.needed > 10
    ? t(`No es posible llegar a ${fmt(subject.target)}: como mucho puedes sacar un ${fmt(result.maxReachable)}.`, `No és possible arribar a ${fmt(subject.target)}: com a molt pots traure un ${fmt(result.maxReachable)}.`)
    : t(`Para un ${fmt(subject.target)} necesitas ${fmt(result.needed)}.`, `Per a un ${fmt(subject.target)} necessites ${fmt(result.needed)}.`);

  return (
    <Panel className="gr-subject">
      <div className="gr-subject-head">
        <input className="st-input" value={subject.name} maxLength={60} aria-label={t("Nombre de la asignatura", "Nom de l’assignatura")}
          onChange={event => onUpdate({ name: event.target.value })} />
        {confirmDelete ? (
          <span className="gr-confirm">
            <span className="st-muted">{t("¿Borrar?", "Esborrar?")}</span>
            <button type="button" className="st-button st-button-secondary" onClick={onRemove}>{t("Sí", "Sí")}</button>
            <button type="button" className="st-button st-button-ghost" onClick={() => setConfirmDelete(false)}>{t("No", "No")}</button>
          </span>
        ) : (
          <button type="button" className="st-button st-button-ghost" aria-label={t("Borrar asignatura", "Esborrar assignatura")} onClick={() => setConfirmDelete(true)}>
            <Trash2 aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="st-row gr-templates">
        {partTemplates.map(template => (
          <button key={template.id} type="button" className="st-button st-button-ghost" onClick={() => applyTemplate(template.id)}>{template.label[language]}</button>
        ))}
      </div>

      {weightOff && <Notice tone="warn">{t(
        `Los pesos suman ${fmt(total)} %, no 100 %. Los cálculos se ajustan de forma proporcional.`,
        `Els pesos sumen ${fmt(total)} %, no 100 %. Els càlculs s’ajusten de forma proporcional.`,
      )}</Notice>}
      {(gradeIssues.size > 0 || minimumIssues.size > 0) && <Notice tone="error">{t(
        "Revisa las notas marcadas: están fuera de 0-10 o por debajo del mínimo exigido.",
        "Revisa les notes marcades: estan fora de 0-10 o per davall del mínim exigit.",
      )}</Notice>}

      <div className="gr-table" role="table" aria-label={t("Partes de la asignatura", "Parts de l’assignatura")}>
        <div className="gr-head" role="row">
          <span role="columnheader">{t("Parte", "Part")}</span>
          <span role="columnheader">{t("Peso %", "Pes %")}</span>
          <span role="columnheader">{t("Nota", "Nota")}</span>
          <span role="columnheader">{t("Mínimo", "Mínim")}</span>
          <span role="columnheader" aria-hidden="true" />
        </div>
        {subject.parts.map(part => {
          const gradeClass = gradeIssues.has(part.id) ? "gr-input-error" : minimumIssues.has(part.id) ? "gr-input-warn" : "";
          return (
            <div className="gr-row" role="row" key={part.id}>
              <span className="gr-cell" role="cell" data-label={t("Parte", "Part")}>
                <input className="st-input" value={part.name} maxLength={40} placeholder={t("Nombre de la parte", "Nom de la part")}
                  onChange={event => updatePart(part.id, { name: event.target.value })} />
              </span>
              <span className="gr-cell" role="cell" data-label={t("Peso %", "Pes %")}>
                <input className="st-input" type="number" min={0} max={100} step={1} value={part.weight}
                  onChange={event => updatePart(part.id, { weight: event.target.value === "" ? 0 : Number(event.target.value) })} />
              </span>
              <span className="gr-cell" role="cell" data-label={t("Nota", "Nota")}>
                <input className={`st-input ${gradeClass}`} type="number" min={0} max={10} step={0.1} placeholder="—"
                  value={part.grade === null ? "" : part.grade}
                  onChange={event => updatePart(part.id, { grade: event.target.value === "" ? null : Number(event.target.value) })} />
              </span>
              <span className="gr-cell" role="cell" data-label={t("Mínimo", "Mínim")}>
                <input className="st-input" type="number" min={0} max={10} step={0.1} placeholder={t("Ninguno", "Cap")}
                  value={part.minimum == null ? "" : part.minimum}
                  onChange={event => updatePart(part.id, { minimum: event.target.value === "" ? null : Number(event.target.value) })} />
              </span>
              <span className="gr-cell gr-remove-cell" role="cell">
                <button type="button" className="gr-remove-part" aria-label={t("Borrar esta parte", "Esborra esta part")} onClick={() => removePart(part.id)}>
                  <Trash2 aria-hidden="true" />
                </button>
              </span>
            </div>
          );
        })}
      </div>
      <button type="button" className="st-button st-button-secondary gr-add-part" onClick={addPart}>
        <Plus aria-hidden="true" />{t("Añadir parte", "Afig part")}
      </button>

      <div className="st-grid">
        <Stat label={t("Llevas", "Portes")} value={graded === null ? "—" : fmt(graded)} />
        <Stat label={t("Acumulado", "Acumulat")} value={`${fmt(accumulated)} / 10`} />
        <Stat label={t("Necesitas en el final", "Necessites en el final")} value={neededValue} tone={neededTone} />
      </div>

      <div className="gr-targets" role="group" aria-label={t("Objetivo", "Objectiu")}>
        {TARGETS.map(option => (
          <button key={option} type="button" aria-pressed={subject.target === option}
            className={`st-button st-button-secondary gr-target-button${subject.target === option ? " gr-target-on" : ""}`}
            onClick={() => onUpdate({ target: option })}>{option}</button>
        ))}
      </div>
      <p className="gr-target-note">{neededMessage}</p>

      <div className="gr-copy-row">
        <CopySummary subject={subject} locale={locale} t={t} />
      </div>
    </Panel>
  );
}

function CopySummary({ subject, locale, t }: { subject: Subject; locale: Locale; t: T }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    void (async () => {
      try {
        if (navigator.clipboard) await navigator.clipboard.writeText(summaryText(subject, locale));
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      } catch {
        // Sin permiso de portapapeles o sin soporte: no pasa nada, simplemente no se copia.
      }
    })();
  };
  return (
    <button type="button" className="st-button st-button-secondary" onClick={onCopy}>
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {copied ? t("Copiado", "Copiat") : t("Copiar resumen", "Copiar resum")}
    </button>
  );
}
