export type BackofficeSection = "overview" | "people" | "moderation" | "explore" | "magazine" | "coins" | "settings";

export type BackofficeCase = {
  id: string;
  kind: "Moderación" | "Revista" | "Soporte" | "Proyecto";
  title: string;
  detail: string;
  person: string;
  initials: string;
  color: "peach" | "lime" | "lavender" | "sky";
  age: string;
  priority: "Alta" | "Normal";
};

export const dashboardMetrics = [
  { label: "Casos por revisar", value: "18", note: "+4 desde ayer", tone: "peach" },
  { label: "Requieren atención", value: "4", note: "2 con prioridad alta", tone: "plum" },
  { label: "Personas activas", value: "1.240", note: "+12% esta semana", tone: "lime" },
  { label: "Tiempo de respuesta", value: "2 h 18", note: "Dentro del objetivo", tone: "sky" },
] as const;

export const reviewCases: BackofficeCase[] = [
  { id: "case-104", kind: "Moderación", title: "Una publicación necesita contexto", detail: "Denuncia por posible acoso en un hilo de Benimaclet.", person: "Paula Martí", initials: "PM", color: "peach", age: "hace 18 min", priority: "Alta" },
  { id: "case-103", kind: "Revista", title: "La silla del aula 3 sigue libre", detail: "Propuesta lista para revisar los permisos de imagen.", person: "Nico Vidal", initials: "NV", color: "sky", age: "hace 42 min", priority: "Normal" },
  { id: "case-102", kind: "Proyecto", title: "Buscamos a alguien de 3D", detail: "El proyecto tiene dos puestos abiertos y un primer hito.", person: "Laia Soler", initials: "LS", color: "lavender", age: "hace 1 h", priority: "Normal" },
  { id: "case-101", kind: "Soporte", title: "No puede confirmar el correo", detail: "Cuenta de estudiante de la Universitat de València.", person: "Marc Ferrer", initials: "MF", color: "lime", age: "hace 2 h", priority: "Normal" },
];

export const pulse = [
  { label: "Solicitudes de colaboración", value: "27", detail: "esta semana", tone: "plum" },
  { label: "Planes con participantes", value: "14", detail: "de 19 publicados", tone: "lime" },
  { label: "Piezas propuestas", value: "9", detail: "para Entre líneas", tone: "peach" },
];

export const navItems: { id: BackofficeSection; label: string; note?: string }[] = [
  { id: "overview", label: "Resumen" },
  { id: "people", label: "Personas", note: "1.240" },
  { id: "moderation", label: "Moderación", note: "18" },
  { id: "explore", label: "Explorar" },
  { id: "magazine", label: "Entre líneas", note: "9" },
  { id: "coins", label: "ClasiCoins" },
  { id: "settings", label: "Configuración" },
];
