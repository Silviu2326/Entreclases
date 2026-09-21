"use client";
import { createContext, useContext } from "react";
import type { Locale } from "@/lib/i18n/routes";
import type { UniversityMember } from "@/lib/auth/client";
import type { CommunityData, CommunityRepository, Profile, View } from "@/lib/community/types";
import type { GameKind } from "@/lib/community/games/types";
import type { ProjectRoute } from "@/lib/community/studio/sections";
import type { communityCopy } from "@/lib/community/copy";
import type { PlaceKind, PlanPeriod } from "@/lib/community/places";
export type GoOptions={groupId?:string;threadId?:string;stay?:boolean;place?:string;anchor?:string;period?:PlanPeriod;kind?:PlaceKind};
export type CommunityContextValue={
 locale:Locale; c:ReturnType<typeof communityCopy>; demo:boolean; member:UniversityMember; data:CommunityData; me:Profile;
 repo:CommunityRepository; feedback:{text:string;error:boolean}|null; busy:boolean; query:string; view:View; game:GameKind|null; groupId:string|null; threadId:string|null;
 /* La página de proyectos abierta y el proyecto que lleva en la dirección, porque su identificador solo existe en tiempo de ejecución. */
 project:ProjectRoute|null; projectId:string|null;
 /* El lugar con el que se ha llegado a la pantalla: lo pone el mapa de Inicio al abrir los planes de Explorar, y el filtro de Explorar al volver al mapa. */
 place:string|null;
 /* El periodo (?when=) y el tipo de sitio (?kind=) de los planes con que se llega: viajan igual que `place` entre Inicio y Explorar. */
 period:PlanPeriod|null; kind:PlaceKind|null;
 /* `stay` keeps the scroll and the focus where they are: for moves inside the screen you are already on.
    `anchor` is the id of the section to land on, so Inicio y Explorar puedan enviarse a un punto concreto. */
 go:(view:View,options?:GoOptions)=>void;
 run:(task:()=>Promise<unknown>,message?:string)=>Promise<boolean>;
 refresh:()=>Promise<CommunityData>;
};
export const CommunityContext=createContext<CommunityContextValue|null>(null);
export function useCommunity(){const value=useContext(CommunityContext);if(!value)throw new Error("Community provider missing");return value;}
export function matches(query:string,...values:(string|undefined)[]){const fold=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase();return fold(values.filter(Boolean).join(" ")).includes(fold(query.trim()));}
