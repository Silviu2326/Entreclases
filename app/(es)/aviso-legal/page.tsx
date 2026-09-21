import { LegalPage } from "@/components/entreclase/legal-page";
import { pageMetadata } from "@/lib/i18n/metadata";
import { legalTitles } from "@/lib/legal/config";
const title = legalTitles.legal[0] + " — Entreclases";
export const metadata = { ...pageMetadata("es", "legal"), title, openGraph: { ...pageMetadata("es", "legal").openGraph, title } };
export default function Page() { return <LegalPage locale="es" kind="legal"/>; }
