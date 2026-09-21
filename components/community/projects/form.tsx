"use client";
import { useState, type FormEvent } from "react";
import { ArrowUpRight, Check, Lock, Plus, X } from "lucide-react";
import { projectPath } from "@/lib/community/studio/sections";
import type { Project } from "@/lib/community/studio/types";
import { useCommunity } from "../context";
import { Action, SelectField, TextArea, TextField } from "../controls";
import { StudioStatus, useStudio } from "../studio-context";

const MAX_ROLES = 6, MAX_MILESTONES = 6;

/**
 * The same form creates a project and edits it. Editing is narrower on purpose:
 * a role somebody already fills cannot be renamed or taken away underneath them,
 * and a role with a pending application waits until that application is answered.
 */
export function ProjectForm({ project }: { project?: Project }) {
  const { locale, demo, me } = useCommunity();
  const { data, act, busy } = useStudio();
  const t = (es: string, va: string) => locale === "va" ? va : es;
  const editing = !!project;
  const taken = project ? project.roles.filter(role => project.team.some(member => member.role === role)) : [];
  const waiting = project ? project.roles.filter(role => !taken.includes(role) && data.applications.some(item => item.project_id === project.id && item.role === role && item.status === "pending")) : [];
  const [open, setOpen] = useState(() => (project?.roles ?? []).filter(role => !taken.includes(role)).join("\n"));
  const [milestones, setMilestones] = useState(() => (project?.milestones ?? []).map(item => item.title));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setSaved(false);
    const form = new FormData(event.currentTarget), value = Object.fromEntries(form);
    const typed = open.split("\n").map(role => role.trim()).filter(Boolean);
    const roles = [...taken, ...typed];
    if (!roles.length || roles.length > MAX_ROLES || new Set(roles).size !== roles.length) { setError(t(`Indica de uno a ${MAX_ROLES} puestos distintos, uno por línea.`, `Indica d’un a ${MAX_ROLES} llocs diferents, un per línia.`)); return; }
    const missing = waiting.filter(role => !typed.includes(role));
    if (missing.length) { setError(t(`Responde antes a las solicitudes de: ${missing.join(", ")}.`, `Respon abans a les sol·licituds de: ${missing.join(", ")}.`)); return; }
    const titles = milestones.map(title => title.trim()).filter(Boolean);
    if (editing && (!titles.length || titles.length > MAX_MILESTONES)) { setError(t(`Deja entre uno y ${MAX_MILESTONES} hitos.`, `Deixa entre una i ${MAX_MILESTONES} fites.`)); return; }

    if (!editing) {
      const before = new Set(data.projects.map(item => item.id));
      const result = await act("create_project", { ...value, roles, beginners: form.has("beginners") });
      if (!result) return;
      const created = result.projects.find(item => item.owner === me.user_id && !before.has(item.id));
      window.location.assign(projectPath(locale, demo, created ? "ficha" : "nuevo", created?.id));
      return;
    }
    if (await act("update_project", { ...value, id: project.id, roles, milestones: titles, beginners: form.has("beginners") })) setSaved(true);
  }

  const field = (name: keyof Project | "title", fallback = "") => (project ? String(project[name as keyof Project] ?? "") : fallback);
  return <form className="st-form" onSubmit={submit}>
    {!editing && <StudioStatus />}
    <p className="st-kicker">{editing ? t("CAMBIA LO QUE HAGA FALTA", "CANVIA EL QUE CALGA") : t("TU IDEA, CON LOS PIES EN EL SUELO", "LA TEUA IDEA, AMB ELS PEUS A TERRA")}</p>
    <h3>{editing ? t("La ficha que lee quien quiere entrar.", "La fitxa que llig qui vol entrar.") : t("¿Qué vais a conseguir juntos?", "Què aconseguireu junts?")}</h3>
    <div className="st-form-grid">
      <TextField name="title" label={t("Nombre del proyecto", "Nom del projecte")} required minLength={3} maxLength={100} defaultValue={field("title")} placeholder={t("Un probador virtual para mi colección", "Un provador virtual per a la meua col·lecció")} />
      <SelectField name="mode" label={t("Modalidad", "Modalitat")} defaultValue={field("mode", "Presencial")}><option>Presencial</option><option>Remoto</option><option>Mixto</option></SelectField>
      <TextArea name="objective" label={t("Objetivo y primer resultado", "Objectiu i primer resultat")} required minLength={3} maxLength={1200} defaultValue={field("objective")} />
      <TextArea name="existing" label={t("Qué existe ya", "Què existix ja")} required minLength={3} maxLength={1200} defaultValue={field("existing")} />
      <TextArea name="contribution" label={t("Qué aportas tú", "Què aportes tu")} required minLength={3} maxLength={1200} defaultValue={field("contribution")} />
      <TextArea name="commitment" label={t("Dedicación, duración y horarios", "Dedicació, duració i horaris")} required minLength={3} maxLength={1200} defaultValue={field("commitment")} placeholder={t("3 horas semanales · 6 semanas · jueves tarde", "3 hores setmanals · 6 setmanes · dijous vesprada")} />
      <TextArea name="offer" label={t("Qué ofrece · indica si hay remuneración", "Què oferix · indica si hi ha remuneració")} required minLength={3} maxLength={1200} defaultValue={field("offer")} />
    </div>

    <fieldset className="st-roles-field">
      <legend>{t("Puestos abiertos · uno por línea, una plaza por puesto", "Llocs oberts · un per línia, una plaça per lloc")}</legend>
      {taken.length > 0 && <p className="st-caption"><Lock aria-hidden="true" />{t("Estos puestos ya tienen a alguien dentro y se quedan como están:", "Estos llocs ja tenen algú dins i es queden com estan:")} <strong>{taken.join(" · ")}</strong></p>}
      <label className="sr-only" htmlFor="project-roles">{t("Puestos abiertos", "Llocs oberts")}</label>
      <textarea id="project-roles" className="u-input u-textarea" value={open} maxLength={480} rows={3} onChange={event => setOpen(event.target.value)} placeholder={"Desarrollo web\nDiseño 3D"} />
      {waiting.length > 0 && <p className="st-caption">{t("Hay solicitudes esperando en:", "Hi ha sol·licituds esperant en:")} <strong>{waiting.join(" · ")}</strong>. {t("Respóndelas antes de quitar el puesto.", "Respon-les abans de llevar el lloc.")}</p>}
    </fieldset>

    {editing && <fieldset className="st-milestone-field">
      <legend>{t("Hitos del proyecto", "Fites del projecte")}</legend>
      <p className="st-caption">{t("Si cambias el nombre de un hito, vuelve a empezar sin marcar.", "Si canvies el nom d’una fita, torna a començar sense marcar.")}</p>
      {milestones.map((title, index) => <div className="st-milestone-row" key={index}>
        <TextField label={t(`Hito ${index + 1}`, `Fita ${index + 1}`)} value={title} maxLength={120} onChange={event => setMilestones(list => list.map((item, position) => position === index ? event.target.value : item))} />
        {milestones.length > 1 && <button type="button" className="st-text-action" onClick={() => setMilestones(list => list.filter((_, position) => position !== index))} aria-label={t(`Quitar el hito ${index + 1}`, `Llevar la fita ${index + 1}`)}><X aria-hidden="true" /></button>}
      </div>)}
      {milestones.length < MAX_MILESTONES && <button type="button" className="st-text-action" onClick={() => setMilestones(list => [...list, ""])}><Plus aria-hidden="true" />{t("Añadir un hito", "Afegir una fita")}</button>}
    </fieldset>}

    <label className="st-checkbox"><input type="checkbox" name="beginners" defaultChecked={project?.beginners ?? false} />{t("Aceptamos principiantes", "Acceptem principiants")}</label>
    <p className="st-caption">{t("La ficha será visible para la comunidad. Las solicitudes, la conversación y los archivos son privados del equipo.", "La fitxa serà visible per a la comunitat. Les sol·licituds, la conversa i els arxius són privats de l’equip.")}</p>
    {error && <p className="st-notice" role="alert">{error}</p>}
    {saved && <p className="st-notice" role="status"><Check aria-hidden="true" />{t("Guardado. La ficha ya muestra los cambios.", "Guardat. La fitxa ja mostra els canvis.")}</p>}
    <Action disabled={busy} type="submit">{editing ? t("Guardar cambios", "Guardar canvis") : t("Publicar proyecto", "Publicar projecte")}<ArrowUpRight aria-hidden="true" /></Action>
  </form>;
}
