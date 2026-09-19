"use client";

import { createTranslator, type Locale } from "@/lib/i18n";

import { ArrowUpRight, BookOpen, CalendarDays, Check, Clock3, FileText, MapPin, MessageCircle, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function StudyBoard({ locale = "es" }: { locale?: Locale }) {
  const tr = createTranslator(locale);
  return (
    <div className="life-board study-board" aria-label={tr("Ejemplo de apuntes, grupos y biblioteca")}>
      <div className="life-board-heading"><BookOpen aria-hidden="true" /><span>{tr("Lo de mañana, resuelto.")}</span></div>
      <div className="life-board-row"><FileText aria-hidden="true" /><div><strong>{tr("Tema 4. Ahora sí.")}</strong><p>{tr("Apuntes · Economía")}</p></div><span className="file-label">{tr("PDF")}</span></div>
      <div className="life-board-row"><UsersRound aria-hidden="true" /><div><strong>{tr("¿Repasamos juntos?")}</strong><p>{tr("Grupo de estudio · Mañana, 10:00")}</p></div></div>
      <div className="life-board-row"><Clock3 aria-hidden="true" /><div><strong>{tr("Biblioteca de tu campus")}</strong><p>{tr("Horarios, salas y un sitio para concentrarte.")}</p></div></div>
      <p className="board-footnote">{tr("Un vistazo a la propuesta. Contenido de ejemplo.")}</p>
    </div>
  );
}

function PlansBoard({ locale = "es" }: { locale?: Locale }) {
  const tr = createTranslator(locale);
  return (
    <div className="life-board plans-board" aria-label={tr("Ejemplo de planes cerca del campus")}>
      <div className="life-board-heading"><MapPin aria-hidden="true" /><span>{tr("Hoy sí que sí.")}</span></div>
      <div className="plan-example">
        <p className="eyebrow">{tr("Esta tarde · 17:30")}</p>
        <h4>{tr("Un café en Benimaclet.")}<br />{tr("Y ya vemos.")}</h4>
        <p className="place-line"><MapPin aria-hidden="true" />{tr("Benimaclet · Después de clase")}</p>
        <div className="plan-example-bottom"><div className="avatar-stack" aria-hidden="true"><span className="photo-avatar avatar-one" /><span className="photo-avatar avatar-two" /><span className="photo-avatar avatar-three" /></div><span>{tr("Hay sitio para una conversación más.")}</span></div>
      </div>
      <div className="life-board-row"><CalendarDays aria-hidden="true" /><div><strong>{tr("¿Y después?")}</strong><p>{tr("Del cauce a la Malvarrosa. Ya veremos dónde acaba la tarde.")}</p></div></div>
      <p className="board-footnote">{tr("Un vistazo a la propuesta. Plan de ejemplo.")}</p>
    </div>
  );
}

function PeopleBoard({ locale = "es" }: { locale?: Locale }) {
  const tr = createTranslator(locale);
  return (
    <div className="life-board people-board" aria-label={tr("Ejemplo de una conversación en Entreclase")}>
      <div className="life-board-heading"><MessageCircle aria-hidden="true" /><span>{tr("Una conversación cualquiera.")}</span></div>
      <div className="chat-example">
        <div className="chat-person"><span className="photo-avatar avatar-three" aria-hidden="true" /><div><strong>{tr("Nora")}</strong><p>{tr("Música, cine y café después de clase.")}</p></div></div>
        <p className="chat-bubble incoming">{tr("¿Alguien se apunta al atardecer en l’Albufera?")}</p>
        <p className="chat-bubble outgoing">{tr("Yo. Y prometo no hablar del parcial.")}</p>
        <p className="chat-bubble incoming">{tr("Entonces sí.")}</p>
        <p className="chat-aside">{tr("Mira. Ya tenéis algo en común.")}</p>
      </div>
      <p className="board-footnote">{tr("Conversación de ejemplo. El primer hola lo pones tú.")}</p>
    </div>
  );
}

function getStories(locale: Locale) {
 const tr=createTranslator(locale);
 return [
  {
    id: "uni", label: "La uni", icon: BookOpen,
    title: <>{tr("El examen es el martes.")}<br />{tr("El PDF sigue sin aparecer.")}</>,
    opener: "Has leído 486 mensajes. Siete «gracias». Un audio de tres minutos. Los apuntes, ni rastro.",
    body: "Asignaturas, apuntes y grupos de estudio en su sitio. La biblioteca también: dónde está y cuándo abre. Que bastante tienes con entender el tema 4.",
    bullets: ["Apuntes por asignatura", "Grupos para estudiar juntos", "Biblioteca y horarios"],
    link: "Quiero encontrar mi campus",
    board: StudyBoard,
  },
  {
    id: "planes", label: "Los planes", icon: MapPin,
    title: <>{tr("«A ver si quedamos».")}<br />{tr("La frase más larga de la carrera.")}</>,
    opener: "Lleva tres meses en el grupo. Ni fecha. Ni sitio. Ni nadie moviendo un dedo.",
    body: "Un café en Benimaclet. Una vuelta por el Turia. Una tarde en la Malvarrosa. Pon sitio y hora. Lo de «algún día» ya lo habéis probado.",
    bullets: ["Lugares y planes cerca de tu campus", "Grupos para montar el tuyo", "Una hora, un sitio y gente que se apunta"],
    link: "Yo sí me apunto",
    board: PlansBoard,
  },
  {
    id: "gente", label: "La gente", icon: UsersRound,
    title: <>{tr("Puede que coincidáis")}<br />{tr("en algo más que en clase.")}</>,
    opener: "En el mismo concierto. En las ganas de montar algo. En lo poco que os gusta hablar en el grupo de clase.",
    body: "Amigos, compañeros de proyecto o alguien que te apetezca volver a ver. Y sí, también puede gustarte alguien. No hace falta fingir que venías a hablar del temario.",
    bullets: ["Gente con intereses en común", "Conversaciones que empiezan con un hola", "A tu ritmo. Y con interés por ambas partes"],
    link: "Quiero conocer a mi gente",
    board: PeopleBoard,
  },
];
}

export function CampusLife({ locale = "es" }: { locale?: Locale }) {
  const tr = createTranslator(locale);
  const stories=getStories(locale);
  return (
    <section id="vida" className="life-section" aria-labelledby="life-title">
      <div className="section-inner">
        <div className="life-intro" data-reveal="rise">
          <h2 id="life-title" className="section-title">{tr("Ven por los apuntes.")}<br />{tr("Quédate por la gente.")}</h2>
          <p>{tr("La universidad tiene más cosas que la asignatura que te está quitando el sueño. Algunas incluso merecen madrugar.")}</p>
        </div>
        <Tabs defaultValue="uni" className="life-tabs">
          <TabsList variant="line" className="life-tabs-list" aria-label={tr("Qué encontrarás en Entreclase")}>
            {stories.map(({ id, label, icon: Icon }) => <TabsTrigger key={id} value={id}><Icon aria-hidden="true" />{tr(label)}</TabsTrigger>)}
          </TabsList>
          {stories.map(({ id, title, opener, body, bullets, link, board: Board }) => (
            <TabsContent key={id} value={id} className="life-panel">
              <div className="life-copy">
                <h3>{title}</h3>
                <p className="life-opener">{tr(opener)}</p>
                <p>{tr(body)}</p>
                <ul className="life-benefits">{bullets.map((line) => <li key={line}><Check aria-hidden="true" />{tr(line)}</li>)}</ul>
                <Button variant="link" asChild className="life-link"><a href="#entrar">{tr(link)}<ArrowUpRight data-icon="inline-end" /></a></Button>
              </div>
              <Board locale={locale} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}
