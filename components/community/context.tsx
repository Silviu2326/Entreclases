"use client";
import { createContext, useContext } from "react";
import type { Locale } from "@/lib/i18n/routes";
import type { UniversityMember } from "@/lib/auth/client";
import type { CommunityData, CommunityRepository, Profile, View } from "@/lib/community/types";
import type { communityCopy } from "@/lib/community/copy";
export type CommunityContextValue={
 locale:Locale; c:ReturnType<typeof communityCopy>; demo:boolean; member:UniversityMember; data:CommunityData; me:Profile;
 repo:CommunityRepository; feedback:{text:string;error:boolean}|null; busy:boolean; query:string; view:View; groupId:string|null; threadId:string|null;
 go:(view:View,options?:{groupId?:string;threadId?:string})=>void;
 run:(task:()=>Promise<unknown>,message?:string)=>Promise<boolean>;
 refresh:()=>Promise<CommunityData>;
};
export const CommunityContext=createContext<CommunityContextValue|null>(null);
export function useCommunity(){const value=useContext(CommunityContext);if(!value)throw new Error("Community provider missing");return value;}
export function matches(query:string,...values:(string|undefined)[]){const fold=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase();return fold(values.filter(Boolean).join(" ")).includes(fold(query.trim()));}
