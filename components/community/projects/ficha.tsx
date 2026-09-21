"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Flag, Plus, Trophy, Users } from "lucide-react";
import { projectPath } from "@/lib/community/studio/sections";
import { safeWebUrl } from "@/lib/community/studio/types";
import { useCommunity } from "../context";
import { Action, Avatar, Confirm, ExternalLink, SelectField, TextArea, TextField } from "../controls";
import { useStudio } from "../studio-context";
import type { ProjectView } from "./screen";

/** What anybody in the community can read, and the door to ask for a seat. */
export function ProjectFicha({ project, owner, team }: ProjectView) {
  const { locale, demo, me, data: community } = useCommunity();
  const { data, act, busy } = useStudio();
  const t = (es: string, va: string) => locale === "va" ? va : es;
  const [applying, setApplying] = useState(false);
  const application = data.applications.find(item => item.project_id === project.id && item.applicant === me.user_id);
  const free = project.roles.filter(role => !project.team.some(member => member.role === role));
  const creator = community.profiles.find(profile => profile.user_id === project.owner);
  const closed = project.stage === "completed";

  return <>
    <p className="st-lead">{project.objective}</p>
    <div className="st-row">
      <button className="st-save" disabled={busy} aria-pressed={project.following} onClick={() => void act("follow", { id: project.id, on: !project.following })}>
        <Flag aria-hidden="true" />{project.following ? t("Siguiendo", "Seguint") : t("Seguir avances", "Seguir avanços")}
      </button>
      {owner && <Link className="st-text-action" href={projectPath(locale, demo, "editar", project.id)}>{t("Editar la ficha", "Editar la fitxa")}<ArrowUpRight aria-hidden="true" /></Link>}
    </div>

    <dl className="st-facts">
      <div><dt>{t("Ya tenemos", "Ja tenim")}</dt><dd>{project.existing}</dd></div>
      <div><dt>{t("Aportación de quien lo impulsa", "Aportació de qui l’impulsa")}</dt><dd>{project.contribution}</dd></div>
      <div><dt>{t("Lo que te llevas", "El que t’emportes")}</dt><dd>{project.offer}</dd></div>
      <div><dt>{t("Dedicación", "Dedicació")}</dt><dd>{project.commitment}</dd></div>
      <div><dt>{t("Modalidad", "Modalitat")}</dt><dd>{project.mode} · {project.beginners ? t("Acepta principiantes", "Accepta principiants") : t("Con experiencia previa", "Amb experiència prèvia")}</dd></div>
    </dl>

    <h3><Users aria-hidden="true" />{t("Equipo y puestos", "Equip i llocs")}</h3>
    <div className="st-person"><Avatar person={creator} /><span>{creator?.name ?? t("Estudiante", "Estudiant")}<small>{t("Impulsa el proyecto", "Impulsa el projecte")}</small></span></div>
    <ul className="st-team">{project.roles.map(role => {
      const member = project.team.find(item => item.role === role);
      const person = member && community.profiles.find(profile => profile.user_id === member.user_id);
      return <li key={role}>{role} <span>{member ? person?.name ?? t("Miembro del equipo", "Membre de l’equip") : t("1 plaza abierta", "1 plaça oberta")}</span></li>;
    })}</ul>

    {!team && !closed && !application && free.length > 0 && <>
      <button className="st-primary" onClick={() => setApplying(value => !value)}>{t("Quiero colaborar", "Vull col·laborar")} <Plus size={16} aria-hidden="true" /></button>
      {applying && <form className="st-form" onSubmit={async event => { event.preventDefault(); if (await act("apply", { ...Object.fromEntries(new FormData(event.currentTarget)), id: project.id })) setApplying(false); }}>
        <SelectField name="role" label={t("Puesto al que te presentas", "Lloc al qual et presentes")}>{free.map(role => <option key={role}>{role}</option>)}</SelectField>
        <TextArea name="body" label={t("Qué puedes aportar", "Què pots aportar")} required minLength={10} maxLength={1200} />
        <TextField name="availability" label={t("Tu disponibilidad", "La teua disponibilitat")} required minLength={3} maxLength={300} />
        <TextField name="portfolio" type="url" pattern="https?://.*" label={t("Ejemplo de trabajo · opcional", "Exemple de treball · opcional")} maxLength={500} />
        <p className="st-caption">{t("Solo tú y quien impulsa el proyecto podréis leer esta solicitud.", "Només tu i qui impulsa el projecte podreu llegir esta sol·licitud.")}</p>
        <Action disabled={busy}>{t("Enviar solicitud", "Enviar sol·licitud")}</Action>
      </form>}
    </>}

    {application && <div className="st-notice" role="status">
      <p>{application.status === "pending" ? t("Solicitud enviada. Quien impulsa el proyecto revisará tu aportación.", "Sol·licitud enviada. Qui impulsa el projecte revisarà la teua aportació.")
        : application.status === "accepted" ? t("Ya formas parte del equipo.", "Ja formes part de l’equip.")
        : t("Esta vez no se ha aceptado tu solicitud.", "Esta vegada no s’ha acceptat la teua sol·licitud.")}</p>
      {application.status === "pending" && <Confirm title={t("¿Retirar tu solicitud?", "Retirar la teua sol·licitud?")} description={t("Deja de estar a la espera y el puesto queda libre. Puedes volver a solicitarlo más adelante.", "Deixa d’estar a l’espera i el lloc queda lliure. Pots tornar a sol·licitar-lo més avant.")} onConfirm={async () => !!(await act("withdraw_application", { id: project.id }))}>
        <Action secondary disabled={busy}>{t("Retirar mi solicitud", "Retirar la meua sol·licitud")}</Action>
      </Confirm>}
    </div>}

    {!team && !closed && !application && !free.length && <p className="st-notice">{t("Ahora mismo no queda ninguna plaza libre. Puedes seguir sus avances.", "Ara mateix no queda cap plaça lliure. Pots seguir els seus avanços.")}</p>}

    <h3>{t("Así va el proyecto", "Així va el projecte")}</h3>
    <ol className="st-milestones">{project.milestones.map((milestone, index) => <li key={`${milestone.title}-${index}`}>
      <label><input type="checkbox" checked={milestone.done} disabled={!team || busy || closed} onChange={event => void act("milestone", { id: project.id, index, done: event.target.checked })} /><span>{milestone.title}</span></label>
    </li>)}</ol>

    {closed && <section className="st-result">
      <p className="st-kicker">{t("HECHO ENTRE CLASES", "FET ENTRE CLASSES")}</p>
      <h3><Trophy aria-hidden="true" />{t("Esto es lo que consiguieron.", "Açò és el que van aconseguir.")}</h3>
      <p>{project.result}</p>
      {safeWebUrl(project.result_url) && <ExternalLink href={project.result_url}>{t("Ver el resultado", "Vore el resultat")}</ExternalLink>}
      <Link className="st-text-action" href={projectPath(locale, demo, "resultado", project.id)}>{t("Ver los créditos", "Vore els crèdits")}<ArrowUpRight aria-hidden="true" /></Link>
    </section>}
  </>;
}
