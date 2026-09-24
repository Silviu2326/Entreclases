import Image from "next/image";
import Link from "next/link";
import { localPath, type Locale } from "@/lib/i18n/routes";
import { AUTHOR, blogDescription, blogTitle, postDate, postMinutes, postPath, postUrl, posts } from "@/lib/blog/posts";
import { blogUrl } from "@/lib/blog/metadata";
import { BlogFooter, BlogHeader, BlogSignup } from "./blog-shell";
import { JsonLd } from "./json-ld";

export function BlogIndex({ locale }: { locale: Locale }) {
 const va = locale === "va", index = va ? 1 : 0;
 const data = {
  "@context": "https://schema.org", "@type": "Blog", "@id": blogUrl(locale), url: blogUrl(locale), name: blogTitle(locale), description: blogDescription(locale), inLanguage: va ? "ca-ES-valencia" : "es-ES",
  publisher: { "@type": "Organization", name: "Entreclases", url: AUTHOR.url },
  blogPost: posts.map((post) => ({ "@type": "BlogPosting", "@id": postUrl(locale, post), url: postUrl(locale, post), headline: post[locale].title, datePublished: post.date, dateModified: post.updated ?? post.date })),
 };
 return <main className="blog-page">
  <JsonLd data={data} />
  <BlogHeader locale={locale} alternate={localPath(va ? "es" : "va", "blog")} />
  <section className="blog-intro">
   <p className="eyebrow">{va ? "BLOG · VALÈNCIA" : "BLOG · VALENCIA"}</p>
   <h1>{va ? "Vida universitària a València" : "Vida universitaria en Valencia"}</h1>
   <p className="blog-lead">{va
    ? "Guies escrites des del campus: com conéixer gent, on estudiar, plans que no buiden la cartera i com sobreviure al primer curs. Sense «experiències úniques» ni promeses de comunitat màgica."
    : "Guías escritas desde el campus: cómo conocer gente, dónde estudiar, planes que no vacían la cartera y cómo sobrevivir al primer curso. Sin «experiencias únicas» ni promesas de comunidad mágica."}</p>
  </section>
  <ol className="blog-list">
   {posts.map((post) => {
    const text = post[locale];
    return <li key={post.id} className="blog-card">
     <Link href={postPath(locale, post)} className="blog-card-cover" tabIndex={-1} aria-hidden="true"><Image src={post.cover} alt="" width={1448} height={1086} sizes="(max-width: 700px) 100vw, 320px" /></Link>
     <div className="blog-card-body">
      <p className="blog-meta"><time dateTime={post.date}>{postDate(post.date, locale)}</time> · {postMinutes(post, locale)} min</p>
      <h2><Link href={postPath(locale, post)}>{text.title}</Link></h2>
      <p>{text.description}</p>
      <ul className="blog-tags" aria-label={va ? "Temes" : "Temas"}>{post.tags.map((tag) => <li key={tag[0]}>{tag[index]}</li>)}</ul>
     </div>
    </li>;
   })}
  </ol>
  <BlogSignup locale={locale} />
  <BlogFooter locale={locale} />
 </main>;
}
