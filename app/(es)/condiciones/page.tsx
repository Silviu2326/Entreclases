import { LegalPage } from "@/components/entreclase/legal-page";
import { pageMetadata } from "@/lib/i18n/metadata";
export const metadata = {...pageMetadata("es","terms"), title: "Condiciones de uso — Entreclases"};
export default function Page() { return <LegalPage locale="es" kind="terms"/>; }
