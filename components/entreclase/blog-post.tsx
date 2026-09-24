import Image from "next/image";
import Link from "next/link";
import { localPath, type Locale } from "@/lib/i18n/routes";
import { siteOrigin } from "@/lib/i18n/metadata";
import { AUTHOR, postBlocks, postDate, postMinutes, postPath, postUrl, posts, type Post } from "@/lib/blog/posts";
import { blogUrl } from "@/lib/blog/metadata";
import { BlogArticle } from "./blog-article";
import { BlogFooter, BlogHeader, BlogSignup } from "./blog-shell";
import { JsonLd } from "./json-ld";

export function BlogPost({ locale, post }: { locale: Locale; post: Post }) {
 const va = locale === "va", index = va ? 1 : 0, text = post[locale], blocks = postBlocks(post, locale);
 const sections = blocks.filter((block) => block.kind === "heading" && block.level === 2);
 const others = posts.filter((other) => other.id !== post.id).slice(0, 3);
 const article = {
  "@context": "https://schema.org", "@type": "BlogPosting", "@id": postUrl(locale, post), url: postUrl(locale, post), mainEntityOfPage: postUrl(locale, post),
  headline: text.title, description: text.description, inLanguage: va ? "ca-ES-valencia" : "es-ES",
  image: [siteOrigin + post.cover], datePublished: post.date, dateModified: post.updated ?? post.date,
  author: { "@type": "Organization", name: AUTHOR.name, url: AUTHOR.url },
  publisher: { "@type": "Organization", name: "Entreclases", url: AUTHOR.url, logo: { "@type": "ImageObject", url: `${siteOrigin}/brand/entreclase-mark.png` } },
  keywords: post.tags.map((tag) => tag[index]).join(", "), isPartOf: { "@type": "Blog", "@id": blogUrl(locale) },
  about: { "@type": "Place", name: va ? "València" : "Valencia" },
 };
 const crumbs = {
  "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
   { "@type": "ListItem", position: 1, name: "Entreclases", item: siteOrigin + localPath(locale, "home") },
   { "@type": "ListItem", position: 2, name: "Blog", item: blogUrl(locale) },
   { "@type": "ListItem", position: 3, name: text.title, item: postUrl(locale, post) },
  ],
 };
 return <main className="blog-page">
  <JsonLd data={article} /><JsonLd data={crumbs} />
  <BlogHeader locale={locale} alternate={postPath(va ? "es" : "va", post)} />
  <article className="blog-article">
   <header className="blog-article-header">
    <p className="blog-meta"><time dateTime={post.date}>{postDate(post.date, locale)}</time> · {postMinutes(post, locale)} {va ? "min de lectura" : "min de lectura"}{post.updated && <> · {va ? "actualitzat el" : "actualizado el"} <time dateTime={post.updated}>{postDate(post.updated, locale)}</time></>}</p>
    <h1>{text.title}</h1>
    <p className="blog-lead">{text.description}</p>
    <ul className="blog-tags" aria-label={va ? "Temes" : "Temas"}>{post.tags.map((tag) => <li key={tag[0]}>{tag[index]}</li>)}</ul>
   </header>
   <figure className="blog-cover"><Image src={post.cover} alt={post.coverAlt[index]} width={1448} height={1086} sizes="(max-width: 860px) 100vw, 820px" priority /></figure>
   {sections.length > 2 && <nav className="blog-toc" aria-label={va ? "En este article" : "En este artículo"}><strong>{va ? "En este article" : "En este artículo"}</strong><ol>{sections.map((section) => section.kind === "heading" && <li key={section.id}><a href={`#${section.id}`}>{section.text}</a></li>)}</ol></nav>}
   <div className="blog-body"><BlogArticle blocks={blocks} /></div>
   <p className="blog-author">{va ? "Escrit per" : "Escrito por"} <strong>{AUTHOR.name}</strong>. {va ? "Els llocs i horaris canvien: si trobes un error, escriu-nos a" : "Los sitios y horarios cambian: si ves un error, escríbenos a"} <a href="mailto:hola@entreclases.com">hola@entreclases.com</a>.</p>
  </article>
  <BlogSignup locale={locale} />
  {others.length > 0 && <section className="blog-more" aria-labelledby="blog-more-title">
   <h2 id="blog-more-title">{va ? "Més del blog" : "Más del blog"}</h2>
   <ul>{others.map((other) => <li key={other.id}><Link href={postPath(locale, other)}>{other[locale].title}</Link><span>{postDate(other.date, locale)}</span></li>)}</ul>
  </section>}
  <BlogFooter locale={locale} />
 </main>;
}
