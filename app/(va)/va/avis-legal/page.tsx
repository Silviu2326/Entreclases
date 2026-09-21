import { LegalPage } from "@/components/entreclase/legal-page";
import { pageMetadata } from "@/lib/i18n/metadata";
import { legalTitles } from "@/lib/legal/config";
const title = legalTitles.legal[1] + " — Entreclases";
export const metadata = { ...pageMetadata("va", "legal"), title, openGraph: { ...pageMetadata("va", "legal").openGraph, title } };
export default function Page() { return <LegalPage locale="va" kind="legal"/>; }
