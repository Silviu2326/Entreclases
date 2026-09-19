import { AuthShell } from "@/components/entreclase/auth-shell";
import { EmailVerification } from "@/components/entreclase/email-verification";
import { pageMetadata } from "@/lib/i18n/metadata";
export const metadata = pageMetadata("va", "reset");
export default function Page() { return <AuthShell locale="va" route="reset" mode="recovery"><EmailVerification locale="va" recovery /></AuthShell>; }
