"use client";

import { ArrowUpRight, Sparkles } from "lucide-react";
import { useCommunity } from "./context";
import "./studio.css";

/**
 * Proyectos permanece visible como una promesa de Explorar, pero todavía no
 * abre una superficie de trabajo. Cuando esté listo, este bloque será la
 * entrada a las fichas y a las solicitudes de colaboración.
 */
export function ProjectTeaser() {
  const { locale } = useCommunity();
  const va = locale === "va";

  return <section className="st-projects st-projects-soon" id="proyectos" aria-labelledby="projects-title">
    <header className="st-heading">
      <div>
        <p className="st-kicker">{va ? "MÉS ENDAVANT" : "MÁS ADELANTE"}</p>
        <h2 id="projects-title">{va ? "Projectes per fer coses junts." : "Proyectos para hacer cosas juntos."}</h2>
        <p>{va ? "Estem preparant un espai on una bona idea puga trobar les mans que li falten." : "Estamos preparando un espacio donde una buena idea pueda encontrar las manos que le faltan."}</p>
      </div>
      <span className="st-text-action" aria-hidden="true">{va ? "Pròximament" : "Próximamente"}<ArrowUpRight /></span>
    </header>
    <div className="st-empty st-projects-coming-soon" role="status">
      <span className="st-projects-coming-icon" aria-hidden="true"><Sparkles /></span>
      <div>
        <strong>{va ? "Encara no obrim esta porta." : "Todavía no abrimos esta puerta."}</strong>
        <p>{va ? "Primer volem fer bé la resta. Quan arribe, podràs sumar-te a idees reals, amb rols clars i un primer resultat." : "Primero queremos hacer bien lo demás. Cuando llegue, podrás sumarte a ideas reales, con roles claros y un primer resultado."}</p>
      </div>
      <span className="st-stamp">{va ? "PRÒXIMAMENT" : "PRÓXIMAMENTE"}</span>
    </div>
  </section>;
}
