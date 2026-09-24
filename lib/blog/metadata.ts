import type { Metadata } from "next";
import type { Locale } from "../i18n/routes";
import { routes } from "../i18n/routes";
import { pageMetadata, siteOrigin } from "../i18n/metadata";
import { blogDescription, blogTitle, postPath, postUrl, type Post } from "./posts";

export function blogIndexMetadata(locale: Locale): Metadata {
 const base = pageMetadata(locale, "blog"), title = blogTitle(locale), description = blogDescription(locale);
 return { ...base, title, description, openGraph: { ...base.openGraph, title, description } };
}
export function blogPostMetadata(locale: Locale, post: Post): Metadata {
 const base = pageMetadata(locale, "blog"), text = post[locale], title = `${text.title} — Entreclases`, path = postPath(locale, post);
 return { ...base, title, description: text.description,
  alternates: { canonical: path, languages: { es: postUrl("es", post), "ca-ES": postUrl("va", post), "x-default": postUrl("es", post) } },
  openGraph: { ...base.openGraph, title: text.title, description: text.description, url: path, type: "article", publishedTime: post.date, modifiedTime: post.updated ?? post.date,
   images: [{ url: post.cover, width: 1448, height: 1086, alt: post.coverAlt[locale === "va" ? 1 : 0] }] },
 };
}
export const blogUrl = (locale: Locale) => siteOrigin + routes[locale].blog;
