import { AuthShell } from "@/components/entreclase/auth-shell";
import { AuthForm } from "@/components/entreclase/auth-form";
import { pageMetadata } from "@/lib/i18n/metadata";
export const metadata = pageMetadata("va", "recovery");
export default function Page() { return <AuthShell locale="va" route="recovery" mode="recovery"><AuthForm locale="va" mode="recovery" /></AuthShell>; }
