"use client";

import Link from "next/link";
import { createTranslator, localHref, type Locale } from "@/lib/i18n";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff, LoaderCircle, ArrowUpRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { authConfigured } from "@/lib/auth/config";

export function OpeningNotice({ locale = "es" }: { locale?: Locale }) {
 const tr=createTranslator(locale);
  if (authConfigured) return null;
  return <div className="auth-opening"><Info aria-hidden="true" /><p>{tr("Estamos preparando la apertura. Puedes ver cómo será el acceso; todavía no se crean cuentas.")} <Link className="auth-demo-link" href={localHref(locale,"/demo/")}>{tr("Dar una vuelta por dentro")}</Link></p></div>;
}

export function AuthField({ locale = "es", label, error, hint, ...props }: ComponentProps<typeof Input> & { locale?: Locale; label: string; error?: string; hint?: string }) {
 const tr=createTranslator(locale);
  const hintId = `${props.id}-hint`;
  const errorId = `${props.id}-error`;
  return <Field className="auth-field" data-invalid={!!error}><FieldLabel htmlFor={props.id}>{tr(label)}</FieldLabel><Input {...props} className={`auth-input ${props.className ?? ""}`} aria-invalid={!!error} aria-describedby={error ? errorId : hint ? hintId : undefined} />{error ? <p className="auth-field-error" id={errorId}>{tr(error)}</p> : hint ? <p className="auth-field-hint" id={hintId}>{tr(hint)}</p> : null}</Field>;
}

export function PasswordField({ locale = "es", id = "password", label = "Contraseña", error, hint, ...props }: ComponentProps<typeof Input> & { locale?: Locale; label?: string; error?: string; hint?: string }) {
 const tr=createTranslator(locale);
  const [visible, setVisible] = useState(false);
  return <Field className="auth-field" data-invalid={!!error}><FieldLabel htmlFor={id}>{tr(label)}</FieldLabel><div className="auth-password"><Input {...props} id={id} name={props.name ?? id} type={visible ? "text" : "password"} className="auth-input" maxLength={128} aria-invalid={!!error} aria-describedby={error || hint ? `${id}-help` : undefined} /><Button type="button" variant="ghost" size="icon" className="password-toggle" aria-label={visible ? tr("Ocultar contraseña") : tr("Mostrar contraseña")} aria-pressed={visible} onClick={() => setVisible((value) => !value)}>{visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</Button></div>{error || hint ? <p className={error ? "auth-field-error" : "auth-field-hint"} id={`${id}-help`}>{tr(error || hint || "")}</p> : null}</Field>;
}

export function SubmitButton({ locale = "es", pending, children }: { locale?: Locale; pending: boolean; children: React.ReactNode }) {
 const tr=createTranslator(locale);
  return <Button type="submit" className="entreclase-button auth-submit" disabled={pending} aria-busy={pending}>{pending ? <>{tr("Un momento")}<LoaderCircle aria-hidden="true" className="auth-spinner" /></> : <>{children}<ArrowUpRight aria-hidden="true" /></>}</Button>;
}

export function AuthError({ locale = "es", message }: { locale?: Locale; message: string }) {
 const tr=createTranslator(locale);
  return message ? <p className="auth-error" role="alert">{tr(message)}</p> : null;
}
