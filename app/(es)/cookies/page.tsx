import { LegalPage } from "@/components/entreclase/legal-page";
import { pageMetadata } from "@/lib/i18n/metadata";
import { legalTitles } from "@/lib/legal/config";
const title = legalTitles.cookies[0] + " — Entreclases";
export const metadata = { ...pageMetadata("es", "cookies"), title, openGraph: { ...pageMetadata("es", "cookies").openGraph, title } };
export default function Page() { return <LegalPage locale="es" kind="cookies"/>; }
