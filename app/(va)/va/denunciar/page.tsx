import { LegalPage } from "@/components/entreclase/legal-page";
import { pageMetadata } from "@/lib/i18n/metadata";
import { legalTitles } from "@/lib/legal/config";
const title = legalTitles.reports[1] + " — Entreclases";
export const metadata = { ...pageMetadata("va", "reports"), title, openGraph: { ...pageMetadata("va", "reports").openGraph, title } };
export default function Page() { return <LegalPage locale="va" kind="reports"/>; }
