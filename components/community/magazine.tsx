"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, ArrowUp, ArrowUpRight, Newspaper, Plus, Search } from "lucide-react";
import type { Submission } from "@/lib/community/studio/types";
import { safeWebUrl } from "@/lib/community/studio/types";
import { launchEdition, LAUNCH_EDITION_ID, type LaunchStory } from "@/lib/community/studio/launch-edition";
import { matches, useCommunity } from "./context";
import { Action, SelectField, TextField } from "./controls";
import { StudioStatus, useStudio } from "./studio-context";
import { ProposalForm, MyMagazineProposals, EditorialReviewQueue } from "./magazine-proposals";
import { MagazineStoryBody } from "./magazine-media";
import { proposalStatus } from "@/lib/community/studio/proposals";
import "./magazine.css";

type MagazineStory = Submission | LaunchStory;
type MagazinePage = "cover" | "read" | "proposals" | "archive";

function pageFromHash(hash: string): MagazinePage {
  if (hash.includes("mis-propuestas") || hash.includes("propuesta")) return "proposals";
  if (hash.includes("archivo")) return "archive";
  if (hash.includes("lectura") || hash.includes("story-")) return "read";
  return "cover";
}

function pageFromLocation(): MagazinePage {
  if (typeof window === "undefined") return "cover";
  const requested = new URLSearchParams(window.location.search).get("page");
  if (requested === "read" || requested === "proposals" || requested === "archive") return requested;
  return pageFromHash(window.location.hash);
}

