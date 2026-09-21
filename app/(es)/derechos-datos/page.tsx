import { LegalPage } from "@/components/entreclase/legal-page";
import { pageMetadata } from "@/lib/i18n/metadata";
import { legalTitles } from "@/lib/legal/config";
const title = legalTitles.rights[0] + " — Entreclases";
export const metadata = { ...pageMetadata("es", "rights"), title, openGraph: { ...pageMetadata("es", "rights").openGraph, title } };
export default function Page() { return <LegalPage locale="es" kind="rights"/>; }
