"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, FileText, FolderOpen, PencilLine, ScrollText, Trophy, Users } from "lucide-react";
import { languageIndex, projectPath, projectsPath, sectionById, type ProjectSection } from "@/lib/community/studio/sections";
import type { Project } from "@/lib/community/studio/types";
import { useCommunity } from "../context";
import { StudioStatus, useStudio } from "../studio-context";
import { ProjectHub } from "./hub";
import { ProjectForm } from "./form";
import { ProjectFicha } from "./ficha";
import { ProjectRequests } from "./requests";
import { ProjectTeam, ProjectFiles } from "./team";
import { ProjectResult } from "./result";
import "./projects.css";

/** What every section of a project gets once the project is loaded and the door has been checked. */
export type ProjectView = { project: Project; owner: boolean; team: boolean };

export function ProjectScreen() {
  const { project } = useCommunity();
  if (!project) return null;
  if (project === "hub") return <ProjectHub />;
  if (project === "nuevo") return <ProjectForm />;
  return <ProjectFrame section={project}>{view =>
    project === "ficha" ? <ProjectFicha {...view} />
    : project === "editar" ? <ProjectForm project={view.project} />
    : project === "solicitudes" ? <ProjectRequests {...view} />
    : project === "equipo" ? <ProjectTeam {...view} />
    : project === "archivos" ? <ProjectFiles {...view} />
    : <ProjectResult {...view} />}
  </ProjectFrame>;
}

/**
 * The project travels in the address, so a page can always be opened cold: with
 * an identifier that no longer exists, or by somebody the section is not for.
 * Both endings are a page of their own, never a blank screen.
 */
function ProjectFrame({ section, children }: { section: ProjectSection; children: (view: ProjectView) => ReactNode }) {
  const { locale, demo, projectId, me } = useCommunity();
  const { data, loading, unavailable } = useStudio();
  const t = (es: string, va: string) => locale === "va" ? va : es;
  const entry = sectionById(section);
  const project = data.projects.find(item => item.id === projectId);
  const owner = !!project && project.owner === me.user_id;
  const team = owner || !!project?.team.some(member => member.user_id === me.user_id);

  if (loading || unavailable) return <div className="st-section"><StudioStatus /></div>;
  if (!project) return <div className="st-section"><StudioStatus /><div className="st-empty st-missing">
    <h2>{t("Este proyecto ya no está aquí.", "Este projecte ja no està ací.")}</h2>
    <p>{t("Puede que se haya retirado, o que la dirección esté incompleta.", "Pot ser que s’haja retirat, o que l’adreça estiga incompleta.")}</p>
    <Link className="st-text-action" href={projectsPath(locale, demo)}><ArrowLeft aria-hidden="true" />{t("Ver todos los proyectos", "Vore tots els projectes")}</Link>
  </div></div>;

  const allowed = entry?.access === "everyone" || (entry?.access === "owner" ? owner : team);
  if (!allowed) return <div className="st-section"><div className="st-empty st-missing">
    <h2>{t("Esta parte es del equipo.", "Esta part és de l’equip.")}</h2>
    <p>{entry?.access === "owner"
      ? t("Solo quien impulsa el proyecto entra aquí.", "Només qui impulsa el projecte entra ací.")
      : t("Las solicitudes, la conversación y los archivos solo los ve quien está dentro.", "Les sol·licituds, la conversa i els arxius només els veu qui està dins.")}</p>
    <Link className="st-text-action" href={projectPath(locale, demo, "ficha", project.id)}><ArrowLeft aria-hidden="true" />{t("Ver la ficha del proyecto", "Vore la fitxa del projecte")}</Link>
  </div></div>;

  return <div className="st-section">
    <StudioStatus />
    <ProjectBar project={project} current={section} owner={owner} team={team} />
    {children({ project, owner, team })}
  </div>;
}

const icons: Record<ProjectSection, typeof Users> = { nuevo: PencilLine, ficha: FileText, editar: PencilLine, solicitudes: ScrollText, equipo: Users, archivos: FolderOpen, resultado: Trophy };

/** The project's own name and the way between its sections, on every page of it. */
function ProjectBar({ project, current, owner, team }: { project: Project; current: ProjectSection; owner: boolean; team: boolean }) {
  const { locale, demo } = useCommunity();
  const { data } = useStudio();
  const language = languageIndex(locale);
  const t = (es: string, va: string) => locale === "va" ? va : es;
  const pending = data.applications.filter(item => item.project_id === project.id && item.status === "pending").length;
  const open = sectionById(current)?.access !== "everyone";
  const visible = ["ficha", "editar", "solicitudes", "equipo", "archivos", "resultado"] as ProjectSection[];
  return <div className="st-project-bar">
    <div className="st-project-bar-top">
      <div>
        <p className="st-kicker">{t("PROYECTO", "PROJECTE")}{open ? ` · ${t("Solo el equipo", "Només l’equip")}` : ""}</p>
        {current === "ficha" ? <h2>{project.title}</h2> : <h2><Link href={projectPath(locale, demo, "ficha", project.id)}>{project.title}</Link></h2>}
      </div>
      <span className="st-stamp">{project.stage === "completed" ? t("HECHO", "FET") : project.stage === "building" ? t("EN MARCHA", "EN MARXA") : t("FORMANDO EQUIPO", "FORMANT EQUIP")}</span>
    </div>
    <nav className="st-project-nav" aria-label={t("Secciones del proyecto", "Seccions del projecte")}>
      {visible.map(id => {
        const entry = sectionById(id);
        if (!entry || (entry.access === "owner" && !owner) || (entry.access === "team" && !team)) return null;
        const Icon = icons[id];
        return <Link key={id} href={projectPath(locale, demo, id, project.id)} aria-current={id === current ? "page" : undefined} className={id === current ? "is-current" : ""}>
          <Icon aria-hidden="true" />{entry.title[language]}
          {id === "solicitudes" && pending > 0 && <span className="st-badge">{pending}</span>}
        </Link>;
      })}
    </nav>
  </div>;
}
