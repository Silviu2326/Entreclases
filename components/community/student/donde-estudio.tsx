"use client";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Clock, MapPin, Navigation, Users2, Moon, CalendarCheck, VolumeX, Wifi, LocateFixed } from "lucide-react";
import { ToolShell, Panel, Notice, useTool } from "./shared";
import { ExternalLink, Chips } from "../controls";
import {
  libraries, isOpenNow, distanceKm, sortLibraries, filterLibraries, campusList,
  type Library, type Network, type Feature, type OpenStatus,
} from "@/lib/community/student/libraries";
import "./donde-estudio.css";

type NetworkFilter = "all" | Network;
type Position = { lat: number; lng: number };
type GeoStatus = "idle" | "loading" | "denied" | "unsupported";
type T = (es: string, va: string) => string;

const NETWORKS: readonly NetworkFilter[] = ["all", "UV", "UPV", "UCV", "CEU", "Pública"];
const NETWORK_LABEL: Record<NetworkFilter, readonly [string, string]> = {
  all: ["Todas", "Totes"], UV: ["UV", "UV"], UPV: ["UPV", "UPV"], UCV: ["UCV", "UCV"], CEU: ["CEU", "CEU"],
  "Pública": ["Públicas", "Públiques"],
};

const FEATURE_LABEL: Record<Feature, readonly [string, string]> = {
  group_rooms: ["Salas de grupo", "Sales de grup"],
  exam_24h: ["24 h en exámenes", "24 h en exàmens"],
  reservable: ["Reserva online", "Reserva online"],
  silent: ["Silenciosa", "Silenciosa"],
  wifi: ["Wifi", "Wifi"],
};
const FEATURE_ICON: Record<Feature, ReactNode> = {
  group_rooms: <Users2 aria-hidden="true" />,
  exam_24h: <Moon aria-hidden="true" />,
  reservable: <CalendarCheck aria-hidden="true" />,
  silent: <VolumeX aria-hidden="true" />,
  wifi: <Wifi aria-hidden="true" />,
};

/** The most recent `verifiedAt` in the data set, formatted "DD/MM" for the fixed notice. */
const LAST_CHECKED = libraries.reduce((latest, library) => (library.verifiedAt && library.verifiedAt > latest ? library.verifiedAt : latest), "");
const LAST_CHECKED_LABEL = (() => {
  const [, month, day] = LAST_CHECKED.split("-");
  return day && month ? `${day}/${month}` : "";
})();

function directionsUrl(library: Library) {
  return `https://www.google.com/maps/dir/?api=1&destination=${library.lat},${library.lng}`;
}

function statusLabel(t: T, status: OpenStatus): string {
  if (status.unknown) return t("Consulta el horario", "Consulta l'horari");
  if (status.open) return t(`Abierta hasta las ${status.until}`, `Oberta fins les ${status.until}`);
  if (status.opensAt) return t(`Cerrada · abre a las ${status.opensAt}`, `Tancada · obri a les ${status.opensAt}`);
  return t("Cerrada", "Tancada");
}

function statusTone(status: OpenStatus): "open" | "closed" | "unknown" {
  if (status.unknown) return "unknown";
  return status.open ? "open" : "closed";
}

function formatKm(km: number) {
  return km.toFixed(1).replace(".", ",");
}

/** Re-renders on a slow timer so "open now" catches up without a manual refresh. */
function useTick(every = 60000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), every);
    return () => window.clearInterval(timer);
  }, [every]);
  return now;
}

