import type { TutorImage } from "./ai";

// Turns whatever the user picks (a PDF, a text file or a photo) into what the
// tutor needs: plain text, or a base64 photo. Runs entirely in the browser —
// nothing here ever reaches a server before the user asks the tutor a question.
// No locale is known at this layer, so warnings are written in Spanish; the
// screen that calls this can translate or wrap them if needed.

export const ACCEPT = ".pdf,.txt,.md,image/*";

const MAX_PDF_PAGES = 60;
const MAX_IMAGE_SIDE = 1600;
const IMAGE_QUALITY = 0.85;
const MIN_PDF_TEXT_LENGTH = 20;

export type ExtractResult = { text?: string; images?: TutorImage[]; warning?: string };

export async function extractText(file: File): Promise<ExtractResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return { text: await file.text() };
  }
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return extractPdf(file);
  }
  if (file.type.startsWith("image/")) {
    return extractImage(file);
  }
  return { warning: "Este tipo de archivo no se puede leer todavía. Sube un PDF, un .txt, un .md o una foto." };
}

// pdfjs-dist ships its worker as a static asset; `new URL(..., import.meta.url)`
// lets the bundler (webpack or Turbopack, both used across Next's dev/build
// paths here) emit it and resolve the final URL at build time, which works
// with the static export this site produces. The dynamic import keeps the
// ~1MB pdf.js payload out of every other screen's bundle.
async function extractPdf(file: File): Promise<ExtractResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

  const buffer = await file.arrayBuffer();
  const document = await pdfjs.getDocument({ data: buffer }).promise;
  const pageCount = document.numPages;
  const pagesToRead = Math.min(pageCount, MAX_PDF_PAGES);

  const parts: string[] = [];
  for (let i = 1; i <= pagesToRead; i++) {
    const page = await document.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => ("str" in item ? item.str : "")).join(" ");
    parts.push(pageText);
  }
  const text = parts.join("\n\n").replace(/[ \t]+/g, " ").trim();

  const warnings: string[] = [];
  if (pageCount > MAX_PDF_PAGES) warnings.push(`El PDF tiene ${pageCount} páginas; solo se han leído las primeras ${MAX_PDF_PAGES}.`);
  if (text.length < MIN_PDF_TEXT_LENGTH) warnings.push("No se ha encontrado texto en el PDF (puede ser un documento escaneado). Prueba a subir fotos de las páginas en su lugar.");

  return { text: text.length > 0 ? text : undefined, warning: warnings.length > 0 ? warnings.join(" ") : undefined };
}

async function extractImage(file: File): Promise<ExtractResult> {
  const source = await createImageBitmap(file).catch(() => null);
  if (!source) return { warning: "No se ha podido leer la imagen. Prueba con otro archivo." };

  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    source.close();
    return { warning: "No se ha podido procesar la imagen." };
  }
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
  source.close();

  const dataUrl = canvas.toDataURL("image/jpeg", IMAGE_QUALITY);
  const data = dataUrl.split(",")[1] ?? "";
  if (!data) return { warning: "No se ha podido convertir la imagen." };
  return { images: [{ media_type: "image/jpeg", data }] };
}
