"use client";
import { ArrowUpRight, Trophy } from "lucide-react";
import { safeWebUrl } from "@/lib/community/studio/types";
import { useCommunity } from "../context";
import { Action, Avatar, ExternalLink, TextArea, TextField } from "../controls";
import { useStudio } from "../studio-context";
import type { ProjectView } from "./screen";

/** The end of a project: what it became, and who signs it. */
export function ProjectResult({ project, owner, team }: ProjectView) {
  const { locale, me, data: community, go } = useCommunity();
  const { act, busy } = useStudio();
  const t = (es: string, va: string) => locale === "va" ? va : es;
  const mine = project.credits.includes(me.user_id);

  if (project.stage !== "completed") return <>
    <div className="st-empty">
      <h2>{t("Todavía no hay resultado.", "Encara no hi ha resultat.")}</h2>
      <p>{t("Cuando el proyecto termine, aquí quedará lo que habéis conseguido y los créditos del equipo.", "Quan el projecte acabe, ací quedarà el que heu aconseguit i els crèdits de l’equip.")}</p>
    </div>
    {owner && <form className="st-form" onSubmit={async event => { event.preventDefault(); await act("result", { ...Object.fromEntries(new FormData(event.currentTarget)), id: project.id }); }}>
      <p className="st-kicker">{t("CERRAR EL PROYECTO", "TANCAR EL PROJECTE")}</p>
      <h3>{t("¿Qué habéis conseguido?", "Què heu aconseguit?")}</h3>
      <TextArea name="body" required minLength={20} maxLength={2000} label={t("Contadlo en unas líneas", "Conteu-ho en unes línies")} />
      <TextField name="url" type="url" pattern="https?://.*" maxLength={500} label={t("Enlace al resultado · opcional", "Enllaç al resultat · opcional")} />
      <label className="st-checkbox"><input type="checkbox" required />{t("El equipo ha revisado el resultado y los créditos. Al publicar se cierra la incorporación de colaboradores.", "L’equip ha revisat el resultat i els crèdits. En publicar es tanca la incorporació de col·laboradors.")}</label>
      <Action disabled={busy}>{t("Terminar y publicar", "Acabar i publicar")}</Action>
    </form>}
  </>;

  return <>
    <section className="st-result">
      <p className="st-kicker">{t("HECHO ENTRE CLASES", "FET ENTRE CLASSES")}</p>
      <h3><Trophy aria-hidden="true" />{t("Esto es lo que consiguieron.", "Açò és el que van aconseguir.")}</h3>
      <p>{project.result}</p>
      {safeWebUrl(project.result_url) && <ExternalLink href={project.result_url}>{t("Ver el resultado", "Vore el resultat")}</ExternalLink>}
    </section>

    <h3>{t("Quién lo firma", "Qui ho firma")}</h3>
    <ul className="st-member-list">{[{ user_id: project.owner, role: t("Impulsa el proyecto", "Impulsa el projecte") }, ...project.team].map(member => {
      const person = community.profiles.find(profile => profile.user_id === member.user_id);
      return <li key={member.user_id}>
        <div className="st-person"><Avatar person={person} /><span>{person?.name ?? t("Estudiante", "Estudiant")}<small>{member.role}</small></span></div>
        {project.credits.includes(member.user_id) && <span className="st-state st-state-accepted">{t("En su perfil", "En el seu perfil")}</span>}
      </li>;
    })}</ul>

    {team && <p className="st-caption">
      <button className="st-text-action" disabled={busy} aria-pressed={mine} onClick={() => void act("credit", { id: project.id, on: !mine })}>
        {mine ? t("Quitar de mi perfil", "Llevar del meu perfil") : t("Añadir a mi perfil", "Afegir al meu perfil")}<ArrowUpRight aria-hidden="true" />
      </button>
    </p>}
    {owner && <p className="st-caption">
      <button className="st-text-action" onClick={() => go("magazine")}>{t("Proponerlo para la revista", "Proposar-lo per a la revista")}<ArrowUpRight aria-hidden="true" /></button>
    </p>}
  </>;
}
