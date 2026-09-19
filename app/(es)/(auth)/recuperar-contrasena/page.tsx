import { AuthShell } from "@/components/entreclase/auth-shell";
import { AuthForm } from "@/components/entreclase/auth-form";
import { pageMetadata } from "@/lib/i18n/metadata";
export const metadata = pageMetadata("es", "recovery");
export default function Page() { return <AuthShell locale="es" route="recovery" mode="recovery"><AuthForm locale="es" mode="recovery" /></AuthShell>; }
