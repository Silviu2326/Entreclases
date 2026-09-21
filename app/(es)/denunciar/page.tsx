import { LegalPage } from "@/components/entreclase/legal-page";
import { pageMetadata } from "@/lib/i18n/metadata";
import { legalTitles } from "@/lib/legal/config";
const title = legalTitles.reports[0] + " — Entreclases";
export const metadata = { ...pageMetadata("es", "reports"), title, openGraph: { ...pageMetadata("es", "reports").openGraph, title } };
export default function Page() { return <LegalPage locale="es" kind="reports"/>; }
