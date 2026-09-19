import { AuthShell } from "@/components/entreclase/auth-shell";
import { AuthForm } from "@/components/entreclase/auth-form";
import { pageMetadata } from "@/lib/i18n/metadata";
export const metadata = pageMetadata("es", "register");
export default function Page() { return <AuthShell locale="es" route="register" mode="register"><AuthForm locale="es" mode="register" /></AuthShell>; }
