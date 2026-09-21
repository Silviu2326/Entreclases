import { LegalPage } from "@/components/entreclase/legal-page";
import { pageMetadata } from "@/lib/i18n/metadata";
import { legalTitles } from "@/lib/legal/config";
const title = legalTitles.community[1] + " — Entreclases";
export const metadata = { ...pageMetadata("va", "community"), title, openGraph: { ...pageMetadata("va", "community").openGraph, title } };
export default function Page() { return <LegalPage locale="va" kind="community"/>; }
