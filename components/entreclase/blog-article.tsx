import Link from "next/link";
import type { Block, Inline } from "@/lib/blog/markdown";

function InlineText({ parts }: { parts: Inline[] }) {
 return <>{parts.map((part, index) => {
  if (part.kind === "strong") return <strong key={index}>{part.text}</strong>;
  if (part.kind === "em") return <em key={index}>{part.text}</em>;
  if (part.kind === "link") return /^https?:\/\//.test(part.href) ? <a key={index} href={part.href} rel="noopener">{part.text}</a> : <Link key={index} href={part.href}>{part.text}</Link>;
  return <span key={index}>{part.text}</span>;
 })}</>;
}
export function BlogArticle({ blocks }: { blocks: Block[] }) {
 return <>{blocks.map((block, index) => {
  if (block.kind === "heading") return block.level === 2 ? <h2 key={index} id={block.id}><InlineText parts={block.inline} /></h2> : <h3 key={index} id={block.id}><InlineText parts={block.inline} /></h3>;
  if (block.kind === "list") return block.ordered
   ? <ol key={index}>{block.items.map((item, i) => <li key={i}><InlineText parts={item} /></li>)}</ol>
   : <ul key={index}>{block.items.map((item, i) => <li key={i}><InlineText parts={item} /></li>)}</ul>;
  if (block.kind === "quote") return <blockquote key={index}><p><InlineText parts={block.inline} /></p></blockquote>;
  return <p key={index}><InlineText parts={block.inline} /></p>;
 })}</>;
}
