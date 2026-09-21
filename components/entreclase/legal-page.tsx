import Link from "next/link";
import { localPath, type Locale } from "@/lib/i18n/routes";
import { legalSections } from "@/lib/legal/content";
import { LEGAL_CONTACT, LEGAL_VERSION, legalTitles, type LegalKind } from "@/lib/legal/config";
import { LegalLinks } from "./legal-links";

export function LegalPage({ locale, kind }: { locale: Locale; kind: LegalKind }) {
 const va = locale === "va", t = (es: string, translated: string) => va ? translated : es;
 const sections = legalSections(kind, locale);
 const fields = [
  [t("Nombre o razón social", "Nom o raó social"), process.env.LEGAL_CONTROLLER_NAME],
  ["NIF / CIF", process.env.LEGAL_CONTROLLER_TAX_ID],
  [t("Domicilio de contacto", "Domicili de contacte"), process.env.LEGAL_CONTROLLER_ADDRESS],
  [t("Registro público, si corresponde", "Registre públic, si correspon"), process.env.LEGAL_CONTROLLER_REGISTRY],
 ];
 const pending = fields.some(([, value]) => !value?.trim()) || !process.env.LEGAL_PROVIDER_DETAILS?.trim() || !process.env.LEGAL_RETENTION_DETAILS?.trim() || process.env.LEGAL_REVIEW_COMPLETED !== "true";
 const subject = kind === "reports" ? t("Denuncia de contenido", "Denúncia de contingut") : t("Solicitud sobre mis datos y mi cuenta", "Sol·licitud sobre les meues dades i el meu compte");
 const body = kind === "reports"
  ? t("Ubicación exacta del contenido:\n\nHechos y motivo de la denuncia:\n\nNombre y correo de contacto (salvo excepción legal):\n\nConfirmo de buena fe que la información y las alegaciones son precisas y completas.", "Ubicació exacta del contingut:\n\nFets i motiu de la denúncia:\n\nNom i correu de contacte (excepte excepció legal):\n\nConfirme de bona fe que la informació i les al·legacions són precises i completes.")
  : t("Correo o identificador de mi cuenta:\n\nSolicitud (acceso, rectificación, supresión, baja, oposición, limitación, portabilidad o retirada del consentimiento):\n\nDetalles:\n", "Correu o identificador del meu compte:\n\nSol·licitud (accés, rectificació, supressió, baixa, oposició, limitació, portabilitat o retirada del consentiment):\n\nDetalls:\n");
 return <main className="legal-page">
  <header className="legal-header"><Link href={localPath(locale, "home")}>← Entreclases</Link><Link href={localPath(va ? "es" : "va", kind)} hrefLang={va ? "es" : "ca"}>{va ? "Castellano" : "Valencià"}</Link></header>
  <p className="legal-kicker">{t("Información legal", "Informació legal")}</p>
  <h1>{legalTitles[kind][va ? 1 : 0]}</h1>
  <p className="legal-version">{t("Versión", "Versió")} {LEGAL_VERSION} · {t("Puedes guardar o imprimir esta página desde tu navegador.", "Pots guardar o imprimir esta pàgina des del navegador.")}</p>
  {pending && <aside className="legal-draft" aria-label={t("Estado del documento", "Estat del document")}><strong>{t("Borrador preparado · pendiente de completar y validar", "Esborrany preparat · pendent de completar i validar")}</strong><p>{t("Falta confirmar la identificación del titular, proveedores, conservación y la aplicación efectiva de estas reglas. Esta versión no debe presentarse como documentación legal definitiva.", "Falta confirmar la identificació del titular, proveïdors, conservació i l’aplicació efectiva d’estes regles. Esta versió no s’ha de presentar com a documentació legal definitiva.")}</p></aside>}
  <nav className="legal-index" aria-label={t("En esta página", "En esta pàgina")}><strong>{t("En esta página", "En esta pàgina")}</strong><ol>{sections.map(s => <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>)}</ol></nav>
  {(kind === "legal" || kind === "privacy") && <section className="legal-identity" aria-labelledby="operator-title"><h2 id="operator-title">{t("Datos del titular", "Dades del titular")}</h2><dl>{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value?.trim() || t("Pendiente de facilitar por el titular", "Pendent de facilitar pel titular")}</dd></div>)}<div><dt>{t("Contacto", "Contacte")}</dt><dd><a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a></dd></div>{process.env.LEGAL_DPO_CONTACT?.trim() && <div><dt>{t("Delegado de protección de datos", "Delegat de protecció de dades")}</dt><dd>{process.env.LEGAL_DPO_CONTACT.trim()}</dd></div>}</dl></section>}
  {sections.map(s => <section id={s.id} key={s.id}><h2>{s.title}</h2>{s.paragraphs.map((p, i) => <p key={i}>{p}</p>)}{s.bullets.length > 0 && <ul>{s.bullets.map((p, i) => <li key={i}>{p}</li>)}</ul>}
   {kind === "privacy" && s.id === "proveedores" && <p className="legal-configuration">{process.env.LEGAL_PROVIDER_DETAILS?.trim() || t("Ficha efectiva de proveedores y garantías: pendiente de confirmar por el titular.", "Fitxa efectiva de proveïdors i garanties: pendent de confirmar pel titular.")}</p>}
   {kind === "privacy" && s.id === "conservacion" && <p className="legal-configuration">{process.env.LEGAL_RETENTION_DETAILS?.trim() || t("Plazos del entorno, copias y procedimiento de eliminación: pendientes de confirmar por el titular.", "Terminis de l’entorn, còpies i procediment d’eliminació: pendents de confirmar pel titular.")}</p>}
  </section>)}
  {(kind === "rights" || kind === "reports") && <aside className="legal-contact"><a className="legal-mail-action" href={`mailto:${LEGAL_CONTACT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}>{t("Preparar correo", "Preparar correu")}</a><p>{t("Se abrirá tu aplicación de correo. Revisa y envía el mensaje; este botón no lo envía por ti. También puedes escribir directamente a", "S’obrirà la teua aplicació de correu. Revisa i envia el missatge; este botó no l’envia per tu. També pots escriure directament a")} <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>.</p></aside>}
  {(kind === "privacy" || kind === "rights") && <p><a href="https://www.aepd.es/">{t("Agencia Española de Protección de Datos", "Agència Espanyola de Protecció de Dades")}</a></p>}
  <footer className="legal-footer"><h2>{t("Otros documentos y ayuda", "Altres documents i ajuda")}</h2><LegalLinks locale={locale}/></footer>
 </main>;
}
