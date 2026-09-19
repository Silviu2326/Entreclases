import { AuthShell } from "@/components/entreclase/auth-shell";
import { AuthForm } from "@/components/entreclase/auth-form";
import { pageMetadata } from "@/lib/i18n/metadata";
export const metadata = pageMetadata("es", "login");
export default function Page() { return <AuthShell locale="es" route="login" mode="login"><AuthForm locale="es" mode="login" /></AuthShell>; }
