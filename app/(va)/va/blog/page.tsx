import "@/app/blog.css";
import { BlogIndex } from "@/components/entreclase/blog-index";
import { blogIndexMetadata } from "@/lib/blog/metadata";
export const metadata = blogIndexMetadata("va");
export default function Page() { return <BlogIndex locale="va" />; }
