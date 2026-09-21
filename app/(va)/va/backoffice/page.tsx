import { BackofficeApp } from "@/components/backoffice/backoffice-app";
import { pageMetadata } from "@/lib/i18n/metadata";

export const metadata = { ...pageMetadata("va", "home"), title: "Backoffice — Entreclases", robots: { index: false, follow: false } };

export default function BackofficePage() { return <BackofficeApp locale="va" />; }
