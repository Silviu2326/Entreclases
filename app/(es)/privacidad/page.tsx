import { LegalPage } from "@/components/entreclase/legal-page";
import { pageMetadata } from "@/lib/i18n/metadata";
export const metadata = {...pageMetadata("es","privacy"), title: "Privacidad — Entreclases"};
export default function Page() { return <LegalPage locale="es" kind="privacy"/>; }
