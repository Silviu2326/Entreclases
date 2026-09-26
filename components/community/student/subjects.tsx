"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Archive, ArrowRight, BookOpen, CalendarDays, FileText, Pencil, Plus, Undo2 } from "lucide-react";
import { useCommunity } from "../context";
import { Modal } from "../controls";
import { toolPath } from "@/lib/community/student/catalog";
import { useNotesStore, notesStoreKey } from "@/lib/community/student/notes";
import { newId, storageKey, useToolStore } from "@/lib/community/student/storage";
import { emptySubjects, type Subject } from "@/lib/community/student/learning";
import { StudySync } from "./study-sync";
import "./subjects.css";
export function SubjectsWorkspace({onStudy}:{onStudy?:(id:string)=>void}){
 const {locale,demo,me}=useCommunity(),t=(es:string,va:string)=>locale==="va"?va:es;
 const scope={demo,userId:me.user_id},key=storageKey(scope,"subjects");
 const [state,setState,ready,status]=useToolStore(key,emptySubjects);
 const {docs}=useNotesStore(notesStoreKey(scope));
 const [editing,setEditing]=useState<Subject|null>(null),[open,setOpen]=useState(false),[showArchived,setShowArchived]=useState(false);
 const [name,setName]=useState(""),[topic,setTopic]=useState(""),[goal,setGoal]=useState(""),[course,setCourse]=useState(""),[date,setDate]=useState(""),[selected,setSelected]=useState<string[]>([]);
 const begin=(subject?:Subject)=>{setEditing(subject??null);setName(subject?.name??"");setTopic(subject?.topic??"");setGoal(subject?.goal??"");setCourse(subject?.course??"");setDate(subject?.examDate??"");setSelected(subject?.noteIds??[]);setOpen(true);};
 const save=(event:FormEvent)=>{event.preventDefault();if(!name.trim())return;
  const item:Subject={id:editing?.id??newId(),name:name.trim(),topic:topic.trim(),goal:goal.trim(),course:course.trim(),examDate:date,noteIds:selected,createdAt:editing?.createdAt??new Date().toISOString(),archived:editing?.archived??false};
  setState(current=>({subjects:editing?current.subjects.map(s=>s.id===editing.id?item:s):[...current.subjects,item]}));setOpen(false);
 };
 if(!ready)return <section className="sw-workspace" aria-busy="true"><p>{t("Preparando tus asignaturas…","Preparant les teues assignatures…")}</p></section>;
 const list=state.subjects.filter(s=>!!s.archived===showArchived);
 return <section id="student-subjects" className="sw-workspace" aria-labelledby="sw-title">
  <div className="sw-heading"><div><span className="sw-kicker">{t("DURANTE TODO EL CURSO","DURANT TOT EL CURS")}</span><h2 id="sw-title">{t("Lo que estás aprendiendo.","El que estàs aprenent.")}</h2><p>{t("Sigue las clases, resuelve dudas y avanza en tus trabajos.","Segueix les classes, resol dubtes i avança en els treballs.")}</p></div><button type="button" className="sw-add" onClick={()=>begin()}><Plus/><span>{t("Añadir asignatura","Afegir assignatura")}</span></button></div>
  {state.subjects.some(s=>s.archived)&&<button className="lc-text-button" type="button" onClick={()=>setShowArchived(!showArchived)}><Archive size={15}/>{showArchived?t("Volver al curso actual","Tornar al curs actual"):t("Ver archivo de cursos","Vore arxiu de cursos")}</button>}
  {list.length?<div className="sw-grid">{list.map((subject,index)=>{
   const attached=docs.filter(d=>subject.noteIds.includes(d.id));
   return <article className={"sw-card sw-card-"+index%4} key={subject.id}><div className="sw-card-top"><span className="sw-card-mark"><BookOpen/></span><div className="sw-card-tools"><button aria-label={t("Editar ","Editar ")+subject.name} onClick={()=>begin(subject)}><Pencil/></button><button aria-label={(subject.archived?t("Recuperar ","Recuperar "):t("Archivar ","Arxivar "))+subject.name} onClick={()=>setState(current=>({subjects:current.subjects.map(s=>s.id===subject.id?{...s,archived:!s.archived}:s)}))}>{subject.archived?<Undo2/>:<Archive/>}</button></div></div><h3>{subject.name}</h3>
   <p className="sw-current-topic">{subject.topic||t("Tu próximo tema empieza aquí.","El teu pròxim tema comença ací.")}</p>
   <div className="sw-meta"><span><FileText/>{attached.length} {t("apuntes","apunts")}</span>{subject.course&&<span>{subject.course}</span>}{subject.examDate&&<span><CalendarDays/>{new Date(subject.examDate+"T12:00:00").toLocaleDateString(locale==="va"?"ca-ES":"es-ES",{day:"numeric",month:"short"})}</span>}</div>
   <div className="sw-docs">{attached.slice(0,2).map(d=><span key={d.id}><FileText/>{d.name}</span>)}{!attached.length&&<span className="sw-no-docs">{t("Añade el material que estás viendo en clase.","Afig el material que estàs veient en classe.")}</span>}</div>
   <div className="sw-card-bottom"><span className="sw-result">{subject.goal||t("A tu ritmo","Al teu ritme")}</span>{attached.length&&onStudy&&!subject.archived?<button onClick={()=>onStudy(subject.id)}>{t("Estudiar","Estudiar")}<ArrowRight/></button>:<button onClick={()=>begin(subject)}>{t("Organizar","Organitzar")}<ArrowRight/></button>}</div></article>;
  })}</div>:<div className="sw-empty"><span className="sw-empty-illustration"><BookOpen/></span><div><h3>{t("¿Qué estás dando en clase?","Què estàs donant en classe?")}</h3><p>{t("Empieza con el nombre de una asignatura. Añade temas, material y fechas cuando los tengas.","Comença amb el nom d’una assignatura. Afig temes, material i dates quan els tingues.")}</p><button className="sw-empty-action" onClick={()=>begin()}><Plus/>{t("Crear mi primera asignatura","Crear la primera assignatura")}</button></div></div>}
  <StudySync storeKey={key} status={status}/>
  <Modal open={open} onOpenChange={setOpen} title={editing?t("Organizar asignatura","Organitzar assignatura"):t("Nueva asignatura","Nova assignatura")} description={t("Solo necesitas un nombre para empezar.","Només necessites un nom per a començar.")}>
   <form className="lc-form" onSubmit={save}>
    <label>{t("Nombre de la asignatura","Nom de l’assignatura")}<input required autoFocus maxLength={70} value={name} onChange={e=>setName(e.target.value)} placeholder={t("Ej. Microeconomía","Ex. Microeconomia")}/></label>
    <label>{t("¿Qué tema estás viendo? (opcional)","Quin tema estàs veient? (opcional)")}<input maxLength={160} value={topic} onChange={e=>setTopic(e.target.value)} placeholder={t("Ej. Oferta y demanda","Ex. Oferta i demanda")}/></label>
    <label>{t("¿Qué te gustaría conseguir? (opcional)","Què t’agradaria aconseguir? (opcional)")}<input maxLength={160} value={goal} onChange={e=>setGoal(e.target.value)} placeholder={t("Entender las clases sin quedarme atrás","Entendre les classes sense quedar-me arrere")}/></label>
    <fieldset><legend>{t("Vincular apuntes","Vincular apunts")}</legend>{docs.length?<div className="lc-doc-picker">{docs.map(doc=><label key={doc.id}><input type="checkbox" checked={selected.includes(doc.id)} onChange={()=>setSelected(current=>current.includes(doc.id)?current.filter(id=>id!==doc.id):[...current,doc.id])}/><span>{doc.name}</span></label>)}</div>:<p>{t("Puedes añadirlos después desde el Tutor de apuntes.","Pots afegir-los després des del Tutor d’apunts.")} <Link href={toolPath(locale,demo,"notes")}>{t("Subir apuntes","Pujar apunts")}</Link></p>}</fieldset>
    <details><summary>{t("Curso y fechas (opcionales)","Curs i dates (opcionals)")}</summary><label>{t("Curso o periodo","Curs o període")}<input maxLength={60} value={course} onChange={e=>setCourse(e.target.value)} placeholder="2026–2027 · Primer cuatrimestre"/></label><label>{t("Fecha de examen, cuando la sepas","Data d’examen, quan la sàpies")}<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label></details>
    <div className="u-form-actions"><button type="button" className="st-button" onClick={()=>setOpen(false)}>{t("Cancelar","Cancel·lar")}</button><button className="st-button primary" type="submit">{editing?t("Guardar cambios","Guardar canvis"):t("Crear asignatura","Crear assignatura")}<ArrowRight/></button></div>
   </form>
  </Modal>
 </section>;
}
