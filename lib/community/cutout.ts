import { checkFaceFile } from "./images";
import { stickerLimits } from "./space";

// Cuts the background out of a picture without a model: whatever touches the
// edges and is close in colour to the edge it touches goes transparent. It is
// the right tool for a drawing on paper or a thing on a plain wall, and it says
// nothing about a face in a crowd. Pure, so it is tested with a made-up image.
export function removeBackground(data: Uint8ClampedArray, width: number, height: number, tolerance = 32) {
  const seen = new Uint8Array(width * height), stack: number[] = [], tol2 = tolerance * tolerance;
  const midX = Math.floor(width / 2), midY = Math.floor(height / 2);
  const seeds = [0, width - 1, (height - 1) * width, width * height - 1, midX, (height - 1) * width + midX, midY * width, midY * width + width - 1];
  let removed = 0;
  for (const seed of seeds) {
    if (seen[seed]) continue;
    const r = data[seed * 4], g = data[seed * 4 + 1], b = data[seed * 4 + 2];
    stack.push(seed);
    while (stack.length) {
      const i = stack.pop() as number;
      if (seen[i]) continue;
      const o = i * 4, dr = data[o] - r, dg = data[o + 1] - g, db = data[o + 2] - b;
      if (dr * dr + dg * dg + db * db > tol2) continue;
      seen[i] = 1; data[o + 3] = 0; removed++;
      const x = i % width, y = (i - x) / width;
      if (x > 0) stack.push(i - 1); if (x < width - 1) stack.push(i + 1); if (y > 0) stack.push(i - width); if (y < height - 1) stack.push(i + width);
    }
  }
  // One pixel of feather: a kept pixel touching the cut goes half transparent,
  // so the edge does not read as a saw.
  for (let i = 0; i < width * height; i++) {
    if (seen[i]) continue;
    const x = i % width, y = (i - x) / width;
    if ((x > 0 && seen[i - 1]) || (x < width - 1 && seen[i + 1]) || (y > 0 && seen[i - width]) || (y < height - 1 && seen[i + width])) data[i * 4 + 3] = Math.min(data[i * 4 + 3], 150);
  }
  return removed;
}

// Browser only: shrink to the sticker size, keep the whole picture, cut if asked.
export async function prepareSticker(file: File, cutout: boolean, tolerance: number): Promise<Blob> {
  checkFaceFile(file);
  const source = await createImageBitmap(file).catch(() => { throw { code: "invalid_image" }; });
  const ratio = Math.min(1, stickerLimits.size / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * ratio)), height = Math.max(1, Math.round(source.height * ratio));
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw { code: "invalid_image" };
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
  source.close();
  if (cutout) { const image = context.getImageData(0, 0, width, height); removeBackground(image.data, width, height, tolerance); context.putImageData(image, 0, 0); }
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", 0.9));
  if (!blob || blob.size > stickerLimits.output) throw { code: "invalid_image" };
  return blob;
}
