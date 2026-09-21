import { LEGAL_VERSION } from "./config";
import type { Locale } from "../i18n/routes";

// These declarations accompany signup. Auth metadata is user-editable and is
// not an immutable legal audit trail or documentary proof of age.
export function registrationLegalIssues(values: FormData, locale: Locale): Record<string, string> {
 const issues: Record<string, string> = {};
 if (values.get("termsAccepted") !== "on") issues.termsAccepted = locale === "va" ? "Has d’acceptar les condicions d’ús per a crear el compte." : "Debes aceptar las condiciones de uso para crear tu cuenta.";
 if (values.get("adultDeclared") !== "on") issues.adultDeclared = locale === "va" ? "L’accés està reservat a persones de 18 anys o més." : "El acceso está reservado a personas de 18 años o más.";
 return issues;
}
export function registrationLegalMetadata() {
 return { terms_version: LEGAL_VERSION, privacy_notice_version: LEGAL_VERSION, adult_declaration: true };
}
