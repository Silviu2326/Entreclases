"use client";
import { useRef, useState } from "react";
import { Download, FileText, LogOut, MessageCircle, Paperclip, RefreshCw, Send, Trash2, UserMinus } from "lucide-react";
import { fileAccept, fileLimits, humanSize } from "@/lib/community/studio/files";
import { safeWebUrl, type ProjectFile } from "@/lib/community/studio/types";
import { formatDate } from "@/lib/community/copy";
import { useCommunity } from "../context";
import { Action, Avatar, Confirm, SelectField, TextArea, TextField } from "../controls";
import { useStudio } from "../studio-context";
import type { ProjectView } from "./screen";

/** Who is inside, and the conversation that only they can read. */
export function ProjectTeam({ project, owner }: ProjectView) {
  const { locale, me, data: community, repo, run, busy: appBusy, go } = useCommunity();
  const { data, act, busy } = useStudio();
  const t = (es: string, va: string) => locale === "va" ? va : es;
  const messages = data.messages.filter(item => item.project_id === project.id);
  const closed = project.stage === "completed";
  const talk = async (person: string) => { let id = ""; if (await run(async () => { id = await repo.openThread(person); }, "")) go("messages", { threadId: id }); };
  const creator = community.profiles.find(profile => profile.user_id === project.owner);

  return <>
    <section aria-labelledby="team-people-title">
      <h3 id="team-people-title">{t("Quién está dentro", "Qui està dins")}</h3>
      <ul className="st-member-list">
        <li><div className="st-person"><Avatar person={creator} /><span>{creator?.name ?? t("Estudiante", "Estudiant")}<small>{t("Impulsa el proyecto", "Impulsa el projecte")}</small></span></div>
          {project.owner !== me.user_id && <Action secondary disabled={appBusy} onClick={() => void talk(project.owner)}><MessageCircle aria-hidden="true" />{t("Escribirle", "Escriure-li")}</Action>}
        </li>
        {project.team.map(member => {
          const person = community.profiles.find(profile => profile.user_id === member.user_id);
          const self = member.user_id === me.user_id;
          return <li key={member.user_id}>
            <div className="st-person"><Avatar person={person} /><span>{self ? t("Tú", "Tu") : person?.name ?? t("Estudiante", "Estudiant")}<small>{member.role}</small></span></div>
            <div className="st-actions">
              {!self && <Action secondary disabled={appBusy} onClick={() => void talk(member.user_id)}><MessageCircle aria-hidden="true" />{t("Escribirle", "Escriure-li")}</Action>}
              {owner && !self && !closed && <Confirm title={t("¿Quitar a esta persona del equipo?", "Llevar esta persona de l’equip?")}
                description={t("Su puesto queda libre y deja de ver la conversación y los archivos. Podrá volver a solicitarlo.", "El seu lloc queda lliure i deixa de vore la conversa i els arxius. Podrà tornar a sol·licitar-lo.")}
                onConfirm={async () => !!(await act("remove_member", { id: project.id, member: member.user_id }))}>
                <Action secondary disabled={busy}><UserMinus aria-hidden="true" />{t("Quitar", "Llevar")}</Action>
              </Confirm>}
              {self && !closed && <Confirm title={t("¿Salir del proyecto?", "Eixir del projecte?")}
                description={t("Tu puesto queda libre y dejas de ver la conversación y los archivos del equipo.", "El teu lloc queda lliure i deixes de vore la conversa i els arxius de l’equip.")}
                onConfirm={async () => !!(await act("leave_project", { id: project.id }))}>
                <Action secondary disabled={busy}><LogOut aria-hidden="true" />{t("Salir del equipo", "Eixir de l’equip")}</Action>
              </Confirm>}
            </div>
          </li>;
        })}
      </ul>
      {owner && !closed && <SelectField label={t("Etapa del proyecto", "Etapa del projecte")} value={project.stage} disabled={busy} onChange={event => void act("stage", { id: project.id, stage: event.target.value })}>
        <option value="forming">{t("Formando equipo", "Formant equip")}</option>
        <option value="building">{t("En marcha", "En marxa")}</option>
      </SelectField>}
    </section>

    <section aria-labelledby="team-talk-title">
      <div className="st-row"><h3 id="team-talk-title">{t("Conversación del equipo", "Conversa de l’equip")}</h3>
        <button className="st-text-action" disabled={busy} onClick={() => void act("read")}><RefreshCw aria-hidden="true" />{t("Actualizar", "Actualitzar")}</button>
      </div>
      <p className="st-caption">{t("Solo la leéis quienes estáis en el equipo. Actualiza para ver lo último.", "Només la llegiu els que esteu en l’equip. Actualitza per a vore l’últim.")}</p>
      <div className="st-team-messages">
        {!messages.length && <p className="st-caption">{t("Todavía no hay mensajes. Cuenta por dónde vas.", "Encara no hi ha missatges. Conta per on vas.")}</p>}
        {messages.map(message => <article key={message.id}>
          <strong>{community.profiles.find(profile => profile.user_id === message.author)?.name ?? t("Compañero", "Company")}</strong>
          <small className="st-caption">{formatDate(message.created_at, locale)}</small>
          <p>{message.body.split(/(https?:\/\/\S+)/g).map((part, index) => safeWebUrl(part) ? <a key={index} href={part} target="_blank" rel="noopener noreferrer">{part}</a> : part)}</p>
        </article>)}
      </div>
      <form onSubmit={async event => { event.preventDefault(); const form = event.currentTarget; if (await act("team_message", { id: project.id, body: new FormData(form).get("body") })) form.reset(); }}>
        <TextArea name="body" label={t("Comparte un avance o un enlace", "Compartix un avanç o un enllaç")} required maxLength={2000} />
        <Action disabled={busy}><Send aria-hidden="true" />{t("Enviar al equipo", "Enviar a l’equip")}</Action>
      </form>
    </section>
  </>;
}

