// Profile photo and banner. The browser crops and shrinks the picture before it
// leaves the device: what travels is always a small webp of a known size, never
// the original file from the camera roll.
export type FaceKind = "avatar" | "banner";

export const faceLimits = { source: 12 * 1024 * 1024, output: 1024 * 1024 } as const;
export const faceSize: Record<FaceKind, { width: number; height: number }> = {
  avatar: { width: 320, height: 320 },
  banner: { width: 1280, height: 420 },
};
export const faceTypes = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
export const facePattern = /^[a-f0-9-]{36}\/(avatar|banner)-\d{1,14}\.webp$/;
// Anything starting with a slash is a file shipped with the app (the demo
// avatars); everything else is a path inside the private storage bucket.
export const isStoredFace = (value?: string) => !!value && !value.startsWith("/") && !value.startsWith("blob:") && !value.startsWith("data:");

export function checkFaceFile(file: File) {
  if (!file || !faceTypes.includes(file.type) || file.size > faceLimits.source || file.size < 64) throw { code: "invalid_image" };
}

// Cover crop: fill the frame, keep the centre, never stretch.
export async function prepareFace(kind: FaceKind, file: File): Promise<Blob> {
  checkFaceFile(file);
  const { width, height } = faceSize[kind];
  const source = await createImageBitmap(file).catch(() => { throw { code: "invalid_image" }; });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw { code: "invalid_image" };
  const scale = Math.max(width / source.width, height / source.height);
  const drawn = { width: source.width * scale, height: source.height * scale };
  context.imageSmoothingQuality = "high";
  context.drawImage(source, (width - drawn.width) / 2, (height - drawn.height) / 2, drawn.width, drawn.height);
  source.close();
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", 0.82));
  if (!blob || blob.size > faceLimits.output) throw { code: "invalid_image" };
  return blob;
}
