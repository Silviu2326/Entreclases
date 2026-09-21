import { CommunityApp } from "@/components/community/community-app";
import { projectSections, sectionBySlug, languageIndex } from "@/lib/community/studio/sections";
import { projectMetadata } from "@/lib/i18n/metadata";
import "@/app/community.css";
import "leaflet/dist/leaflet.css";
type Params = { params: Promise<{ section: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return projectSections.map(section => ({ section: section.slug[languageIndex("es")] })); }
export async function generateMetadata({ params }: Params) { const section = sectionBySlug("es", (await params).section); return projectMetadata("es", false, section?.id); }
export default async function Page({ params }: Params) { const section = sectionBySlug("es", (await params).section); return <CommunityApp locale="es" project={section?.id ?? "hub"} />; }
