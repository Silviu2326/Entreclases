import { AuthShell } from "@/components/entreclase/auth-shell";
import { AccountPanel } from "@/components/entreclase/account-panel";
import { pageMetadata } from "@/lib/i18n/metadata";
export const metadata = pageMetadata("es", "account");
export default function Page() { return <AuthShell locale="es" route="account" mode="login"><AccountPanel locale="es" /></AuthShell>; }
