import { CommunityApp } from "@/components/community/community-app";
import { projectMetadata } from "@/lib/i18n/metadata";
import "@/app/community.css";
import "leaflet/dist/leaflet.css";
export const metadata=projectMetadata("es",false);
export default function Page(){return <CommunityApp locale="es" project="hub" />;}
