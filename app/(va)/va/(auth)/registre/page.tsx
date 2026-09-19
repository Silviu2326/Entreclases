import { AuthShell } from "@/components/entreclase/auth-shell";
import { AuthForm } from "@/components/entreclase/auth-form";
import { pageMetadata } from "@/lib/i18n/metadata";
export const metadata = pageMetadata("va", "register");
export default function Page() { return <AuthShell locale="va" route="register" mode="register"><AuthForm locale="va" mode="register" /></AuthShell>; }
