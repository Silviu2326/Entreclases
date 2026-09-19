import "@/app/globals.css";
import { pageMetadata, siteViewport } from "@/lib/i18n/metadata";
export const metadata = pageMetadata("es");
export const viewport = siteViewport;
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es" data-scroll-behavior="smooth"><body>{children}</body></html>; }
