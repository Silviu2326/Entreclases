// Structured data for search engines. The object is ours, so the only escaping
// needed is the one that keeps a "<" from closing the script early.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
 return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
