import { AuthShell } from "@/components/entreclase/auth-shell";
import { EmailVerification } from "@/components/entreclase/email-verification";
import { pageMetadata } from "@/lib/i18n/metadata";
export const metadata = pageMetadata("va", "verify");
export default function Page() { return <AuthShell locale="va" route="verify" mode="register"><EmailVerification locale="va" /></AuthShell>; }
