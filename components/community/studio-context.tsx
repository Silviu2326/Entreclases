"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { getAuthClient } from "@/lib/auth/client";
import { emptyStudio, type ProjectFile, type StudioData, type StudioInput } from "@/lib/community/studio/types";
import { checkProjectFile, fileExtension, safeFileName } from "@/lib/community/studio/files";
import { projectPath } from "@/lib/community/studio/sections";
import { useCommunity } from "./context";
import { localPath } from "@/lib/i18n/routes";
import "./studio.css";

/** `act` answers with the studio as it is after the command, or null if it failed: truthy either way for `if (await act(…))`. */
type Studio = { data: StudioData; loading: boolean; busy: boolean; error: string; unavailable: boolean;
  act: (command: string, input?: StudioInput) => Promise<StudioData | null>;
  uploadFile: (projectId: string, file: File, note: string) => Promise<boolean>;
  fileUrl: (file: ProjectFile) => Promise<string>;
  removeFile: (file: ProjectFile) => Promise<boolean>;
};
const Context = createContext<Studio | null>(null);
export function StudioProvider({ children }: { children: ReactNode }) {
  const { demo, me, locale } = useCommunity();
  const filesBucket = "universe-project-files";
  const [data,setData] = useState(emptyStudio), [loading,setLoading] = useState(true), [busy,setBusy] = useState(false), [error,setError] = useState(""), [unavailable,setUnavailable] = useState(false);
  const transport = useRef<((command: string, input?: StudioInput) => StudioData) | null>(null), lock = useRef(false), alive = useRef(false);
  async function request(command: string, input: StudioInput = {}) {
    if (demo) {
      if (!transport.current) { const { createStudioDemo } = await import("@/lib/community/studio/demo"); transport.current = createStudioDemo(me.user_id); }
      return transport.current(command,input);
    }
    const result = await getAuthClient().rpc("universe_studio",{ p_command:command, p_input:input });
    if (result.error) throw result.error;
    return result.data as StudioData;
  }
  function failure(e: unknown) {
    const value = e as { code?: string; message?: string };
    const missing = ["PGRST202","PGRST205","42P01","42883"].includes(value?.code ?? "");
    setUnavailable(missing);
    setError(missing ? (locale === "va" ? "Projectes i revista encara no estan activats en este campus. Pots provar-los en la demo." : "Proyectos y revista todavía no están activados en este campus. Puedes probarlos en la demo.") : value?.message || "No se ha podido guardar. Inténtalo de nuevo.");
  }
  useEffect(() => {
    alive.current = true;
    request("read").then(value => { if (alive.current) setData(value); }).catch(e => { if (alive.current) failure(e); }).finally(() => { if (alive.current) setLoading(false); });
    return () => { alive.current = false; };
    // Provider is keyed by account and locale in CommunityWorkspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function act(command: string,input: StudioInput = {}) {
    if (lock.current) return null;
    lock.current = true; setBusy(true); setError("");
    try { const value = await request(command,input); if (alive.current) { setData(value); setUnavailable(false); } return value; }
    catch (e) { if (alive.current) failure(e); return null; }
    finally { lock.current = false; if (alive.current) { setBusy(false); setLoading(false); } }
  }

  // The bytes go straight to the private bucket; only the row travels through the
  // RPC. The demo keeps the file in the tab, so the page behaves the same with
  // nothing behind it.
  async function uploadFile(projectId: string, file: File, note: string) {
    try { checkProjectFile(file); } catch { setError(locale === "va" ? "Este arxiu no es pot pujar: revisa el tipus i que no passe de 20 MB." : "Este archivo no se puede subir: revisa el tipo y que no pase de 20 MB."); return false; }
    const path = `${projectId}/${me.user_id}/${crypto.randomUUID()}.${fileExtension(file.type)}`;
    const row = { id: projectId, path, name: safeFileName(file), note, size: file.size, kind: file.type };
    if (demo) { (await import("@/lib/community/studio/demo")).demoFiles.set(path, file); return !!(await act("add_file", row)); }
    try {
      const upload = await getAuthClient().storage.from(filesBucket).upload(path, file, { contentType: file.type, upsert: false });
      if (upload.error) throw upload.error;
    } catch (e) { failure(e); return false; }
    const saved = await act("add_file", row);
    if (!saved) { try { await getAuthClient().storage.from(filesBucket).remove([path]); } catch { /* an unreferenced object is cheaper than a wrong row */ } }
    return !!saved;
  }
  async function fileUrl(file: ProjectFile) {
    if (demo) { const stored = (await import("@/lib/community/studio/demo")).demoFiles.get(file.path); return stored ? URL.createObjectURL(stored) : ""; }
    const signed = await getAuthClient().storage.from(filesBucket).createSignedUrl(file.path, 60, { download: file.name });
    if (signed.error || !signed.data?.signedUrl) throw signed.error ?? new Error("invalid_file");
    return signed.data.signedUrl;
  }
  async function removeFile(file: ProjectFile) {
    const done = await act("remove_file", { id: file.project_id, file: file.id });
    if (!done) return false;
    if (demo) (await import("@/lib/community/studio/demo")).demoFiles.delete(file.path);
    // The row is what the team sees; a leftover object is swept with the project.
    else try { await getAuthClient().storage.from(filesBucket).remove([file.path]); } catch { /* orphan left behind */ }
    return true;
  }
  return <Context.Provider value={{data,loading,busy,error,unavailable,act,uploadFile,fileUrl,removeFile}}>{children}</Context.Provider>;
}
export function useStudio() { const value = useContext(Context); if (!value) throw Error("Studio provider missing"); return value; }
export function StudioStatus() {
  const {loading,error,unavailable,act,busy} = useStudio(), {locale,demo} = useCommunity();
  return <>{loading && <p role="status">{locale === "va" ? "Carregant projectes i revista…" : "Cargando proyectos y revista…"}</p>}{error && <div className="st-notice" role="alert"><p>{error}</p>{unavailable ? <a href={`${localPath(locale,"demo")}?view=explore#proyectos`}>{locale === "va" ? "Provar en la demo" : "Probar en la demo"} ↗</a> : <button disabled={busy} onClick={()=>void act("read")}>{locale === "va" ? "Tornar a intentar-ho" : "Volver a intentarlo"}</button>}</div>}{demo && <p className="st-caption">{locale === "va" ? "Exemples ficticis. Els canvis només duren esta visita." : "Ejemplos ficticios. Los cambios solo duran esta visita."}</p>}</>;
}
export function ProjectCredits() {
  const {me,locale,demo} = useCommunity(), {data} = useStudio();
  const projects = data.projects.filter(p=>p.stage==="completed"&&p.credits.includes(me.user_id));
  if (!projects.length) return null;
  return <section className="st-profile-credits"><p className="st-kicker">{locale==="va"?"FET AMB ALTRES PERSONES":"HECHO CON OTRAS PERSONAS"}</p><h2>{locale==="va"?"Coses que ja pots ensenyar.":"Cosas que ya puedes enseñar."}</h2>{projects.map(p=><Link className="st-text-action" key={p.id} href={projectPath(locale,demo,"ficha",p.id)}>{p.title} ↗</Link>)}</section>;
}
