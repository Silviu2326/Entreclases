import Link from "next/link";
import { localPath, type Locale } from "@/lib/i18n/routes";
import { LEGAL_CONTACT, legalTitles, type LegalKind } from "@/lib/legal/config";
export function LegalLinks({ locale }: { locale: Locale }) {
 return <nav className="legal-links" aria-label={locale === "va" ? "Informació legal" : "Información legal"}>
  {(Object.keys(legalTitles) as LegalKind[]).map(kind => <Link key={kind} href={localPath(locale, kind)}>{legalTitles[kind][locale === "va" ? 1 : 0]}</Link>)}
  <a href={`mailto:${LEGAL_CONTACT}`}>{locale === "va" ? "Contacte" : "Contacto"}</a>
 </nav>;
}
