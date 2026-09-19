"use client";

import { createTranslator, localHref, type Locale } from "@/lib/i18n";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { emailError, normalizeEmail } from "@/lib/auth/validation";

export function SignupForm({ locale = "es" }: { locale?: Locale }) {
  const tr = createTranslator(locale);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = normalizeEmail(email);
    const nextError = emailError(value, true);
    setError(nextError);
    if (nextError) { inputRef.current?.focus(); return; }
    try { sessionStorage.setItem("entreclase.signup.email", value); } catch { /* Optional form draft. */ }
    router.push(localHref(locale, "/registro/"));
  }

  return (
    <form method="post" className="signup-form" onSubmit={submit} noValidate>
      <FieldGroup className="signup-fields">
        <Field data-invalid={Boolean(error)} className="email-field">
          <FieldLabel htmlFor="university-email" className="sr-only">{tr("Tu correo universitario")}</FieldLabel>
          <Input ref={inputRef} id="university-email" name="email" type="email" inputMode="email"
            autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254}
            value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "email-error" : undefined}
            placeholder={tr("Tu correo universitario")} className="entreclase-input" />
        </Field>
        <Button type="submit" className="entreclase-button signup-button">{tr("Crear mi cuenta")}{" "}<ArrowUpRight data-icon="inline-end" />
        </Button>
      </FieldGroup>
      {error ? <p id="email-error" className="form-error" role="alert">{tr(error)}</p> : null}
      <p className="form-notice">{tr("¿Ya tienes cuenta?")}{" "}<Link href={localHref(locale, "/login/")} className="signup-login-link">{tr("Entra por aquí.")}</Link></p>
      <noscript><p className="form-notice"><a href={localHref(locale, "/registro/")}>{tr("Ir al registro de Entreclase")}</a></p></noscript>
    </form>
  );
}
