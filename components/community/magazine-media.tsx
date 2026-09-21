"use client";
import { useEffect, useState } from "react";
import { getAuthClient } from "@/lib/auth/client";
import type { MagazinePhoto } from "@/lib/community/studio/types";

export async function prepareMagazinePhoto(file: File): Promise<string> {
 if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 6 * 1024 * 1024) throw Error("Usa una imagen JPG, PNG o WebP de hasta 6 MB.");
 const bitmap = await createImageBitmap(file);
 try {
  if (bitmap.width * bitmap.height > 40000000) throw Error("La imagen es demasiado grande. Reduce su resolución.");
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas"); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d"); if (!context) throw Error("No se ha podido preparar la imagen.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const data = canvas.toDataURL("image/webp", .82);
  if (!data.startsWith("data:image/webp;") || data.length > 2700000) throw Error("Reduce el tamaño de la imagen e inténtalo de nuevo.");
  return data;
 } finally { bitmap.close(); }
}

export async function uploadMagazinePhotos(images: MagazinePhoto[], user: string, demo: boolean) {
 const uploaded: string[] = [];
 const cleanup = async () => { if (uploaded.length) await getAuthClient().storage.from("universe-magazine").remove(uploaded); };
 try {
  const result: MagazinePhoto[] = [];
  for (const image of images) {
   if (demo || !image.path.startsWith("data:")) { result.push(image); continue; }
   const path = `${user}/${crypto.randomUUID()}.webp`;
   const blob = await (await fetch(image.path)).blob();
   const { error } = await getAuthClient().storage.from("universe-magazine").upload(path, blob, { contentType: "image/webp", upsert: false });
   if (error) throw error;
   uploaded.push(path); result.push({ ...image, path });
  }
  return { images: result, cleanup };
 } catch (error) { await cleanup(); throw error; }
}

export function MagazinePhotoView({ photo }: { photo: MagazinePhoto }) {
 const local = photo.path.startsWith("data:image/webp;base64,") || photo.path.startsWith("/images/");
 const [resolved, setResolved] = useState({ path: "", url: "", failed: false });
 useEffect(() => {
  if (local) return;
  let active = true;
  async function resolve() {
   try {
    const { data, error } = await getAuthClient().storage.from("universe-magazine").createSignedUrl(photo.path, 240);
    if (active) setResolved({ path: photo.path, url: error ? "" : data?.signedUrl ?? "", failed: !!error });
   } catch { if (active) setResolved({ path: photo.path, url: "", failed: true }); }
  }
  void resolve(); const refresh = window.setInterval(() => void resolve(), 180000);
  return () => { active = false; window.clearInterval(refresh); };
 }, [photo.path, local]);
 const src = local ? photo.path : resolved.path === photo.path ? resolved.url : "";
 return <figure className="mz-photo">{src ? /* Uploaded images use expiring, access-controlled URLs. */
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src} alt={photo.alt} loading="lazy" decoding="async"/> : <div className="mz-photo-loading">{resolved.failed ? "Imagen no disponible / Imatge no disponible" : "…"}</div>}
  {(photo.caption || photo.credit) && <figcaption>{photo.caption}{photo.credit && <span>© {photo.credit}</span>}</figcaption>}
 </figure>;
}

export function MagazineStoryBody({ body, summary, images = [], layout = "classic" }: { body: string; summary?: string; images?: MagazinePhoto[]; layout?: string }) {
 return <div className={`mz-story-content mz-layout-${layout}`}>
  {summary && <p className="mz-story-summary">{summary}</p>}
  {layout !== "classic" && images[0] && <div className="mz-lead-photo"><MagazinePhotoView photo={images[0]}/></div>}
  <p className="mz-story-body">{body}</p>
  <div className="mz-story-gallery">{images.slice(layout === "classic" ? 0 : 1).map(photo => <MagazinePhotoView key={photo.path} photo={photo}/>)}</div>
 </div>;
}
