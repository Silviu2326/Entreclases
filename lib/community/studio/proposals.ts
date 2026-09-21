import { safeWebUrl, type MagazinePhoto, type Submission, type SubmissionStatus, type StudioInput } from "./types";

export const magazineSections = ["Vida de campus", "Proyectos", "Planes", "Cultura", "Opinión"];
export const proposalStatus = (s: Submission): SubmissionStatus => s.status ?? (!s.consent ? "withdrawn" : s.edition_id ? "published" : "pending");
export const canEditProposal = (s: Submission) => ["draft", "changes_requested", "rejected", "withdrawn"].includes(proposalStatus(s));
export const statusLabel = (status: SubmissionStatus, va = false) => ({
 draft: va ? "Esborrany" : "Borrador", pending: va ? "En revisió" : "En revisión", changes_requested: va ? "Canvis demanats" : "Cambios solicitados", accepted: va ? "Acceptada" : "Aceptada", rejected: va ? "Rebutjada" : "Rechazada", published: va ? "Publicada" : "Publicada", withdrawn: va ? "Retirada" : "Retirada",
})[status];

export function validateProposal(input: StudioInput, sending: boolean) {
 const value = (key: string) => String(input[key] ?? "").trim();
 if (!["story", "project", "plan", "post", "initiative"].includes(value("kind"))) throw Error("Elige el tipo de historia.");
 if (value("title").length > 120 || value("body").length > 8000 || value("summary").length > 240 || value("author_note").length > 1000) throw Error("Revisa la longitud del texto.");
 if (sending && (value("title").length < 3 || value("body").length < 40)) throw Error("Añade un título y al menos 40 caracteres de historia.");
 if (sending && !input.consent) throw Error("Autoriza la versión que vas a enviar.");
 if (!magazineSections.includes(value("section")) || !["classic", "photo", "split"].includes(value("layout"))) throw Error("Elige sección y presentación.");
 if (value("source_url").length > 500 || (value("source_url") && !safeWebUrl(value("source_url")))) throw Error("Revisa el enlace a la fuente.");
 if (sending && value("kind") === "initiative" && !safeWebUrl(value("source_url"))) throw Error("Incluye la fuente de la iniciativa.");
 if (sending && ["project", "plan", "post"].includes(value("kind")) && !value("source_id")) throw Error("Selecciona tu contenido original.");
 if (!Array.isArray(input.images) || input.images.length > 4) throw Error("Puedes incluir hasta cuatro imágenes.");
 for (const photo of input.images as MagazinePhoto[]) {
  if (!photo || typeof photo.path !== "string" || !photo.path || ["alt", "caption", "credit"].some(k => typeof photo[k as keyof MagazinePhoto] !== "string")) throw Error("Revisa las imágenes.");
  if (photo.alt.length > 200 || photo.caption.length > 300 || photo.credit.length > 120) throw Error("Acorta los textos de las imágenes.");
  if (sending && (!photo.alt.trim() || !photo.credit.trim())) throw Error("Cada imagen necesita una descripción y un crédito.");
 }
 if (sending && input.images.length && !input.image_rights) throw Error("Confirma que puedes publicar las imágenes y que tienes los permisos necesarios.");
 if (sending && value("layout") !== "classic" && !input.images.length) throw Error("Añade una imagen para esta presentación o elige Solo texto.");
}
