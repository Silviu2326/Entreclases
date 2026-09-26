"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, CalendarRange, Calculator, Check, ClipboardCheck, Heart, Landmark, MapPin, Search, Sparkles, Users, X } from "lucide-react";
import { languageIndex, toolBySlug, toolPath, type ToolGroup, type ToolKind } from "@/lib/community/student/catalog";
import { tools } from "./catalog";
import { LearningCenter } from "./learning-center";
import { StudentDashboard } from "./student-dashboard";
import { matches, useCommunity } from "../context";
import "./student.css";
import "./student-hub.css";

const artwork: Record<ToolKind, typeof Calculator> = { notes: BookOpenCheck, exam: ClipboardCheck, grades: Calculator, calendar: CalendarRange, teamwork: Users, libraries: Landmark };
const deskCopy: Record<ToolKind, { body: readonly [string, string]; action: readonly [string, string] }> = {
  notes: { body: ["Pregunta por ese párrafo que no entiendes y pide otra explicación.", "Pregunta pel paràgraf que no entens i demana una altra explicació."], action: ["Abrir el tutor", "Obrir el tutor"] },
  exam: { body: ["Haz un test con tus apuntes y descubre qué te falta repasar.", "Fes un test amb els teus apunts i descobrix què et falta repassar."], action: ["Preparar un test", "Preparar un test"] },
  grades: { body: ["Mete tus notas y calcula qué necesitas en el final.", "Fica les teues notes i calcula què necessites en el final."], action: ["Calcular mi nota", "Calcular la meua nota"] },
  calendar: { body: ["Pon exámenes y entregas en orden. Lo de hoy, primero.", "Posa exàmens i entregues en ordre. El de hui, primer."], action: ["Organizar mi semana", "Organitzar la meua setmana"] },
  teamwork: { body: ["Deja claro quién hace qué y para cuándo.", "Deixa clar qui fa què i per a quan."], action: ["Organizar un trabajo", "Organitzar un treball"] },
  libraries: { body: ["Encuentra biblioteca, mira el horario y elige dónde estudiar.", "Troba biblioteca, mira l’horari i tria on estudiar."], action: ["Buscar un sitio", "Buscar un lloc"] },
};
const filters: ReadonlyArray<{ id: ToolGroup | "all"; label: readonly [string, string] }> = [
  { id: "all", label: ["Todo", "Tot"] }, { id: "study", label: ["Estudiar", "Estudiar"] },
  { id: "organize", label: ["Organizarme", "Organitzar-me"] }, { id: "campus", label: ["Encontrar sitio", "Trobar lloc"] },
];

// Next notifica tanto los enlaces internos como atrás/adelante mediante los parámetros.
function useOpenTool() {
  const { locale } = useCommunity();
  const params = useSearchParams();
  const slug = params.get("tool");
  return slug ? toolBySlug(locale, slug)?.id ?? null : null;
}

function DeskArtwork({ id }: { id: ToolKind }) {
  return <span className={`st-desk-art st-desk-art-${id}`} aria-hidden="true">
    {id === "notes" && <><span className="st-desk-sheet sheet-back"><i/><i/><i/></span><span className="st-desk-sheet sheet-middle"><i/><i/><i/></span><span className="st-desk-sheet sheet-front"><i/><i/><i/></span><Sparkles className="st-desk-spark"/></>}
    {id === "exam" && <span className="st-desk-test">{[0,1,2,3].map(i=><span key={i}><b>{i===1&&<Check/>}</b><i/></span>)}</span>}
    {id === "grades" && <span className="st-desk-ticks"><i/><i/><i/></span>}
    {id === "calendar" && <span className="st-desk-calendar">{[0,1,2,3,4].map(i=><i key={i} className={i===3?"marked":""}/>)}</span>}
    {id === "teamwork" && <span className="st-desk-team"><Users/><Heart/></span>}
    {id === "libraries" && <span className="st-desk-library"><MapPin/><Landmark/><span className="st-desk-path"/></span>}
  </span>;
}

function ToolCard({ tool, language, locale, demo }: { tool: typeof tools[number]; language: 0 | 1; locale: "es" | "va"; demo: boolean }) {
  const Icon = artwork[tool.id];
  const featured = tool.group === "study";
  const library = tool.id === "libraries";
  return <Link href={toolPath(locale, demo, tool.id)} className={`st-desk-card st-desk-card-${tool.id} ${featured ? "st-desk-featured" : library ? "st-desk-band" : "st-desk-compact"}`}>
    <span className="st-desk-card-icon"><Icon aria-hidden="true"/>{tool.ai&&<span className="st-desk-ai">IA</span>}</span>
    <span className="st-desk-card-copy"><strong>{tool.title[language]}</strong><span>{deskCopy[tool.id].body[language]}</span></span>
    <span className="st-desk-card-action"><span className={featured||library?undefined:"sr-only"}>{deskCopy[tool.id].action[language]}</span><span className="st-desk-arrow"><ArrowRight aria-hidden="true"/></span></span>
    <DeskArtwork id={tool.id}/>
  </Link>;
}

