import "@/app/blog.css";
import { notFound } from "next/navigation";
import { BlogPost } from "@/components/entreclase/blog-post";
import { blogPostMetadata } from "@/lib/blog/metadata";
import { postBySlug, posts } from "@/lib/blog/posts";
type Params = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return posts.map((post) => ({ slug: post.va.slug })); }
export async function generateMetadata({ params }: Params) { const post = postBySlug("va", (await params).slug); return post ? blogPostMetadata("va", post) : {}; }
export default async function Page({ params }: Params) { const post = postBySlug("va", (await params).slug); if (!post) notFound(); return <BlogPost locale="va" post={post} />; }
