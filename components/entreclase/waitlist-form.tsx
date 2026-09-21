"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTranslator } from "@/lib/i18n";
import { localPath, type Locale } from "@/lib/i18n/routes";
import { emailError, isPersonalDomain, normalizeEmail } from "@/lib/auth/validation";
import { joinWaitlist, waitlistMailto, type WaitlistSource } from "@/lib/launch/waitlist";

type Status = "idle" | "sending" | "saved" | "unavailable" | "failed";

export function WaitlistForm({ locale = "es", source = "landing" }: { locale?: Locale; source?: WaitlistSource }) {
 const va = locale === "va", t = (es: string, translated: string) => (va ? translated : es);
 const tr = createTranslator(locale);
 const field = useId();
 const input = useRef<HTMLInputElement>(null);
 const [email, setEmail] = useState("");
 const [hint, setHint] = useState("");
 const [status, setStatus] = useState<Status>("idle");
 const personal = email.includes("@") && isPersonalDomain(email) && !emailError(email);

 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (status === "sending") return;
  const value = normalizeEmail(email);
  // The list takes any working address; the university rule is checked at the
  // door, on the opening day, by the database.
  const problem = emailError(value);
  if (problem) { setHint(tr(problem)); input.current?.focus(); return; }
  setHint(""); setStatus("sending");
  setStatus(await joinWaitlist(value, locale, source));
 }

 if (status === "saved") return <div className="waitlist-done" role="status">
  <MailCheck aria-hidden="true" />
  <div>
   <strong>{t("Apuntado. Tienes sitio guardado.", "Apuntat. Tens lloc guardat.")}</strong>
   <p>{t("Te escribimos cuando abramos. Un correo, no una newsletter.", "T’escrivim quan obrim. Un correu, no una newsletter.")}</p>
   {isPersonalDomain(email) && <p className="waitlist-warning">{t("Ese correo no es universitario: el día de la apertura hará falta el de tu uni o una invitación de alguien que ya esté dentro.", "Eixe correu no és universitari: el dia de l’obertura caldrà el de la teua uni o una invitació d’algú que ja estiga dins.")}</p>}
  </div>
 </div>;

 return <form className="waitlist-form" onSubmit={submit} noValidate>
  <div className="waitlist-fields">
   <label htmlFor={field} className="sr-only">{t("Tu correo", "El teu correu")}</label>
   <Input ref={input} id={field} name="email" type="email" inputMode="email" autoComplete="email"
    autoCapitalize="none" spellCheck={false} required maxLength={254} value={email}
    onChange={(event) => { setEmail(event.target.value); setHint(""); if (status !== "sending") setStatus("idle"); }}
    aria-invalid={Boolean(hint)} aria-describedby={hint ? `${field}-hint` : undefined}
    placeholder={t("tucorreo@alumni.uv.es", "elteucorreu@alumni.uv.es")} className="entreclase-input" />
   <Button type="submit" className="entreclase-button waitlist-button" disabled={status === "sending"} aria-busy={status === "sending"}>
    {status === "sending" ? t("Guardando", "Guardant") : t("Reservar mi sitio", "Reservar el meu lloc")}
    <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
   </Button>
  </div>
  {hint && <p id={`${field}-hint`} className="form-error" role="alert">{hint}</p>}
  {personal && !hint && <p className="waitlist-warning" role="status">{t("Vale, lo apuntamos. Para entrar el día de la apertura hará falta un correo universitario o una invitación.", "Val, ho apuntem. Per a entrar el dia de l’obertura caldrà un correu universitari o una invitació.")}</p>}
  {status === "unavailable" && <p className="form-error" role="alert">{t("La lista automática todavía no está conectada.", "La llista automàtica encara no està connectada.")}{" "}<a href={waitlistMailto(email, locale)}>{t("Apúntame por correo", "Apunteu-me per correu")}</a>.</p>}
  {status === "failed" && <p className="form-error" role="alert">{t("No hemos podido guardarlo. Inténtalo otra vez en un momento.", "No hem pogut guardar-ho. Torna a provar-ho en un moment.")}</p>}
  <p className="form-notice">
   {t("Correo universitario o personal. Solo lo usamos para avisarte de la apertura y puedes pedir que lo borremos.", "Correu universitari o personal. Només l’usem per a avisar-te de l’obertura i pots demanar que l’esborrem.")}{" "}
   <Link href={localPath(locale, "privacy")}>{t("Privacidad", "Privacitat")}</Link>
  </p>
 </form>;
}
