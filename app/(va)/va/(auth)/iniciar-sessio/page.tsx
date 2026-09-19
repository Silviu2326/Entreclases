import { AuthShell } from "@/components/entreclase/auth-shell";
import { AuthForm } from "@/components/entreclase/auth-form";
import { pageMetadata } from "@/lib/i18n/metadata";
export const metadata = pageMetadata("va", "login");
export default function Page() { return <AuthShell locale="va" route="login" mode="login"><AuthForm locale="va" mode="login" /></AuthShell>; }
