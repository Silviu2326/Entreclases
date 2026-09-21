"use client";
import Link from "next/link";
import { ArrowUpRight, Clapperboard, PencilRuler, Plus, Sprout } from "lucide-react";
import { projectPath, projectsPath } from "@/lib/community/studio/sections";
import { matches, useCommunity } from "./context";
import { Avatar } from "./controls";
import { StudioStatus, useStudio } from "./studio-context";

/**
 * Projects in Explorar: a look at what is open and the way to the hub, where
 * each project has pages of its own. The whole thing used to live inside this
 * section, folded into a card that grew.
 */
export function ProjectTeaser() {
  const { locale, demo, data: community, query } = useCommunity();
  const { data, loading, unavailable } = useStudio();
  const t = (es: string, va: string) => locale === "va" ? va : es;
  const open = data.projects.filter(project => project.stage !== "completed" && matches(query, project.title, project.objective, ...project.roles));
  const shown = open.slice(0, 3);

  return <section className="st-projects" id="proyectos" aria-labelledby="projects-title">
    <header className="st-heading">
      <div>
        <p className="st-kicker">{t("IDEAS QUE BUSCAN MANOS", "IDEES QUE BUSQUEN MANS")}</p>
        <h2 id="projects-title">{t("Lo que sabes hacer puede ser justo lo que falta.", "El que saps fer pot ser just el que falta.")}</h2>
        <p>{t("Junta carreras. Comparte lo que sabes. Termina algo que puedas enseñar.", "Junta carreres. Compartix el que saps. Acaba alguna cosa que pugues ensenyar.")}</p>
      </div>
      <Link className="st-text-action" href={projectsPath(locale, demo)}>{t("Ver todos los proyectos", "Vore tots els projectes")}<ArrowUpRight aria-hidden="true" /></Link>
    </header>
    <StudioStatus />
    {shown.length > 0 && <div className="st-project-grid">{shown.map((project, index) => {
      const Icon = [PencilRuler, Clapperboard, Sprout][index % 3];
      const free = project.roles.filter(role => !project.team.some(member => member.role === role));
      const owner = community.profiles.find(profile => profile.user_id === project.owner);
      return <article className={`st-project st-project-${index % 3}`} key={project.id}>
        <header><div className="st-project-art" aria-hidden="true"><Icon /><span>↗</span><i /></div>
          <span className="st-stamp">{project.stage === "building" ? t("EN MARCHA", "EN MARXA") : t("FORMANDO EQUIPO", "FORMANT EQUIP")}</span>
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
    })}</div>}
    {!loading && !unavailable && !shown.length && <p className="st-empty">{query
      ? t("Ningún proyecto abierto coincide con la búsqueda.", "Cap projecte obert coincidix amb la cerca.")
      : t("Todavía no hay proyectos abiertos. Tu idea puede ser la primera.", "Encara no hi ha projectes oberts. La teua idea pot ser la primera.")}</p>}
    <p className="st-caption">
      <Link className="st-text-action" href={projectPath(locale, demo, "nuevo")}><Plus aria-hidden="true" />{t("Crear un proyecto", "Crear un projecte")}</Link>
      {open.length > shown.length ? ` · ${t(`${open.length} proyectos abiertos`, `${open.length} projectes oberts`)}` : ""}
    </p>
  </section>;
}
