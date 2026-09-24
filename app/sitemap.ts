import type { MetadataRoute } from "next";
import { routes, type RouteName } from "@/lib/i18n/routes";
import { siteOrigin } from "@/lib/i18n/metadata";
import { posts, postUrl } from "@/lib/blog/posts";

// Built once with the site. The public pages are the landing, the roadmap and
// the blog; every entry names its twin in the other language.
export const dynamic = "force-static";
const publicRoutes: RouteName[] = ["home", "roadmap", "blog"];
export default function sitemap(): MetadataRoute.Sitemap {
 const pages = publicRoutes.flatMap((name) => (["es", "va"] as const).map((locale) => ({
  url: siteOrigin + routes[locale][name],
  alternates: { languages: { es: siteOrigin + routes.es[name], "ca-ES": siteOrigin + routes.va[name] } },
 })));
 const entries = posts.flatMap((post) => (["es", "va"] as const).map((locale) => ({
  url: postUrl(locale, post), lastModified: post.updated ?? post.date,
  alternates: { languages: { es: postUrl("es", post), "ca-ES": postUrl("va", post) } },
 })));
 return [...pages, ...entries];
}
