import { AuthShell } from "@/components/entreclase/auth-shell";
import { AccountPanel } from "@/components/entreclase/account-panel";
import { pageMetadata } from "@/lib/i18n/metadata";
export const metadata = pageMetadata("va", "account");
export default function Page() { return <AuthShell locale="va" route="account" mode="login"><AccountPanel locale="va" /></AuthShell>; }
