import { LegalPage } from "@/components/entreclase/legal-page";
import { pageMetadata } from "@/lib/i18n/metadata";
import { legalTitles } from "@/lib/legal/config";
const title = legalTitles.terms[0] + " — Entreclases";
export const metadata = { ...pageMetadata("es", "terms"), title, openGraph: { ...pageMetadata("es", "terms").openGraph, title } };
export default function Page() { return <LegalPage locale="es" kind="terms"/>; }
