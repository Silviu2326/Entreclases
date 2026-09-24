// The posts are written in a small subset of Markdown: paragraphs, "##" and
// "###" headings, "-" and "1." lists, ">" quotes, and inline **bold**, *italic*
// and [links](/path/). Everything is parsed into a tree and rendered as React
// elements, so no HTML from the text ever reaches the page unescaped.
export type Inline = { kind: "text"; text: string } | { kind: "strong" | "em"; text: string } | { kind: "link"; text: string; href: string };
export type Block =
 | { kind: "heading"; level: 2 | 3; id: string; inline: Inline[]; text: string }
 | { kind: "paragraph"; inline: Inline[] }
 | { kind: "list"; ordered: boolean; items: Inline[][] }
 | { kind: "quote"; inline: Inline[] };

export function parseInline(source: string): Inline[] {
 const out: Inline[] = [], pattern = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
 let last = 0;
 for (const match of source.matchAll(pattern)) {
  const index = match.index ?? 0;
  if (index > last) out.push({ kind: "text", text: source.slice(last, index) });
  if (match[1] !== undefined) out.push({ kind: "strong", text: match[1] });
  else if (match[2] !== undefined) out.push({ kind: "em", text: match[2] });
  else out.push({ kind: "link", text: match[3], href: match[4] });
  last = index + match[0].length;
 }
 if (last < source.length) out.push({ kind: "text", text: source.slice(last) });
 return out;
}
export function plainText(inline: Inline[]) { return inline.map((part) => part.text).join(""); }
// Heading anchors keep letters from both languages and drop the rest.
export function slugify(text: string) {
 return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
export function parseMarkdown(source: string): Block[] {
 const blocks: Block[] = [], lines = source.replace(/\r\n/g, "\n").split("\n");
 const seen = new Map<string, number>();
 let paragraph: string[] = [], list: { ordered: boolean; items: string[] } | null = null;
 const flush = () => {
  if (paragraph.length) { blocks.push({ kind: "paragraph", inline: parseInline(paragraph.join(" ")) }); paragraph = []; }
  if (list) { blocks.push({ kind: "list", ordered: list.ordered, items: list.items.map(parseInline) }); list = null; }
 };
 for (const raw of lines) {
  const line = raw.trim();
  if (!line) { flush(); continue; }
  const heading = /^(##{1,2})\s+(.+)$/.exec(line);
  if (heading) {
   flush();
   const inline = parseInline(heading[2]), text = plainText(inline), base = slugify(text) || "seccion", count = seen.get(base) ?? 0;
   seen.set(base, count + 1);
   blocks.push({ kind: "heading", level: heading[1].length === 2 ? 2 : 3, id: count ? `${base}-${count + 1}` : base, inline, text });
   continue;
  }
  const item = /^(?:-|\d+\.)\s+(.+)$/.exec(line);
  if (item) {
   if (paragraph.length) flush();
   const ordered = /^\d/.test(line);
   if (!list || list.ordered !== ordered) { if (list) flush(); list = { ordered, items: [] }; }
   list.items.push(item[1]);
   continue;
  }
  if (line.startsWith(">")) { flush(); blocks.push({ kind: "quote", inline: parseInline(line.replace(/^>\s?/, "")) }); continue; }
  if (list) flush();
  paragraph.push(line);
 }
 flush();
 return blocks;
}
export function wordCount(source: string) { return source.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length; }
export function readingMinutes(source: string) { return Math.max(1, Math.round(wordCount(source) / 200)); }