export default function Screen() {
  const { t } = useTool("libraries");
  const now = useTick();
  const [network, setNetwork] = useState<NetworkFilter>("all");
  const [campus, setCampus] = useState<string>("all");
  const [groupRoomsOnly, setGroupRoomsOnly] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");

  const campuses = useMemo(() => campusList(libraries), []);
  const campusOptions = useMemo(
    () => [{ value: "all", label: t("Todos", "Tots") }, ...campuses.map(name => ({ value: name, label: name }))],
    [campuses, t],
  );

  const filtered = useMemo(() => filterLibraries(libraries, {
    network: network === "all" ? undefined : network,
    campus: campus === "all" ? undefined : campus,
    groupRooms: groupRoomsOnly || undefined,
  }), [network, campus, groupRoomsOnly]);

  const sorted = useMemo(
    () => sortLibraries(filtered, { now: new Date(now), position: position ?? undefined }),
    [filtered, now, position],
  );

  const locateMe = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) { setGeoStatus("unsupported"); return; }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      result => { setPosition({ lat: result.coords.latitude, lng: result.coords.longitude }); setGeoStatus("idle"); },
      () => setGeoStatus("denied"),
      { timeout: 8000 },
    );
  }, []);

  return (
    <ToolShell id="libraries" local={false}>
      <div className="lib-filters">
        <Chips label={t("Red", "Xarxa")} value={network}
          onChange={value => setNetwork(value as NetworkFilter)}
          options={NETWORKS.map(value => ({ value, label: t(NETWORK_LABEL[value][0], NETWORK_LABEL[value][1]) }))} />
        <Chips label={t("Campus", "Campus")} value={campus} onChange={setCampus} options={campusOptions} />
        <Chips label={t("Salas de grupo", "Sales de grup")} value={groupRoomsOnly ? "yes" : "no"}
          onChange={value => setGroupRoomsOnly(value === "yes")}
          options={[
            { value: "no", label: t("Cualquiera", "Qualsevol") },
            { value: "yes", label: t("Con salas de grupo", "Amb sales de grup") },
          ]} />
      </div>

      <div className="lib-row">
        <button type="button" className="st-button st-button-secondary lib-locate" onClick={locateMe} disabled={geoStatus === "loading"}>
          <LocateFixed aria-hidden="true" />
          {geoStatus === "loading" ? t("Buscando tu posición…", "Cercant la teua posició…") : t("Ordenar por cercanía", "Ordenar per proximitat")}
        </button>
        {geoStatus === "denied" && <span className="lib-geo-msg">{t("No hemos podido usar tu ubicación. Seguimos ordenando por nombre.", "No hem pogut usar la teua ubicació. Seguim ordenant per nom.")}</span>}
        {geoStatus === "unsupported" && <span className="lib-geo-msg">{t("Tu navegador no permite ubicarte aquí.", "El teu navegador no permet ubicar-te ací.")}</span>}
      </div>

      <Notice>
        {t(`Horarios habituales comprobados el ${LAST_CHECKED_LABEL}; en exámenes y festivos cambian. La web oficial manda.`,
          `Horaris habituals comprovats el ${LAST_CHECKED_LABEL}; en exàmens i festius canvien. La web oficial mana.`)}
      </Notice>

      <ul className="lib-list">
        {sorted.map(library => (
          <LibraryCard key={library.id} library={library} now={now} position={position} t={t} />
        ))}
        {sorted.length === 0 && <p className="st-muted lib-empty">{t("Ninguna biblioteca cumple estos filtros.", "Cap biblioteca complix estos filtres.")}</p>}
      </ul>

      <Panel title={t("Quién está estudiando", "Qui està estudiant")}>
        <p className="st-muted">
          {t("Cuando haya gente conectada, aquí verás quién está estudiando en cada sitio.", "Quan hi haja gent connectada, ací veuràs qui està estudiant a cada lloc.")}
        </p>
      </Panel>
    </ToolShell>
  );
}

function LibraryCard({ library, now, position, t }: { library: Library; now: number; position: Position | null; t: T }) {
  const status = useMemo(() => isOpenNow(library, new Date(now)), [library, now]);
  return (
    <li className="lib-card">
      <div className="lib-card-head">
        <strong>{library.name}</strong>
        <span className="lib-card-meta">{library.network} · {library.campus}</span>
      </div>

      <span className={`lib-status lib-status-${statusTone(status)}`}>
        <Clock aria-hidden="true" />
        {statusLabel(t, status)}
      </span>

      {library.note && <p className="lib-note">{t(library.note[0], library.note[1])}</p>}

      {library.features.length > 0 && (
        <div className="lib-chips">
          {library.features.map(feature => (
            <span key={feature} className="lib-chip">{FEATURE_ICON[feature]}{t(FEATURE_LABEL[feature][0], FEATURE_LABEL[feature][1])}</span>
          ))}
        </div>
      )}

      <p className="lib-address"><MapPin aria-hidden="true" />{library.address}</p>

      {position && <span className="lib-distance">{`a ${formatKm(distanceKm(position, library))} km`}</span>}

      <div className="lib-links">
        <ExternalLink href={library.url}>{t("Web oficial", "Web oficial")}</ExternalLink>
        <a className="u-text-link lib-directions" href={directionsUrl(library)} target="_blank" rel="noopener noreferrer">
          <Navigation aria-hidden="true" />{t("Cómo llegar", "Com arribar")}
        </a>
      </div>
    </li>
  );
}