/** The files the team passes around: uploaded here, downloaded with a link that expires. */
export function ProjectFiles({ project, owner }: ProjectView) {
  const { locale, me, data: community } = useCommunity();
  const { data, busy, uploadFile, fileUrl, removeFile } = useStudio();
  const t = (es: string, va: string) => locale === "va" ? va : es;
  const input = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState(""), [error, setError] = useState(""), [working, setWorking] = useState(false);
  const files = (data.files ?? []).filter(item => item.project_id === project.id);

  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const file = input.current?.files?.[0];
    if (!file) { setError(t("Elige un archivo.", "Tria un arxiu.")); return; }
    setWorking(true);
    const done = await uploadFile(project.id, file, note.trim());
    setWorking(false);
    if (done) { setNote(""); if (input.current) input.current.value = ""; }
  };
  const open = async (file: ProjectFile) => {
    setError("");
    try {
      const url = await fileUrl(file);
      if (!url) { setError(t("Este archivo ya no está disponible.", "Este arxiu ja no està disponible.")); return; }
      const link = document.createElement("a");
      link.href = url; link.rel = "noopener"; link.target = "_blank";
      if (url.startsWith("blob:")) link.download = file.name;
      document.body.appendChild(link); link.click(); link.remove();
      if (url.startsWith("blob:")) window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch { setError(t("No se ha podido preparar la descarga. Inténtalo de nuevo.", "No s’ha pogut preparar la descàrrega. Torna-ho a intentar.")); }
  };

  return <>
    <form className="st-form st-file-form" onSubmit={send}>
      <p className="st-kicker">{t("PASAR UN ARCHIVO", "PASSAR UN ARXIU")}</p>
      <label className="st-file-input">
        <Paperclip aria-hidden="true" />
        <span>{t("Elegir un archivo", "Triar un arxiu")}</span>
        <input ref={input} type="file" accept={fileAccept} required />
      </label>
      <TextField label={t("Para qué es · opcional", "Per a què és · opcional")} value={note} maxLength={fileLimits.note} onChange={event => setNote(event.target.value)} placeholder={t("El guion con los cambios de ayer", "El guió amb els canvis d’ahir")} />
      <p className="st-caption">{t(`Hasta ${fileLimits.size / (1024 * 1024)} MB por archivo y ${fileLimits.perProject} archivos por proyecto. PDF, imágenes, texto, hojas, presentaciones y zip.`, `Fins a ${fileLimits.size / (1024 * 1024)} MB per arxiu i ${fileLimits.perProject} arxius per projecte. PDF, imatges, text, fulls, presentacions i zip.`)}</p>
      {error && <p className="st-notice" role="alert">{error}</p>}
      <Action disabled={busy || working} type="submit">{working ? t("Subiendo…", "Pujant…") : t("Subir al proyecto", "Pujar al projecte")}</Action>
    </form>

    {!files.length
      ? <div className="st-empty"><h2>{t("Todavía no hay archivos.", "Encara no hi ha arxius.")}</h2><p>{t("Aquí van los guiones, los bocetos y las hojas que necesitéis para trabajar. Nadie de fuera del equipo puede abrirlos.", "Ací van els guions, els esbossos i els fulls que necessiteu per a treballar. Ningú de fora de l’equip els pot obrir.")}</p></div>
      : <ul className="st-file-list">{files.map(file => {
        const person = community.profiles.find(profile => profile.user_id === file.author);
        return <li key={file.id}>
          <span className="st-file-icon" aria-hidden="true"><FileText /></span>
          <div>
            <strong>{file.name}</strong>
            {file.note && <p>{file.note}</p>}
            <small className="st-caption">{humanSize(file.size, locale)} · {person?.name ?? t("Alguien del equipo", "Algú de l’equip")} · {formatDate(file.created_at, locale)}</small>
          </div>
          <div className="st-actions">
            <Action secondary onClick={() => void open(file)}><Download aria-hidden="true" />{t("Descargar", "Descarregar")}</Action>
            {(owner || file.author === me.user_id) && <Confirm title={t("¿Borrar este archivo?", "Esborrar este arxiu?")} description={t("Desaparece para todo el equipo y no se puede recuperar.", "Desapareix per a tot l’equip i no es pot recuperar.")} onConfirm={() => removeFile(file)}>
              <Action secondary disabled={busy}><Trash2 aria-hidden="true" />{t("Borrar", "Esborrar")}</Action>
            </Confirm>}
          </div>
        </li>;
      })}</ul>}
  </>;
}
