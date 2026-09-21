"use client";
import { useState } from "react";
import { Check, MessageCircle, X } from "lucide-react";
import { safeWebUrl, type Application } from "@/lib/community/studio/types";
import { useCommunity } from "../context";
import { Action, Avatar, Chips, ExternalLink } from "../controls";
import { useStudio } from "../studio-context";
import type { ProjectView } from "./screen";

/** Who wants in. Private to the person who started the project, as the form promises. */
export function ProjectRequests({ project }: ProjectView) {
  const { locale, data: community, repo, run, busy: appBusy, go } = useCommunity();
  const { data, act, busy } = useStudio();
  const t = (es: string, va: string) => locale === "va" ? va : es;
  const [filter, setFilter] = useState("pending");
  const all = data.applications.filter(item => item.project_id === project.id);
  const shown = all.filter(item => filter === "all" || item.status === filter);
  const closed = project.stage === "completed";
  const talk = async (person: string) => { let id = ""; if (await run(async () => { id = await repo.openThread(person); }, "")) go("messages", { threadId: id }); };

  if (!all.length) return <div className="st-empty">
    <h2>{t("Todavía no hay solicitudes.", "Encara no hi ha sol·licituds.")}</h2>
    <p>{t("Cuando alguien pida un puesto, su aportación y su disponibilidad aparecerán aquí. Solo las lees tú.", "Quan algú demane un lloc, la seua aportació i la seua disponibilitat apareixeran ací. Només les lliges tu.")}</p>
  </div>;

  return <>
    <Chips label={t("Ver solicitudes", "Vore sol·licituds")} value={filter} onChange={setFilter} options={[
      { value: "pending", label: t(`Sin responder (${all.filter(item => item.status === "pending").length})`, `Sense respondre (${all.filter(item => item.status === "pending").length})`) },
      { value: "accepted", label: t("Aceptadas", "Acceptades") },
      { value: "rejected", label: t("No aceptadas", "No acceptades") },
      { value: "all", label: t("Todas", "Totes") },
    ]} />
    {closed && <p className="st-notice">{t("El proyecto está terminado: ya no se pueden aceptar solicitudes.", "El projecte està acabat: ja no es poden acceptar sol·licituds.")}</p>}
    {!shown.length && <p className="st-empty">{t("No hay solicitudes en este estado.", "No hi ha sol·licituds en este estat.")}</p>}
    <ul className="st-request-list">{shown.map(item => {
      const person = community.profiles.find(profile => profile.user_id === item.applicant);
      return <li className="st-application" key={item.id}>
        <div className="st-person"><Avatar person={person} /><span>{person?.name ?? t("Estudiante", "Estudiant")}<small>{person?.degree}{person && person.year > 0 ? ` · ${person.year}º` : ""}</small></span>
          <span className={`st-state st-state-${item.status}`}>{statusLabel(item, t)}</span>
        </div>
        <p className="st-request-role">{t("Se presenta a", "Es presenta a")} <strong>{item.role}</strong></p>
        <p>{item.body}</p>
        <p className="st-caption">{t("Disponibilidad:", "Disponibilitat:")} {item.availability}</p>
        {safeWebUrl(item.portfolio) && <ExternalLink href={item.portfolio}>{t("Ejemplo de trabajo", "Exemple de treball")}</ExternalLink>}
        <div className="st-actions">
          {item.status === "pending" && !closed && <>
            <Action disabled={busy} onClick={() => void act("decide", { id: project.id, application: item.id, status: "accepted" })}><Check aria-hidden="true" />{t("Aceptar en el equipo", "Acceptar en l’equip")}</Action>
            <Action secondary disabled={busy} onClick={() => void act("decide", { id: project.id, application: item.id, status: "rejected" })}><X aria-hidden="true" />{t("No encaja", "No encaixa")}</Action>
          </>}
          <Action secondary disabled={appBusy} onClick={() => void talk(item.applicant)}><MessageCircle aria-hidden="true" />{t("Escribirle", "Escriure-li")}</Action>
        </div>
      </li>;
    })}</ul>
  </>;
}

function statusLabel(item: Application, t: (es: string, va: string) => string) {
  return item.status === "pending" ? t("Sin responder", "Sense respondre") : item.status === "accepted" ? t("En el equipo", "En l’equip") : t("No aceptada", "No acceptada");
}
