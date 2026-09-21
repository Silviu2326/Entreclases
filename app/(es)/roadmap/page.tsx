import { RoadmapPage } from "@/components/entreclase/roadmap-page";
import { pageMetadata } from "@/lib/i18n/metadata";
const base = pageMetadata("es", "roadmap"), title = "Roadmap — Entreclases";
const description = "Las tres fechas de Entreclases: apertura en Valencia el 28 de septiembre, Proyectos dos semanas después y un anuncio el último lunes de octubre.";
export const metadata = { ...base, title, description, openGraph: { ...base.openGraph, title, description } };
export default function Page() { return <RoadmapPage locale="es" />; }
