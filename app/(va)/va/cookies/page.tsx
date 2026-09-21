import { LegalPage } from "@/components/entreclase/legal-page";
import { pageMetadata } from "@/lib/i18n/metadata";
import { legalTitles } from "@/lib/legal/config";
const title = legalTitles.cookies[1] + " — Entreclases";
export const metadata = { ...pageMetadata("va", "cookies"), title, openGraph: { ...pageMetadata("va", "cookies").openGraph, title } };
export default function Page() { return <LegalPage locale="va" kind="cookies"/>; }
