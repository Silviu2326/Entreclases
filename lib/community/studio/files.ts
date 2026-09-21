// Files the team passes around. Nothing is opened or transformed in the browser:
// the file travels as it is, and its type and size are checked before it leaves
// the device, again by the bucket and once more by the database.
export const fileLimits = { size: 20 * 1024 * 1024, perProject: 60, name: 160, note: 300 } as const;

/** What a project can hold, and the extension each one is stored under. */
export const fileTypes: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
  "text/plain": "txt", "text/markdown": "md", "text/csv": "csv",
  "application/zip": "zip", "application/x-zip-compressed": "zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};
export const fileAccept = Object.keys(fileTypes).join(",");
// <project>/<who uploaded>/<file>.<ext>, so a storage rule can read the project
// from the path itself without opening any row.
export const filePattern = /^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.[a-z0-9]{1,8}$/;

export function checkProjectFile(file: File) {
  if (!file || !fileTypes[file.type] || file.size > fileLimits.size || file.size < 1) throw { code: "invalid_file" };
}

/** The name kept for the download: the person's own, with anything that could travel as a path removed. */
export function safeFileName(file: File) {
  const clean = file.name.replace(/[\\/\u0000-\u001f]/g, "-").trim();
  return (clean || "archivo").slice(0, fileLimits.name);
}

export const fileExtension = (type: string) => fileTypes[type] ?? "bin";
export function humanSize(bytes: number, locale: string) {
  const mega = bytes / (1024 * 1024);
  if (mega >= 1) return `${new Intl.NumberFormat(locale === "va" ? "ca-ES" : "es-ES", { maximumFractionDigits: 1 }).format(mega)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
