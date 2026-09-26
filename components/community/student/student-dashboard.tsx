"use client";
import {type FormEvent} from "react";
import Link from "next/link";
import Image from "next/image";
import {ArrowRight, BookOpen, CalendarDays, Clock3, FileText, GraduationCap, MapPin, Plus, ScanLine, Search, Sparkles, Target, Upload, Users} from "lucide-react";
import {useCommunity} from "../context";
import {toolPath} from "@/lib/community/student/catalog";
import {emptyLearning,emptySubjects} from "@/lib/community/student/learning";
import {emptyState,todayAgenda,todayKey,upcoming} from "@/lib/community/student/calendar";
import {notesStoreKey,useNotesStore} from "@/lib/community/student/notes";
import {storageKey,useToolStore} from "@/lib/community/student/storage";
import "./student-dashboard.css";

export function StudentDashboard({search,onSearch}:{search:string;onSearch:(value:string)=>void}){
 const {locale,demo,me,data,go,repo,run}=useCommunity(),va=locale==="va",t=(es:string,val:string)=>va?val:es;
 const scope={demo,userId:me.user_id};
 const [calendar,,calendarReady]=useToolStore(storageKey(scope,"calendar"),emptyState());
 const [learning,,learningReady]=useToolStore(storageKey(scope,"learning"),emptyLearning);
 const [subjectState,,subjectsReady]=useToolStore(storageKey(scope,"subjects"),emptySubjects);
 const {docs,ready:notesReady}=useNotesStore(notesStoreKey(scope));
 const ready=calendarReady&&learningReady&&subjectsReady&&notesReady;
 const today=todayKey(),agenda=todayAgenda(calendar,today),deadlines=upcoming(calendar,today,7);
 const subjects=subjectState.subjects.filter(s=>!s.archived);
 const exam=subjects.filter(s=>s.examDate>=today).sort((a,b)=>a.examDate.localeCompare(b.examDate))[0]??subjects[0];
 const events=[
  ...agenda.classes.map(s=>({id:s.id,time:s.start,title:s.course?.name??t("Clase","Classe"),detail:s.room||t("En tu campus","Al teu campus"),kind:"class"})),
  ...deadlines.map(({deadline:d,daysLeft})=>({id:d.id,time:daysLeft===0?(d.time||t("Hoy","Hui")):daysLeft===1?t("Mañana","Demà"):String(daysLeft)+" "+t("días","dies"),title:d.title,detail:d.kind==="exam"?t("Examen","Examen"):t("Entrega","Lliurament"),kind:d.kind}))
 ].slice(0,4);
 const shownEvents=events.length?events:demo?[
  {id:"demo-redes",time:t("Hoy · 10:00","Hui · 10:00"),title:"Redes",detail:"Aula 2.3",kind:"class"},
  {id:"demo-bases",time:t("Hoy · 12:00","Hui · 12:00"),title:"Bases de Datos",detail:"Aula 1.1",kind:"class"},
  {id:"demo-entrega",time:t("Hoy · 16:00","Hui · 16:00"),title:t("Entrega de programación","Lliurament de programació"),detail:t("Aula virtual","Aula virtual"),kind:"delivery"},
  {id:"demo-examen",time:t("Mañana · 9:00","Demà · 9:00"),title:t("Examen de Matemáticas","Examen de Matemàtiques"),detail:"Aulario Norte",kind:"exam"}
 ]:[];
 const study=subjects.slice(0,3).map(s=>{const concepts=learning.concepts.filter(c=>c.subjectId===s.id);return{id:s.id,name:s.name,topic:s.topic||t("Tu próximo tema","El teu pròxim tema"),progress:concepts.length?Math.round(100*concepts.filter(c=>c.lastOutcome==="independent").length/concepts.length):0,sources:s.noteIds.length};});
 const shownStudy=study.length?study:demo?[
  {id:"demo-r",name:"Redes",topic:"Tema 3 · Capa de transporte",progress:68,sources:12},
  {id:"demo-b",name:"Bases de Datos",topic:"Tema 5 · Normalización",progress:42,sources:18},
  {id:"demo-p",name:"Programación",topic:"Tema 4 · Estructuras de datos",progress:25,sources:9}
 ]:[];
 const examProgress=exam?study.find(s=>s.id===exam.id)?.progress??0:demo?42:0;
 const activity=[...docs.map(d=>({id:d.id,title:d.name,detail:t("Apuntes añadidos","Apunts afegits"),at:d.addedAt,Icon:FileText})),...learning.sessions.map(s=>({id:s.id,title:s.subjectName,detail:s.completedAt?t("Sesión completada","Sessió completada"):t("Sesión empezada","Sessió començada"),at:s.completedAt||s.createdAt,Icon:BookOpen}))].sort((a,b)=>b.at.localeCompare(a.at)).slice(0,4);
 const shownActivity=activity.length?activity:demo?[
  {id:"d1",title:"Apuntes de Redes",detail:t("Archivo de ejemplo","Arxiu d'exemple"),at:"",Icon:FileText},
  {id:"d2",title:"Clase de Bases de Datos",detail:t("Sesión de ejemplo","Sessió d'exemple"),at:"",Icon:BookOpen},
  {id:"d3",title:"Trabajo en grupo",detail:t("Actividad de ejemplo","Activitat d'exemple"),at:"",Icon:Users}
 ]:[];
 const groups=data.groups.filter(g=>!data.groupMembers.some(m=>m.group_id===g.id&&m.user_id===me.user_id)).slice(0,3);
 const notes=toolPath(locale,demo,"notes"),test=toolPath(locale,demo,"exam"),calendarLink=toolPath(locale,demo,"calendar");
 function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();document.getElementById("student-tools")?.scrollIntoView({behavior:"smooth"});}
 return <div className="sd-layout" aria-busy={!ready}>
  <div className="sd-main">
   <section className="sd-hero" aria-labelledby="sd-title"><div className="sd-hero-copy"><h2 id="sd-title">{t("Se te ha juntado todo.","Se t’ha ajuntat tot.")}<em>{t("Vamos por partes.","Anem per parts.")}</em></h2><p>{t("En Entreclases te ayudamos con tus apuntes, exámenes y trabajos en grupo. Todo en un mismo lugar, con la ayuda de EntreIA y tu comunidad.","En Entreclases t’ajudem amb els apunts, exàmens i treballs en grup. Tot en un mateix lloc, amb l’ajuda d’EntreIA i la teua comunitat.")}</p></div><span className="sd-scribble" aria-hidden="true">{t("Mejores estudiantes,\nvidas más tranquilas.","Millors estudiants,\nvides més tranquil·les.")}</span><Image className="sd-art" src="/images/student-desk-illustration.png" alt="" width={400} height={480} priority/></section>
   <form className="sd-search" role="search" onSubmit={submit}><Search/><label className="sr-only" htmlFor="student-main-search">{t("Buscar herramientas de estudio","Buscar ferramentes d’estudi")}</label><input id="student-main-search" type="search" value={search} onChange={e=>onSearch(e.target.value)} placeholder={t("Busca apuntes, exámenes o herramientas…","Busca apunts, exàmens o ferramentes…")}/><button aria-label={t("Ver resultados","Vore resultats")} type="submit"><ArrowRight/></button></form>
   <nav className="sd-quick" aria-label={t("Acciones de estudio","Accions d’estudi")}><Link href={notes}><Upload/>{t("Subir apuntes","Pujar apunts")}</Link><Link href={test}><Target/>{t("Preparar examen","Preparar examen")}</Link><Link href={notes}><ScanLine/>{t("Escanear apuntes","Escanejar apunts")}</Link><button type="button" onClick={()=>go("groups")}><Users/>{t("Crear grupo","Crear grup")}</button></nav>
   <div className="sd-work-grid">
    <section className="sd-panel sd-day"><div className="sd-panel-head"><h3><CalendarDays/>{t("Tu día","El teu dia")}</h3><Link href={calendarLink}>{t("Ver calendario","Vore calendari")}<ArrowRight/></Link></div>{shownEvents.length?<div className="sd-day-grid">{shownEvents.map((item,i)=><Link key={item.id} href={calendarLink} className={"sd-day-tile sd-day-tile-"+i%2}><small>{item.time}</small><strong>{item.title}</strong><span><MapPin/>{item.detail}</span><span><FileText/>{item.kind==="class"?t("Preparar clase","Preparar classe"):item.kind==="exam"?t("Repasar ejercicios","Repassar exercicis"):t("Revisar entrega","Revisar lliurament")}</span></Link>)}</div>:<div className="sd-empty"><p>{t("Añade clases o entregas para verlas aquí.","Afig classes o lliuraments per a vore'ls ací.")}</p><Link href={calendarLink}><Plus/>{t("Organizar mi semana","Organitzar la setmana")}</Link></div>}</section>
    <section className="sd-panel sd-exam"><div className="sd-panel-head"><h3><Target/>{t("Prepárame para el examen","Prepara’m per a l’examen")}</h3></div>{exam||demo?<><div className="sd-exam-name"><span><FileText/></span><div><strong>{exam?.name||"Bases de Datos"}</strong><small>{exam?.examDate?new Date(exam.examDate+"T12:00:00").toLocaleDateString(va?"ca-ES":"es-ES",{day:"numeric",month:"long"}):t("Practica con tus apuntes","Practica amb els apunts")}</small></div></div><div className="sd-progress"><span style={{width:examProgress+"%"}}/></div><div className="sd-progress-caption"><span>{t("Lo que ya llevas","El que ja portes")}</span><strong>{examProgress}%</strong></div><div className="sd-topic-tags">{(exam?.topic?exam.topic.split(/[,·]/).map(x=>x.trim()).filter(Boolean).slice(0,3):["Normalización","Transacciones","SQL avanzado"]).map(topic=><span key={topic}>{topic}</span>)}</div><Link className="sd-dark-action" href={test}><ArrowRight/>{t("Practicar para el examen","Generar pla d’estudi")}</Link></>:<div className="sd-empty"><p>{t("Añade una asignatura y empieza a prepararte.","Afig una assignatura i comença a preparar-te.")}</p><a href="#student-subjects"><Plus/>{t("Añadir asignatura","Afegir assignatura")}</a></div>}</section>
    <section className="sd-panel sd-subjects"><div className="sd-panel-head"><h3><BookOpen/>{t("Continúa estudiando","Continua estudiant")}</h3><a href="#student-subjects">{t("Ver todos mis temas","Vore tots els temes")}<ArrowRight/></a></div>{shownStudy.length?<div className="sd-subject-grid">{shownStudy.map((s,i)=><a key={s.id} className={"sd-subject sd-subject-"+i} href="#student-subjects"><strong>{s.name}</strong><small>{s.topic}</small><div className="sd-subject-progress"><span style={{width:s.progress+"%"}}/><b>{s.progress}%</b></div><span className="sd-subject-footer"><FileText/>{s.sources} {t("fuentes","fonts")}</span></a>)}</div>:<div className="sd-empty"><p>{t("Empieza con una asignatura y tus apuntes.","Comença amb una assignatura i els apunts.")}</p><a href="#student-subjects"><Plus/>{t("Crear asignatura","Crear assignatura")}</a></div>}</section>
    <section className="sd-panel sd-insights"><div className="sd-panel-head"><h3><Sparkles/>{t("EntreIA ha encontrado","EntreIA ha trobat")}</h3><a href="#student-subjects">{t("Ver más","Vore més")}<ArrowRight/></a></div><div className="sd-insight-grid"><a href="#student-subjects"><FileText/><span><strong>{t("Tus apuntes, juntos","Els apunts, junts")}</strong><small>{subjects.filter(s=>!s.noteIds.length).length||t("Añade material a tus temas","Afig material als temes")}</small></span></a><button type="button" onClick={()=>go("groups")}><Users/><span><strong>{t("Estudia con otros","Estudia amb altres")}</strong><small>{t("Encuentra tu grupo","Troba el teu grup")}</small></span></button><a href="#student-subjects"><Target/><span><strong>{t("Tu punto fuerte","El teu punt fort")}</strong><small>{learning.concepts.filter(c=>c.lastOutcome==="independent").length} {t("conceptos asentados","conceptes assolits")}</small></span></a><Link href={test}><GraduationCap/><span><strong>{t("A mejorar","Per a millorar")}</strong><small>{t("Ponte a prueba","Posa't a prova")}</small></span></Link></div></section>
   </div>
  </div>
  <aside className="sd-rail" aria-label={t("Tu campus y comunidad","El teu campus i comunitat")}>
   <section className="sd-panel sd-campus"><div className="sd-panel-head"><h3><MapPin/>{t("Tu campus","El teu campus")}</h3><button type="button" aria-label={t("Ver campus","Vore campus")} onClick={()=>go("campus")}><ArrowRight/></button></div><div className="sd-campus-detail"><Image src="/images/explore-bg-campus.webp" alt="" width={76} height={84}/><div><strong>{me.university||t("Tu universidad","La teua universitat")}</strong><small>{me.campus||t("Valencia · Campus","València · Campus")}</small><button type="button" onClick={()=>go("profile")}>{t("Cambiar campus","Canviar campus")}</button></div></div></section>
   <section className="sd-panel sd-activity"><div className="sd-panel-head"><h3><Clock3/>{t("Actividad reciente","Activitat recent")}</h3><Link href={notes} aria-label={t("Ver apuntes","Vore apunts")}><ArrowRight/></Link></div>{shownActivity.length?<div className="sd-activity-list">{shownActivity.map(item=>{const Icon=item.Icon;return <Link href={notes} key={item.id}><span className="sd-activity-icon"><Icon/></span><span><strong>{item.title}</strong><small>{item.detail}</small></span></Link>})}</div>:<div className="sd-empty"><p>{t("Tu actividad de estudio aparecerá aquí.","La teua activitat d'estudi apareixerà ací.")}</p><Link href={notes}><Plus/>{t("Subir apuntes","Pujar apunts")}</Link></div>}</section>
   <section className="sd-panel sd-groups"><div className="sd-panel-head"><h3><Users/>{t("Grupos recomendados","Grups recomanats")}</h3><button type="button" aria-label={t("Ver grupos","Vore grups")} onClick={()=>go("groups")}><ArrowRight/></button></div>{groups.length?<div className="sd-groups-list">{groups.map(g=><div key={g.id}><span className="sd-group-icon"><Users/></span><span><strong>{g.name}</strong><small>{g.campus}</small></span><button type="button" aria-label={t("Unirme a ","Unir-me a ")+g.name} onClick={()=>void run(()=>repo.joinGroup(g.id,true),t("Te has unido al grupo","T'has unit al grup"))}><Plus/></button></div>)}</div>:<div className="sd-empty"><p>{t("Busca gente con quien estudiar.","Busca gent amb qui estudiar.")}</p><button type="button" onClick={()=>go("groups")}><Plus/>{t("Explorar grupos","Explorar grups")}</button></div>}</section>
  </aside>
 </div>;
}
