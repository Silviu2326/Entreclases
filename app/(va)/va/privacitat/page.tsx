import { LegalPage } from "@/components/entreclase/legal-page";
import { pageMetadata } from "@/lib/i18n/metadata";
export const metadata = {...pageMetadata("va","privacy"), title: "Privacitat — Entreclases"};
export default function Page() { return <LegalPage locale="va" kind="privacy"/>; }
