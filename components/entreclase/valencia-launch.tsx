import { ArrowUpRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createTranslator, localPath, type Locale } from "@/lib/i18n";

const localScenes = [
  {
    label: "Benimaclet",
    title: "Un café. Y ya vemos.",
    text: "El «me voy pronto» también cuenta como ficción.",
  },
  {
    label: "El cauce del Turia",
    title: "Una vuelta. Sin prisa.",
    text: "Quedamos en las Torres de Serranos. Lo de correr se puede negociar.",
  },
  {
    label: "La Malvarrosa",
    title: "El grupo de clase. Sin clase.",
    text: "Una tarde en la playa. Hoy el único tema es dónde ponemos la toalla.",
  },
  {
    label: "L’Albufera",
    title: "Este atardecer lo ves tú.",
    text: "El de Bali puede esperar. Si sacas el móvil, que sea para decir «vente».",
  },
];

export function ValenciaLaunch({ locale = "es" }: { locale?: Locale }) {
  const tr = createTranslator(locale);
  return (
    <section id="valencia" className="valencia-section" aria-labelledby="valencia-title">
      <div className="section-inner valencia-grid">
        <div data-reveal="rise">
          <p className="eyebrow"><MapPin aria-hidden="true" />{tr("Primera parada · Valencia")}</p>
          <h2 id="valencia-title">{tr("El algoritmo")}<br />{tr("no baja")}<br /><em>{tr("al Turia.")}</em></h2>
        </div>
        <div className="valencia-copy" data-reveal="rise" data-reveal-delay="100">
          <p>{tr("Empezamos en las universidades de Valencia. Públicas y privadas. De Blasco Ibáñez a Tarongers y el campus de Vera. Con gente a la que puedes cruzarte mañana.")}</p>
          <p>{tr("El algoritmo sabe lo que desayuna uno en Bali. Pero no quién se apunta a un café en Benimaclet cuando cierras los apuntes.")}</p>
          <p className="valencia-punchline">{tr("Valencia ya pone el sitio. Tú pon el primer hola.")}</p>
          <p className="valencia-languages">{tr("«¿Te vienes?» «T’apuntes?» Lo importante es que alguien diga que sí.")}</p>
          <Button asChild variant="link" className="life-link"><a href={localPath(locale, "register")}>{tr("Hacerme un sitio en Valencia")}<ArrowUpRight aria-hidden="true" /></a></Button>
        </div>
      </div>
      <div className="section-inner local-scenes-wrap">
        <p className="local-scenes-intro">{tr("Cuatro sitios. Un «¿te vienes?».")}</p>
        <ul className="local-scenes" aria-label={tr("Ideas de planes en Valencia")}>
          {localScenes.map(({ label, title, text }, index) => (
            <li key={label} data-reveal="rise" data-reveal-delay={index * 70}>
              <p className="local-scene-place"><MapPin aria-hidden="true" />{tr(label)}</p>
              <h3>{tr(title)}</h3>
              <p className="local-scene-copy">{tr(text)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
