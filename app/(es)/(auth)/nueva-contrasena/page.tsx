import { AuthShell } from "@/components/entreclase/auth-shell";
import { EmailVerification } from "@/components/entreclase/email-verification";
import { pageMetadata } from "@/lib/i18n/metadata";
export const metadata = pageMetadata("es", "reset");
export default function Page() { return <AuthShell locale="es" route="reset" mode="recovery"><EmailVerification locale="es" recovery /></AuthShell>; }
