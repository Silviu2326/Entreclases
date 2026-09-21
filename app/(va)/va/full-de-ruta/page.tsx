import { RoadmapPage } from "@/components/entreclase/roadmap-page";
import { pageMetadata } from "@/lib/i18n/metadata";
const base = pageMetadata("va", "roadmap"), title = "Full de ruta — Entreclases";
const description = "Les tres dates d’Entreclases: obertura a València el 28 de setembre, Projectes dos setmanes després i un anunci l’últim dilluns d’octubre.";
export const metadata = { ...base, title, description, openGraph: { ...base.openGraph, title, description } };
export default function Page() { return <RoadmapPage locale="va" />; }