function StudentDesk() {
  const { locale, demo } = useCommunity();
  const language = languageIndex(locale);
  const [search, setSearch] = useState("");
  const [focused,setFocused] = useState(false);
  const [filter, setFilter] = useState<ToolGroup | "all">("all");
  const open = useOpenTool();
  const active = open ? tools.find(tool => tool.id === open) : undefined;
  if (active) { const Screen = active.component; return <Screen />; }
  const listed = tools.filter(tool => (filter === "all" || tool.group === filter) && matches(search, tool.title[language], tool.description[language], deskCopy[tool.id].body[language]));
  const renderCard = (tool: typeof tools[number]) => <ToolCard key={tool.id} tool={tool} language={language} locale={locale} demo={demo}/>;
  const study = listed.filter(tool=>tool.group==="study");
  const organize = listed.filter(tool=>tool.group==="organize");
  const campus = listed.filter(tool=>tool.group==="campus");
  return <div className="st-hub">
    {!focused&&<StudentDashboard search={search} onSearch={setSearch}/>}
    <LearningCenter onFocusChange={setFocused}/>
    <div className="lc-tools-wrap" hidden={focused}>
    <div className="st-desk-toolbar">
      <div className="st-desk-filters" role="group" aria-label={language?"Tipus de ferramenta":"Tipo de herramienta"}>{filters.map(item=><button type="button" key={item.id} aria-pressed={filter===item.id} aria-controls="student-tools" onClick={()=>setFilter(item.id)}>{item.label[language]}</button>)}</div>
      <div className="st-desk-search"><Search aria-hidden="true"/><label className="sr-only" htmlFor="student-search">{language?"Buscar ferramenta":"Buscar herramienta"}</label><input id="student-search" type="search" placeholder={language?"Buscar ferramenta":"Buscar herramienta"} value={search} onChange={e=>setSearch(e.target.value)} autoComplete="off"/>{search&&<button type="button" aria-label={language?"Netejar cerca":"Limpiar búsqueda"} onClick={()=>setSearch("")}><X/></button>}</div>
    </div>
    <p className="sr-only" role="status">{listed.length} {language?"ferramentes disponibles":"herramientas disponibles"}</p>
    <div id="student-tools" className="st-desk-tools">
      {study.length>0&&<section className="st-desk-section" aria-labelledby="desk-study"><div className="st-desk-section-heading"><h3 id="desk-study">{language?"Quan llegir no és prou.":"Cuando leerlo no basta."}</h3><p>{language?"Pregunta als teus apunts o posa’t a prova abans de l’examen.":"Pregunta a tus apuntes o ponte a prueba antes del examen."}</p></div><div className="st-desk-study">{study.map(renderCard)}</div></section>}
      {organize.length>0&&<section className="st-desk-section" aria-labelledby="desk-organize"><div className="st-desk-section-heading"><h3 id="desk-organize">{language?"Perquè no et caiga tot alhora.":"Para que no te pille todo a la vez."}</h3></div><div className="st-desk-organize">{organize.map(renderCard)}</div></section>}
      {campus.length>0&&<section className="st-desk-campus" aria-label={language?"Llocs per a estudiar":"Sitios para estudiar"}>{campus.map(renderCard)}</section>}
      {listed.length===0&&<div className="st-desk-empty"><Search aria-hidden="true"/><h3>{language?"No trobem eixa ferramenta.":"No encontramos esa herramienta."}</h3><p>{language?"Prova amb «apunts», «notes» o «setmana».":"Prueba con «apuntes», «notas» o «semana»."}</p><button type="button" className="st-button" onClick={()=>{setSearch("");setFilter("all");}}>{language?"Vore totes les ferramentes":"Ver todas las herramientas"}<ArrowRight/></button></div>}
    </div>
    </div>
    <p className="st-desk-signoff" hidden={focused}>{language?"Tria una cosa. Comença per ací.":"Elige una cosa. Empieza por ahí."}<Heart aria-hidden="true"/></p>
  </div>;
}

export function StudentHub() {
  const { locale } = useCommunity();
  return <Suspense fallback={<p className="st-muted" role="status">{locale === "va" ? "Carregant Estudiant…" : "Cargando Estudiante…"}</p>}><StudentDesk/></Suspense>;
}
