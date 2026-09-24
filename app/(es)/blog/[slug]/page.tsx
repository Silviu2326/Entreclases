import "@/app/blog.css";
import { notFound } from "next/navigation";
import { BlogPost } from "@/components/entreclase/blog-post";
import { blogPostMetadata } from "@/lib/blog/metadata";
import { postBySlug, posts } from "@/lib/blog/posts";
type Params = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return posts.map((post) => ({ slug: post.es.slug })); }
export async function generateMetadata({ params }: Params) { const post = postBySlug("es", (await params).slug); return post ? blogPostMetadata("es", post) : {}; }
export default async function Page({ params }: Params) { const post = postBySlug("es", (await params).slug); if (!post) notFound(); return <BlogPost locale="es" post={post} />; }
