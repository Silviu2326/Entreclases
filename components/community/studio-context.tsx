"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getAuthClient } from "@/lib/auth/client";
import { emptyStudio, type StudioData, type StudioInput } from "@/lib/community/studio/types";
import { useCommunity } from "./context";
import { localPath } from "@/lib/i18n/routes";
import "./studio.css";

type Studio = { data: StudioData; loading: boolean; busy: boolean; error: string; unavailable: boolean; act: (command: string, input?: StudioInput) => Promise<boolean> };
const Context = createContext<Studio | null>(null);
export function StudioProvider({ children }: { children: ReactNode }) {
  const { demo, me, locale } = useCommunity();
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
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError("");
    try { const value = await request(command,input); if (alive.current) { setData(value); setUnavailable(false); } return true; }
    catch (e) { if (alive.current) failure(e); return false; }
    finally { lock.current = false; if (alive.current) { setBusy(false); setLoading(false); } }
  }
  return <Context.Provider value={{data,loading,busy,error,unavailable,act}}>{children}</Context.Provider>;
}
export function useStudio() { const value = useContext(Context); if (!value) throw Error("Studio provider missing"); return value; }
export function StudioStatus() {
  const {loading,error,unavailable,act,busy} = useStudio(), {locale,demo} = useCommunity();
  return <>{loading && <p role="status">{locale === "va" ? "Carregant projectes i revista…" : "Cargando proyectos y revista…"}</p>}{error && <div className="st-notice" role="alert"><p>{error}</p>{unavailable ? <a href={`${localPath(locale,"demo")}?view=explore#proyectos`}>{locale === "va" ? "Provar en la demo" : "Probar en la demo"} ↗</a> : <button disabled={busy} onClick={()=>void act("read")}>{locale === "va" ? "Tornar a intentar-ho" : "Volver a intentarlo"}</button>}</div>}{demo && <p className="st-caption">{locale === "va" ? "Exemples ficticis. Els canvis només duren esta visita." : "Ejemplos ficticios. Los cambios solo duran esta visita."}</p>}</>;
}
export function ProjectCredits() {
  const {me,go,locale} = useCommunity(), {data} = useStudio();
  const projects = data.projects.filter(p=>p.stage==="completed"&&p.credits.includes(me.user_id));
  if (!projects.length) return null;
  return <section className="st-profile-credits"><p className="st-kicker">{locale==="va"?"FET AMB ALTRES PERSONES":"HECHO CON OTRAS PERSONAS"}</p><h2>{locale==="va"?"Coses que ja pots ensenyar.":"Cosas que ya puedes enseñar."}</h2>{projects.map(p=><button className="st-text-action" key={p.id} onClick={()=>{go("projects");const url=new URL(location.href);url.searchParams.set("project",p.id);history.replaceState(null,"",url);}}>{p.title} ↗</button>)}</section>;
}
