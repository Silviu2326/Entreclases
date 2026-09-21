import { CommunityApp } from "@/components/community/community-app";
import { projectMetadata } from "@/lib/i18n/metadata";
import "@/app/community.css";
import "leaflet/dist/leaflet.css";
export const metadata=projectMetadata("va",true);
export default function Page(){return <CommunityApp locale="va" demo project="hub" />;}
