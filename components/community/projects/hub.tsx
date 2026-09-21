"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Clapperboard, PencilRuler, Plus, ScrollText, Sprout, Users } from "lucide-react";
import { projectPath } from "@/lib/community/studio/sections";
import type { Application, Project } from "@/lib/community/studio/types";
import { matches, useCommunity } from "../context";
import { Avatar, SelectField, TextField } from "../controls";
import { StudioStatus, useStudio } from "../studio-context";

/** Everything a person has in projects, and the way into the rest of them. */
export function ProjectHub() {
  const { locale, demo, me, data: community, query } = useCommunity();
  const { data, loading, unavailable } = useStudio();
  const t = (es: string, va: string) => locale === "va" ? va : es;
  const [scope, setScope] = useState("all"), [mode, setMode] = useState(""), [stage, setStage] = useState(""), [skill, setSkill] = useState("");

  const belongs = (project: Project) => project.owner === me.user_id || project.team.some(member => member.user_id === me.user_id);
  const mine = data.projects.filter(belongs);
  const sent = data.applications.filter(item => item.applicant === me.user_id);
  const projects = data.projects.filter(project => matches(query, project.title, project.objective, ...project.roles) && matches(skill, ...project.roles)
    && (!mode || project.mode === mode) && (!stage || project.stage === stage)
    && (scope === "all" || belongs(project) || project.following || sent.some(item => item.project_id === project.id)));

  return <div className="st-page st-hub">
    <header className="st-heading">
      <div>
        <p className="st-kicker">{t("IDEAS QUE BUSCAN MANOS", "IDEES QUE BUSQUEN MANS")}</p>
        <h1>{t("Lo que sabes hacer puede ser justo lo que falta.", "El que saps fer pot ser just el que falta.")}</h1>
        <p>{t("Junta carreras. Comparte lo que sabes. Termina algo que puedas enseñar.", "Junta carreres. Compartix el que saps. Acaba alguna cosa que pugues ensenyar.")}</p>
      </div>
      <Link className="st-text-action" href={projectPath(locale, demo, "nuevo")}><Plus aria-hidden="true" />{t("Crear proyecto", "Crear projecte")}</Link>
    </header>
    <StudioStatus />

    {mine.length > 0 && <section className="st-mine" aria-labelledby="my-projects-title">
      <h2 id="my-projects-title">{t("Tus proyectos", "Els teus projectes")}</h2>
      <ul>{mine.map(project => {
        const owner = project.owner === me.user_id;
        const pending = data.applications.filter(item => item.project_id === project.id && item.status === "pending").length;
        return <li key={project.id}>
          <Link className="st-mine-title" href={projectPath(locale, demo, "ficha", project.id)}>{project.title}</Link>
          <span className="st-caption">{owner ? t("Lo impulsas tú", "L’impulses tu") : t("Estás en el equipo", "Estàs en l’equip")} · {project.stage === "completed" ? t("Terminado", "Acabat") : project.stage === "building" ? t("En marcha", "En marxa") : t("Formando equipo", "Formant equip")}</span>
          <div className="st-mine-links">
            {owner && <Link className={pending ? "st-text-action st-waiting" : "st-text-action"} href={projectPath(locale, demo, "solicitudes", project.id)}>
              <ScrollText aria-hidden="true" />{pending ? t(`${pending} sin responder`, `${pending} sense respondre`) : t("Solicitudes", "Sol·licituds")}
            </Link>}
            <Link className="st-text-action" href={projectPath(locale, demo, "equipo", project.id)}><Users aria-hidden="true" />{t("Equipo", "Equip")}</Link>
          </div>
        </li>;
      })}</ul>
    </section>}

    {sent.length > 0 && <section className="st-sent" aria-labelledby="my-applications-title">
      <h2 id="my-applications-title">{t("Tus solicitudes", "Les teues sol·licituds")}</h2>
      <ul>{sent.map(item => {
        const project = data.projects.find(entry => entry.id === item.project_id);
        return <li key={item.id}>
          <div>
            {project ? <Link href={projectPath(locale, demo, "ficha", project.id)}>{project.title}</Link> : <span>{t("Proyecto retirado", "Projecte retirat")}</span>}
            <small>{item.role}</small>
          </div>
          <span className={`st-state st-state-${item.status}`}>{applicationLabel(item, t)}</span>
        </li>;
      })}</ul>
    </section>}

    <section aria-labelledby="all-projects-title">
      <h2 id="all-projects-title" className="sr-only">{t("Todos los proyectos", "Tots els projectes")}</h2>
      <div className="st-filters">
        <SelectField label={t("Ver proyectos", "Vore projectes")} value={scope} onChange={event => setScope(event.target.value)}>
          <option value="all">{t("Buscar proyecto", "Buscar projecte")}</option>
          <option value="mine">{t("Los míos y los que sigo", "Els meus i els que seguisc")}</option>
        </SelectField>
        <TextField label={t("Habilidad buscada", "Habilitat buscada")} placeholder={t("Ej. diseño, sonido…", "Ex. disseny, so…")} value={skill} onChange={event => setSkill(event.target.value)} />
        <SelectField label={t("Modalidad", "Modalitat")} value={mode} onChange={event => setMode(event.target.value)}>
          <option value="">{t("Todas", "Totes")}</option>{["Presencial", "Remoto", "Mixto"].map(value => <option key={value}>{value}</option>)}
        </SelectField>
        <SelectField label={t("Etapa", "Etapa")} value={stage} onChange={event => setStage(event.target.value)}>
          <option value="">{t("Todas", "Totes")}</option>
          <option value="forming">{t("Formando equipo", "Formant equip")}</option>
          <option value="building">{t("En marcha", "En marxa")}</option>
          <option value="completed">{t("Terminados", "Acabats")}</option>
        </SelectField>
      </div>
      <p className="st-caption" role="status">{projects.length} {projects.length === 1 ? t("proyecto · la dedicación se indica en su ficha", "projecte · la dedicació s’indica en la fitxa") : t("proyectos · la dedicación se indica en cada ficha", "projectes · la dedicació s’indica en cada fitxa")}</p>
      <div className="st-project-grid">{projects.map((project, index) => {
        const Icon = [PencilRuler, Clapperboard, Sprout][index % 3];
        const free = project.roles.filter(role => !project.team.some(member => member.role === role));
        const owner = community.profiles.find(profile => profile.user_id === project.owner);
        return <article className={`st-project st-project-${index % 3}`} key={project.id}>
          <header><div className="st-project-art" aria-hidden="true"><Icon /><span>↗</span><i /></div>
            <span className="st-stamp">{project.stage === "completed" ? t("HECHO", "FET") : project.stage === "building" ? t("EN MARCHA", "EN MARXA") : t("FORMANDO EQUIPO", "FORMANT EQUIP")}</span>
          </header>
          <div className="st-project-body">
            <h3><Link href={projectPath(locale, demo, "ficha", project.id)}>{project.title}</Link></h3>
            <p>{project.objective}</p>
            <div className="st-roles">{free.length ? free.map(role => <span key={role}>{role}</span>) : <span>{t("Equipo completo", "Equip complet")}</span>}</div>
            <p className="st-caption">{project.mode} · {project.commitment}</p>
            <div className="st-person"><Avatar person={owner} /><span>{owner?.name ?? t("Estudiante", "Estudiant")}<small>{project.beginners ? t("Acepta principiantes", "Accepta principiants") : t("Experiencia previa", "Experiència prèvia")}</small></span></div>
            <footer><Link className="st-text-action" href={projectPath(locale, demo, "ficha", project.id)}>{t("Conocer el proyecto", "Conéixer el projecte")}<ArrowUpRight aria-hidden="true" /></Link></footer>
          </div>
        </article>;
      })}</div>
      {!loading && !unavailable && !projects.length && <p className="st-empty">{t("Todavía no hay proyectos con estos filtros. Tu idea puede ser la primera.", "Encara no hi ha projectes amb estos filtres. La teua idea pot ser la primera.")}</p>}
    </section>
  </div>;
}

export function applicationLabel(item: Application, t: (es: string, va: string) => string) {
  return item.status === "pending" ? t("Enviada", "Enviada") : item.status === "accepted" ? t("Aceptada", "Acceptada") : t("No aceptada", "No acceptada");
}
