
import { createTranslator, type Locale } from "@/lib/i18n";
import Image from "next/image";
import { ArrowDownRight, ArrowUpRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authConfigured } from "@/lib/auth/config";

const accessSteps = [
  { title: "Tu correo de la uni.", body: "Sí, el que abres cuando llega algo que te preocupa." },
  { title: "Verificas que es tuyo.", body: "El correo se confirma. El postureo no hace falta." },
  { title: "Encuentras tu campus.", body: "Y empiezas por un plan, un grupo o un hola." },
];

export function UniversityAccess({ locale = "es" }: { locale?: Locale }) {
  const tr = createTranslator(locale);
  return (
    <section id="acceso" className="university-access" aria-labelledby="access-title">
      <div className="section-inner access-grid">
        <div className="access-copy" data-reveal="rise">
          <p className="eyebrow">{tr("La única condición")}</p>
          <h2 id="access-title">{tr("No es para")}<br />{tr("todo el mundo.")}<br /><em>{tr("Esa es la gracia.")}</em></h2>
          <p>{tr("Internet ya tiene un sitio donde cabe cualquiera. Aquí queremos algo que tengáis en común.")}</p>
          <p>{tr("Un campus. Una etapa. La posibilidad de cruzaros al salir de clase.")}</p>
        </div>
        <div className="access-process" data-reveal="rise" data-reveal-delay="100">
          <p className="access-process-intro">{authConfigured ? tr("Así entras en tu campus.") : tr("Así será el acceso cuando abramos.")}</p>
          <ol>{accessSteps.map((step, index) => <li key={step.title}><span className="step-number">0{index + 1}</span><div><h3>{tr(step.title)}</h3><p>{tr(step.body)}</p></div></li>)}</ol>
          <p className="access-process-note">{tr("Un correo personal no basta.")}<br /><strong>{tr("El de tu universidad es la puerta.")}</strong></p>
        </div>
      </div>
    </section>
  );
}

const questions = [
  {
    question: "¿Las ClasiCoins son otra forma de cobrarme?",
    answer: "No. Son un incentivo para participar. No se compran, no se venden ni se cambian por dinero. Empiezas con 20 al completar tu perfil verificado. Crear un evento usa 10 y abrir un hilo, 5. Puedes ganar 3 al apuntarte a un evento ajeno y 2 por tu primera respuesta en otro hilo. Hay límites para premiar la participación, no repetir clics.",
  },
  {
    question: "¿Solo Valencia?",
    answer: "En esta primera etapa, sí. Entreclase empieza en las universidades de Valencia, públicas y privadas. Primero queremos que aquí sea fácil encontrar a tu gente. Ya habrá tiempo de hacer la maleta.",
  },
  {
    question: "¿También puedo usarla en valenciano?",
    answer: "Sí. La landing, el registro y toda la aplicación están en español y valenciano. Cambia de idioma arriba y sigue hablando como te salga natural.",
  },
  {
    question: "¿No es irónico quejarse de las redes y hacer otra?",
    answer: "Un poco. La diferencia que buscamos está en lo que haces después de abrirla: encontrar un grupo, resolver una duda o quedar con alguien de tu campus. Si acabas tomando un café, la pantalla ya ha hecho su trabajo.",
  },
  {
    question: "¿Y si ya tengo mi grupo de amigos?",
    answer: "No te lo vamos a confiscar. Entreclase también está pensado para organizar lo de siempre y encontrar a quien se apunta a eso que a tus amigos les da pereza.",
  },
  {
    question: "¿Esto también va de ligar?",
    answer: "También puede pasar. Si os apetece a los dos. Puedes venir a hacer amigos, compartir un plan o conocer a alguien que te guste. No hay que convertir cada «hola» en una entrevista de pareja.",
  },
  {
    question: "¿Tengo que publicar mi vida?",
    answer: "Con presentarte ya llevas bastante ganado. Puedes preguntar por unos apuntes o apuntarte a un plan. No hace falta tener una vida que parezca un anuncio de colonia.",
  },
  {
    question: "¿Puedo entrar con mi correo personal?",
    answer: "Puedes entrar con un correo universitario admitido o con la invitación personal de alguien de la comunidad. Cada universitario puede traer a una persona; las cuentas invitadas no pueden invitar. En ambos casos hay que confirmar el correo.",
  },
  {
    question: "¿Puedo entrar ya?",
    answer: authConfigured ? "Puedes crear tu cuenta con un correo universitario admitido, confirmarlo y entrar a tu campus. Lo siguiente lo decides tú: un plan, un grupo o un hola." : "Ya puedes recorrer la demo y probar el muro, los planes y los grupos con perfiles de ejemplo. Las cuentas reales siguen en preparación. Cuando abramos, necesitarás verificar tu correo universitario.",
  },
];

export function LandingFaq({ locale = "es" }: { locale?: Locale }) {
  const tr = createTranslator(locale);
  return (
    <section id="dudas" className="faq-section" aria-labelledby="faq-title">
      <div className="section-inner faq-grid">
        <div className="faq-intro" data-reveal="rise"><h2 id="faq-title">{tr("Vale.")}<br />{tr("Pero...")}</h2><p>{tr("Las preguntas que harías antes de darle tu correo a otra red social.")}</p><ArrowDownRight aria-hidden="true" strokeWidth={1.4} /></div>
        <div className="faq-list">{questions.map((item, index) => (
          <details key={item.question} name="entreclase-questions" open={index === 0} className="faq-item" data-reveal="rise">
            <summary><span>{tr(item.question)}</span><Plus aria-hidden="true" /></summary>
            <p>{tr(item.answer)}</p>
          </details>
        ))}</div>
      </div>
    </section>
  );
}

export function StoryEnding({ locale = "es" }: { locale?: Locale }) {
  const tr = createTranslator(locale);
  return (
    <section id="un-minuto-despues" className="story-ending" aria-labelledby="ending-title">
      <div className="section-inner ending-grid">
        <div className="ending-copy">
          <p className="eyebrow">{tr("Volvamos al viernes")}</p>
          <h2 id="ending-title" data-reveal="rise">14:08.</h2>
          <p>{tr("Esta vez ves el plan de la Malvarrosa.")}<br />{tr("Escribes: «¿Cabe uno más?».")}</p>
          <p>{tr("La respuesta llega:")}</p>
          <p className="ending-reply" data-reveal="card" data-reveal-delay="100">{tr("«Claro».")}</p>
          <p>{tr("La mesa de al lado")}<br /><strong>{tr("ya no es la de al lado.")}</strong></p>
          <Button asChild className="entreclase-button ending-button"><a href="#entrar">{tr("Encontrar mi gente")}<ArrowUpRight data-icon="inline-end" /></a></Button>
        </div>
        <figure className="ending-photo" data-reveal="rise">
          <Image src="/images/campus-walk.webp" width={1440} height={960} sizes="(max-width: 700px) 100vw, 55vw" alt={tr("Los cuatro estudiantes salen juntos del café y caminan charlando por el campus.")} />
          <figcaption>{tr("Y mira. Al final había sitio.")}</figcaption>
        </figure>
      </div>
    </section>
  );
}
