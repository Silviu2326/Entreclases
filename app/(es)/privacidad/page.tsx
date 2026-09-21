import { LegalPage } from "@/components/entreclase/legal-page";
import { pageMetadata } from "@/lib/i18n/metadata";
import { legalTitles } from "@/lib/legal/config";
const title = legalTitles.privacy[0] + " — Entreclases";
export const metadata = { ...pageMetadata("es", "privacy"), title, openGraph: { ...pageMetadata("es", "privacy").openGraph, title } };
export default function Page() { return <LegalPage locale="es" kind="privacy"/>; }
