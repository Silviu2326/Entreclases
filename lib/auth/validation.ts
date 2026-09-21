// These checks improve form feedback. The database is the authority for
// university membership; an unknown domain is never approved by this module.
const personalDomains = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.es", "outlook.com",
  "outlook.es", "live.com", "live.es", "yahoo.com", "yahoo.es", "icloud.com",
  "me.com", "msn.com", "aol.com", "proton.me", "protonmail.com", "gmx.com",
]);

export function normalizeEmail(value: string) { return value.trim().toLowerCase(); }

export function emailError(value: string, universityOnly = false): string {
  const email = normalizeEmail(value);
  if (!email) return "Escribe tu correo.";
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(email))
    return "Revisa el correo. Parece que falta algo.";
  if (universityOnly && personalDomains.has(email.split("@")[1]))
    return "Usa tu correo universitario o abre el enlace de tu invitación para entrar con el personal.";
  return "";
}

export function passwordError(value: string): string {
  if (value.length < 12) return "Usa al menos 12 caracteres. Una frase que recuerdes sirve.";
  if (value.length > 128) return "La contraseña puede tener hasta 128 caracteres.";
  return "";
}

export function authErrorMessage(error: unknown): string {
  const message = typeof error === "object" && error !== null && "message" in error ? String(error.message) : "";
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (message.includes("UNIVERSE_REGISTRATION_NOT_OPEN")) return "El registro aún no está abierto. Puedes probar la demo mientras preparamos la apertura.";
  if (message.includes("INVITE_INVALID")) return "La invitación no es válida para este correo, ha caducado o ya se ha usado. Pide a quien te invitó que la revise.";
  if (message.includes("UNIVERSE_UNIVERSITY_REQUIRED") || code === "23514")
    return "Este correo no pertenece a una universidad con acceso abierto. Si tienes una invitación, abre su enlace.";
  const messages: Record<string, string> = {
    invalid_credentials: "El correo o la contraseña no coinciden. Revisa ambos.",
    email_not_confirmed: "Primero confirma tu correo. Puedes pedir otro enlace abajo.",
    weak_password: "Prueba una contraseña más larga y difícil de adivinar.",
    same_password: "Elige una contraseña distinta de la anterior.",
    over_email_send_rate_limit: "Ya has pedido un correo hace poco. Espera un minuto y vuelve a intentarlo.",
    over_request_rate_limit: "Demasiados intentos seguidos. Espera unos minutos.",
    otp_expired: "Este enlace ha caducado o ya se ha usado. Pide uno nuevo.",
    bad_code_verifier: "Abre el enlace en el navegador donde lo pediste, o solicita otro.",
    flow_state_not_found: "El enlace ya no es válido. Pide uno nuevo desde aquí.",
    not_configured: "Las cuentas todavía no están activas. Vuelve cuando abramos el acceso.",
    university_required: "Tu universidad todavía no tiene acceso abierto.",
    signup_disabled: "El registro todavía no está abierto. Vuelve un poco más adelante.",
    email_address_not_authorized: "Todavía no podemos enviar correos a esta dirección. El acceso sigue en preparación.",
    hook_payload_over_size_limit: "No hemos podido comprobar tu universidad. Inténtalo más tarde.",
  };
  return messages[code] ?? "No hemos podido completar este paso. Revisa tu conexión y vuelve a intentarlo.";
}

export type EmailAction = { tokenHash: string; type: "email" | "recovery" } | { code: string };

export function parseEmailAction(search: string, hash: string, purpose: "email" | "recovery"): EmailAction | null {
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const query = new URLSearchParams(search);
  if (fragment.has("error") || query.has("error")) return null;
  const tokenHash = fragment.get("token_hash");
  if (tokenHash && /^[a-f0-9]{32,128}$/i.test(tokenHash) && fragment.get("type") === purpose)
    return { tokenHash, type: purpose };
  const code = query.get("code");
  if (code && code.length <= 512 && /^[a-zA-Z0-9_-]+$/.test(code)) return { code };
  return null;
}
