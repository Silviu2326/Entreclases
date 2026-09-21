import Link from "next/link";
import { localPath, type Locale } from "@/lib/i18n/routes";
export function LegalLinks({locale}:{locale:Locale}) {
 return <nav className="legal-links" aria-label={locale==="va"?"Informació legal":"Información legal"}><Link href={localPath(locale,"privacy")}>{locale==="va"?"Privacitat":"Privacidad"}</Link><Link href={localPath(locale,"terms")}>{locale==="va"?"Condicions d’ús":"Condiciones de uso"}</Link><a href="mailto:hola@entreclases.com">{locale==="va"?"Contacte":"Contacto"}</a></nav>;
}
