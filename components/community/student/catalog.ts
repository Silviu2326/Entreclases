import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { enabledTools } from "@/lib/community/student/catalog";
import type { ToolKind } from "@/lib/community/student/catalog";

// Textos, slugs y el interruptor viven en lib/community/student/catalog.ts.
// Aquí solo se enlaza cada herramienta con la pantalla que la implementa.
const screens: Record<ToolKind, ComponentType> = {
  grades: dynamic(() => import("./calculadora-de-notas")),
  teamwork: dynamic(() => import("./trabajos-en-grupo")),
  calendar: dynamic(() => import("./mi-semana")),
  libraries: dynamic(() => import("./donde-estudio")),
  notes: dynamic(() => import("./tutor-de-apuntes")),
  exam: dynamic(() => import("./examiname")),
};
export const tools = enabledTools.map(tool => ({ ...tool, component: screens[tool.id] }));