export function MagazineTeaser() {
  const {locale,go} = useCommunity();
  const latest = launchEdition(locale).edition;
  return <section className="st-magazine-teaser"><div className="st-paper-icon" aria-hidden="true"><Newspaper/><span>E.</span></div><div><p className="st-kicker">{locale==="va"?"LA REVISTA DE LA COMUNITAT":"LA REVISTA DE LA COMUNIDAD"}</p><h2>{locale==="va"?"Entre línies.":"Entre líneas."}</h2><p>{latest?.title??(locale==="va"?"El que estem fent junts mereix que es conte.":"Lo que estamos haciendo juntos merece que se cuente.")}</p></div><button className="st-text-action" onClick={()=>go("magazine")}>{latest?(locale==="va"?"Llegir l’edició":"Leer la edición"):(locale==="va"?"Conéixer la revista":"Conocer la revista")}<ArrowUpRight/></button></section>;
}
export function Magazine() {
  const {locale,me} = useCommunity();
  const {data,loading,unavailable,busy} = useStudio();
  const t=(es:string,va:string)=>locale==="va"?va:es;
  const [edition,setEdition] = useState(LAUNCH_EDITION_ID);
  const [proposing,setProposing] = useState(false);
  const [editing,setEditing] = useState<Submission|undefined>();
  const [saved,setSaved] = useState(false);
  const [search,setSearch] = useState("");
  const [largeText,setLargeText] = useState(false);
  const [page,setPage] = useState<MagazinePage>(pageFromLocation);
  const launch=launchEdition(locale);
  const published=[...data.editions.filter(x=>x.published&&x.id!==LAUNCH_EDITION_ID).sort((a,b)=>b.date.localeCompare(a.date)),launch.edition];
  const selected=published.find(x=>x.id===edition)??launch.edition;
  const isLaunch=selected.id===LAUNCH_EDITION_ID;
  const editionPieces:MagazineStory[]=isLaunch?launch.stories:data.submissions.filter(x=>x.consent&&x.edition_id===selected.id);
  const pieces=editionPieces.filter(x=>matches(search,x.title,x.body,x.attribution));
  const myProposals=data.submissions.filter(x=>x.author===me.user_id);
  const issueNumber=selected?String(published.length-published.indexOf(selected)).padStart(2,"0"):"—";
  const issueDate=selected?new Intl.DateTimeFormat(locale==="va"?"ca-ES":"es-ES",{day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Madrid"}).format(new Date(selected.date+"T12:00:00Z")):t("Primera edición en preparación","Primera edició en preparació");
  useEffect(() => {
    const syncPage = () => setPage(pageFromLocation());
    window.addEventListener("popstate", syncPage);
    window.addEventListener("hashchange", syncPage);
    return () => { window.removeEventListener("popstate", syncPage); window.removeEventListener("hashchange", syncPage); };
  }, []);
  function navigatePage(next: MagazinePage, target?: string) {
    setPage(next);
    const url = new URL(window.location.href);
    if (next === "cover") url.searchParams.delete("page");
    else url.searchParams.set("page", next);
    url.hash = target ?? ({ cover: "revista-portada", read: "revista-lectura", proposals: "revista-mis-propuestas", archive: "revista-archivo" } as const)[next];
    window.history.pushState(null, "", url);
    requestAnimationFrame(() => document.getElementById(target ?? url.hash.slice(1))?.scrollIntoView({ block: "start" }));
  }
  function chooseEdition(id:string) {
    setEdition(id);setSearch("");
    navigatePage("cover");
  }
  return <div className={`st-page mz-magazine mz-page-${page} ${largeText?"mz-large-type":""}`} id="revista-portada" tabIndex={-1}>
    <header className="mz-masthead">
      <div className="mz-masthead-brand"><Image src="/images/entre-lineas-logo.png" alt="Entre líneas" width={1086} height={362} priority/><h1 className="sr-only">{t("Entre líneas","Entre línies")}</h1></div>
      <div className="mz-masthead-meta"><p>{t("La vida entre clases, contada aquí","La vida entre classes, contada ací")}</p><p><time dateTime={selected?.date}>{issueDate}</time><span>València</span></p></div>
    </header>
    <nav className="mz-nav" aria-label={t("Dentro de la revista","Dins de la revista")}>
      <a href="#revista-portada" aria-current={page === "cover" ? "page" : undefined} onClick={e=>{e.preventDefault();navigatePage("cover")}}>{t("En portada","En portada")}</a>
      {selected&&<a href="#revista-sumario" onClick={e=>{e.preventDefault();navigatePage("cover","revista-sumario")}}>{t("Sumario","Sumari")}</a>}
      <a href="#revista-mis-propuestas" aria-current={page === "proposals" ? "page" : undefined} onClick={e=>{e.preventDefault();navigatePage("proposals")}}>{t("Mis propuestas","Les meues propostes")} ({myProposals.length})</a>
      <a href="#revista-archivo" aria-current={page === "archive" ? "page" : undefined} onClick={e=>{e.preventDefault();navigatePage("archive")}}>{t("Archivo","Arxiu")}</a>
      <button className="mz-propose-link" disabled={loading||unavailable||busy} aria-expanded={proposing} aria-controls="revista-propuesta" onClick={()=>{if(proposing){document.getElementById("revista-propuesta")?.scrollIntoView({block:"start"});return;}setProposing(true);setEditing(undefined);setSaved(false);navigatePage("proposals","revista-propuesta");}}>{proposing?t("Volver al editor","Tornar a l’editor"):t("Proponer una historia","Proposar una història")}<ArrowUpRight aria-hidden="true"/></button>
    </nav>
    <div className="mz-status"><StudioStatus/></div>
    {page === "proposals" && proposing&&<section id="revista-propuesta" className="mz-proposal"><ProposalForm key={editing?`${editing.id}-${editing.revision}`:"new"} initial={editing} onCancel={()=>setProposing(false)} onDone={()=>{setProposing(false);setEditing(undefined);setSaved(true);navigatePage("proposals");}}/></section>}
    {saved&&<p role="status" className="mz-save-success">{t("Propuesta guardada. Puedes seguir su estado en Mis propuestas.","Proposta guardada. Pots seguir-ne l’estat en Les meues propostes.")}</p>}
    {selected&&<>
      <section className="mz-cover" aria-labelledby="mz-edition-title">
        <div className="mz-cover-copy">
          <span className="mz-folio">{t("EDICIÓN","EDICIÓ")} {issueNumber}{isLaunch&&t(" · BIENVENIDA"," · BENVINGUDA")}</span>
          <h2 id="mz-edition-title">{selected.title}</h2>
          <p>{isLaunch?launch.introduction:t("Gente de aquí. Cosas que están pasando. Y un hueco para ti.","Gent d’ací. Coses que estan passant. I un lloc per a tu.")}</p>
          {editionPieces.length>0&&<a className="mz-link" href="#revista-lectura" onClick={e=>{e.preventDefault();navigatePage("read")}}>{t("Empezar a leer","Començar a llegir")}<ArrowRight aria-hidden="true"/></a>}
        </div>
        <figure className="mz-cover-image">
          <div><Image src={isLaunch?"/images/explore-campus-hero.png":"/images/explore-project-table.png"} alt={isLaunch?t("Estudiantes compartiendo una tarde en el patio del campus.","Estudiants compartint una vesprada al pati del campus."):t("Bocetos, muestras de tela y un portátil en una mesa de trabajo compartida.","Esbossos, mostres de tela i un portàtil en una taula de treball compartida.")} width={1536} height={1024} priority sizes="(max-width: 700px) 100vw, 50vw"/></div>
          <figcaption>{isLaunch?t("Imagen editorial generada · la vida entre clases","Imatge editorial generada · la vida entre classes"):t("Imagen editorial generada · trabajo compartido","Imatge editorial generada · treball compartit")}</figcaption>
        </figure>
      </section>
      <section className="mz-contents" id="revista-sumario" aria-labelledby="mz-contents-title">
        <div className="mz-contents-label"><h2 id="mz-contents-title">{t("En este número","En este número")}</h2><span>{editionPieces.length} {editionPieces.length===1?t("historia","història"):t("historias","històries")}</span></div>
        <ol>{editionPieces.map((s,index)=><li key={s.id}><a href={`#revista-story-${s.id}`} onClick={e=>{e.preventDefault();setSearch("");navigatePage("read",`revista-story-${s.id}`)}}><span>{String(index+1).padStart(2,"0")}</span><strong>{s.title}</strong><ArrowUpRight aria-hidden="true"/></a></li>)}</ol>
        {!editionPieces.length&&<p className="mz-empty">{t("Las piezas de esta edición ya no están disponibles. Sus autores pueden retirar el permiso en cualquier momento.","Les peces d’esta edició ja no estan disponibles. Els autors poden retirar el permís en qualsevol moment.")}</p>}
      </section>
      <section className="mz-reading" id="revista-lectura" aria-labelledby="mz-reading-title">
        <header className="mz-reading-heading"><h2 id="mz-reading-title">{t("En estas páginas","En estes pàgines")}<span>.</span></h2><div className="mz-type-controls" role="group" aria-label={t("Tamaño de lectura","Mida de lectura")}><span>{t("Letra","Lletra")}</span><button aria-label={t("Letra normal","Lletra normal")} aria-pressed={!largeText} onClick={()=>setLargeText(false)}>A</button><button aria-label={t("Letra grande","Lletra gran")} aria-pressed={largeText} onClick={()=>setLargeText(true)}>A+</button></div></header>
        <label className="mz-search"><Search aria-hidden="true"/><span className="sr-only">{t("Buscar en esta edición","Buscar en esta edició")}</span><input type="search" placeholder={t("Busca una historia, una persona…","Busca una història, una persona…")} value={search} onChange={e=>setSearch(e.target.value)}/></label>
        {search&&<p role="status" className="mz-search-status">{pieces.length} {t("resultados en esta edición","resultats en esta edició")}</p>}
        <div className="mz-stories">{pieces.map(s=><MagazinePiece key={s.id} piece={s} index={editionPieces.indexOf(s)}/>)}</div>
        {!!search&&!pieces.length&&<div className="mz-empty"><p>{t("Aquí no aparece. Prueba con otro nombre o unas palabras distintas.","Ací no apareix. Prova amb un altre nom o unes paraules diferents.")}</p><button className="mz-link" onClick={()=>setSearch("")}>{t("Ver todas las historias","Vore totes les històries")}<ArrowRight aria-hidden="true"/></button></div>}
      </section>
    </>}
    <section className="mz-archive" id="revista-archivo" aria-labelledby="mz-archive-title">
      <header><span className="mz-folio">{t("PARA VOLVER","PER A TORNAR")}</span><h2 id="mz-archive-title">{t("La hemeroteca","L’hemeroteca")}<span>.</span></h2><p>{t("Cada semana, una nueva edición. Las anteriores se quedan aquí.","Cada setmana, una nova edició. Les anteriors es queden ací.")}</p></header>
      <div>{published.map((e,index)=><button key={e.id} className="mz-archive-row" aria-current={e.id===selected?.id?"true":undefined} onClick={()=>chooseEdition(e.id)}><span className="mz-archive-number">{String(published.length-index).padStart(2,"0")}</span><span><time dateTime={e.date}>{new Intl.DateTimeFormat(locale==="va"?"ca-ES":"es-ES",{day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Madrid"}).format(new Date(e.date+"T12:00:00Z"))}</time><strong>{e.title}</strong><small>{e.id===selected?.id?t("Estás leyendo esta edición","Estàs llegint esta edició"):t("Abrir edición","Obrir edició")}</small></span><ArrowUpRight aria-hidden="true"/></button>)}{!published.length&&<p className="mz-empty">{t("Aquí encontrarás las ediciones cuando se publiquen.","Ací trobaràs les edicions quan es publiquen.")}</p>}</div>
    </section>
    <section className="mz-colophon"><h2>{t("Tu historia sigue siendo tuya.","La teua història continua sent teua.")}</h2><div><p>{t("Hasta seis piezas por edición. Elegimos por utilidad, actualidad y variedad de carreras y campus. También hay sitio para quien acaba de empezar. Los likes y los ClasiCoins no compran un hueco.","Fins a sis peces per edició. Triem per utilitat, actualitat i varietat de carreres i campus. També hi ha lloc per a qui acaba de començar. Els likes i els ClasiCoins no compren un lloc.")}</p><p>{t("Cada texto aparece con el permiso de su autor, que puede retirarlo también del archivo. Solo dentro de la comunidad verificada. Publicarlo fuera necesita otra autorización.","Cada text apareix amb el permís del seu autor, que pot retirar-lo també de l’arxiu. Només dins de la comunitat verificada. Publicar-lo fora necessita una altra autorització.")}</p></div></section>
    {page === "proposals" && <><MyMagazineProposals onEdit={submission=>{setEditing(submission);setProposing(true);setSaved(false);navigatePage("proposals","revista-propuesta");}}/>
    {data.editor&&<><EditorialReviewQueue/><EditorialDesk/></>}</>}
    <footer className="mz-footer"><span>{t("Entre líneas.","Entre línies")} <small>× Entreclases</small></span><a href="#revista-portada" onClick={e=>{e.preventDefault();navigatePage("cover")}}>{t("Volver a portada","Tornar a portada")}<ArrowUp aria-hidden="true"/></a></footer>
  </div>;
}
function MagazinePiece({piece:s,index}:{piece:MagazineStory;index:number}) {
  const {go,locale}=useCommunity(); const t=(es:string,va:string)=>locale==="va"?va:es;
  function openSource() {
    if(s.kind==="editorial"){if(s.action)go(s.action.view);return;}
    go(s.kind==="project"?"projects":s.kind==="plan"?"plans":"messages");
    if(s.kind==="project"){const url=new URL(location.href);url.searchParams.set("project",s.source_id);history.replaceState(null,"",url);}
  }
  const section=s.kind==="editorial"?s.section:s.section?s.section:s.kind==="project"?t("Proyectos","Projectes"):s.kind==="plan"?t("Planes","Plans"):s.kind==="post"?t("Conversaciones","Converses"):t("Desde el campus","Des del campus");
  return <article className="mz-story" id={`revista-story-${s.id}`} tabIndex={-1}>
    <div className="mz-story-margin"><span>{String(index+1).padStart(2,"0")}</span><p>{section}</p></div>
    <div className="mz-story-copy"><h3>{s.title}</h3><MagazineStoryBody body={s.body} summary={s.kind==="editorial"?undefined:s.summary} images={s.kind==="editorial"?undefined:s.images} layout={s.kind==="editorial"?undefined:s.layout}/><footer><span>{t("Por","Per")} <strong>{s.attribution}</strong></span>{s.kind==="editorial"?(s.action&&<button className="mz-link" onClick={openSource}>{s.action.label}<ArrowUpRight aria-hidden="true"/></button>):s.kind==="story"?null:s.kind==="initiative"?safeWebUrl(s.source_url)&&<a className="mz-link" href={s.source_url} target="_blank" rel="noopener noreferrer">{t("Ver fuente","Vore font")}<ArrowUpRight aria-hidden="true"/></a>:<button className="mz-link" onClick={openSource}>{s.kind==="project"?t("Conocer el proyecto","Conéixer el projecte"):s.kind==="plan"?t("Ver los planes","Vore els plans"):t("Ir al foro","Anar al fòrum")}<ArrowUpRight aria-hidden="true"/></button>}</footer></div>
  </article>;
}
function EditorialDesk() {
  const {data,act,busy}=useStudio(),{locale,demo}=useCommunity();const t=(es:string,va:string)=>locale==="va"?va:es;
  const [edition,setEdition]=useState("");
  const drafts=data.editions.filter(e=>!e.published), selected=drafts.find(e=>e.id===edition)??drafts[0];
  return <details className="st-editorial-desk"><summary>{t("Mesa de edición","Taula d’edició")} {demo&&t("· simulación editorial","· simulació editorial")}<Plus/></summary><p>{t("Selección manual de hasta seis piezas aceptadas y autorizadas. Revisa las fuentes y alterna carreras, campus y autores.","Selecció manual de fins a sis peces acceptades i autoritzades. Revisa les fonts i alterna carreres, campus i autors.")}</p><form className="st-form-grid" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;if(await act("create_edition",Object.fromEntries(new FormData(form))))form.reset();}}><TextField name="title" label={t("Título de la edición","Títol de l’edició")} required minLength={3} maxLength={120}/><TextField name="date" label={t("Fecha de edición","Data d’edició")} type="date" required/><Action disabled={busy}>{t("Crear borrador","Crear esborrany")}</Action></form>{selected&&<><SelectField label={t("Edición en preparación","Edició en preparació")} value={selected.id} onChange={e=>setEdition(e.target.value)}>{drafts.map(x=><option key={x.id} value={x.id}>{x.date} · {x.title}</option>)}</SelectField><div className="st-editorial-candidates">{data.submissions.filter(s=>s.consent&&proposalStatus(s)==="accepted"&&(!s.edition_id||s.edition_id===selected.id)).map(s=><article key={s.id}><label className="st-checkbox"><input type="checkbox" checked={s.edition_id===selected.id} disabled={busy} onChange={e=>void act("select",{id:s.id,edition:selected.id,on:e.target.checked})}/><strong>{s.title}</strong></label><p>{s.body}</p><small>{s.attribution} · {s.kind==="story"?t("Historia","Història"):s.kind==="project"?t("Proyecto","Projecte"):s.kind==="plan"?t("Plan","Pla"):s.kind==="post"?t("Hilo","Fil"):t("Iniciativa","Iniciativa")}</small>{safeWebUrl(s.source_url)&&<a href={s.source_url} target="_blank" rel="noopener noreferrer">{t("Revisar fuente","Revisar font")}</a>}</article>)}</div><form onSubmit={async e=>{e.preventDefault();await act("publish_edition",{edition:selected.id});}}><label className="st-checkbox"><input required type="checkbox"/>{t("He revisado la selección, sus fuentes y las autorizaciones. Esta edición será visible para toda la comunidad verificada.","He revisat la selecció, les fonts i les autoritzacions. Esta edició serà visible per a tota la comunitat verificada.")}</label><Action disabled={busy||!data.submissions.some(s=>s.edition_id===selected.id&&s.consent&&proposalStatus(s)==="accepted")}>{t("Publicar edición","Publicar edició")}</Action></form></>}</details>;
}
