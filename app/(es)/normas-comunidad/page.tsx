import { LegalPage } from "@/components/entreclase/legal-page";
import { pageMetadata } from "@/lib/i18n/metadata";
import { legalTitles } from "@/lib/legal/config";
const title = legalTitles.community[0] + " — Entreclases";
export const metadata = { ...pageMetadata("es", "community"), title, openGraph: { ...pageMetadata("es", "community").openGraph, title } };
export default function Page() { return <LegalPage locale="es" kind="community"/>; }
