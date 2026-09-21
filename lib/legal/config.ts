// Public contact and document version; no private operator data in this module.
export const LEGAL_VERSION = "2026-09-21";
export const LEGAL_CONTACT = "hola@entreclases.com";
export const MINIMUM_AGE = 18;
export const legalTitles = {
 legal: ["Aviso legal", "Avís legal"],
 terms: ["Condiciones de uso", "Condicions d’ús"],
 privacy: ["Política de privacidad", "Política de privacitat"],
 cookies: ["Cookies y almacenamiento local", "Cookies i emmagatzematge local"],
 community: ["Normas de la comunidad", "Normes de la comunitat"],
 rights: ["Tus datos y tu cuenta", "Les teues dades i el teu compte"],
 reports: ["Denunciar contenido", "Denunciar contingut"],
} as const;
export type LegalKind = keyof typeof legalTitles;
