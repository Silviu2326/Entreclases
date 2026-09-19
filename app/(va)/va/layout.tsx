import "@/app/globals.css";
import { pageMetadata, siteViewport } from "@/lib/i18n/metadata";
export const metadata = pageMetadata("va");
export const viewport = siteViewport;
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ca-ES-valencia" data-scroll-behavior="smooth"><body>{children}</body></html>; }
