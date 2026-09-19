"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Filter } from "lucide-react";
import { useCommunity } from "./context";

export type MapSpotKind = "plans" | "cafe" | "restaurant" | "library" | "nightlife" | "culture" | "outdoors";
export type MapSpot = { place: string; lat: number; lng: number; short: [string, string]; kind: MapSpotKind; icon: string };

// Coordenadas reales de los puntos que aparecen en Inicio.
export const spots: MapSpot[] = [
  { place: "Benimaclet", lat: 39.4892, lng: -0.3619, short: ["Benimaclet", "Benimaclet"], kind: "plans", icon: "✦" },
  { place: "Torres de Serranos", lat: 39.4794, lng: -0.3751, short: ["Serranos", "Serrans"], kind: "plans", icon: "✦" },
  { place: "La Malvarrosa", lat: 39.4784, lng: -0.3239, short: ["Malvarrosa", "Malva-rosa"], kind: "outdoors", icon: "☀" },
  { place: "L’Albufera · Gola de Pujol", lat: 39.3265, lng: -0.3238, short: ["L’Albufera", "L’Albufera"], kind: "outdoors", icon: "⌁" },
  { place: "Campus de Vera · Ágora", lat: 39.4814, lng: -0.3372, short: ["Vera", "Vera"], kind: "plans", icon: "✦" },
  { place: "Ruzafa · Café", lat: 39.4627, lng: -0.3711, short: ["Ruzafa", "Russafa"], kind: "cafe", icon: "☕" },
  { place: "Mercado de Colón · Restaurantes", lat: 39.4690, lng: -0.3654, short: ["Mercado", "Mercat"], kind: "restaurant", icon: "⌁" },
  { place: "Biblioteca Pública", lat: 39.4705, lng: -0.3768, short: ["Biblioteca", "Biblioteca"], kind: "library", icon: "▤" },
  { place: "Marina · Discotecas", lat: 39.4586, lng: -0.3223, short: ["Marina", "Marina"], kind: "nightlife", icon: "♫" },
  { place: "Cines Lys", lat: 39.4688, lng: -0.3762, short: ["Cines Lys", "Cines Lys"], kind: "culture", icon: "▹" },
  { place: "Jardín del Turia", lat: 39.4708, lng: -0.3658, short: ["Jardín Turia", "Jardí Túria"], kind: "outdoors", icon: "✿" },
];

type LeafletMap = import("leaflet").Map;
type LeafletLayerGroup = import("leaflet").LayerGroup;
type MapFilter = "all" | "active" | "quiet" | MapSpotKind;

export function ActivityMap({ selected, onSelect, counts }: { selected: string | null; onSelect: (place: string | null) => void; counts: Record<string, number> }) {
  const { c, locale } = useCommunity();
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<LeafletLayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  const [filter, setFilter] = useState<MapFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  onSelectRef.current = onSelect;
  const visibleSpots = useMemo(() => spots.filter(spot => filter === "all" || filter === "active" && (counts[spot.place] ?? 0) > 0 || filter === "quiet" && (counts[spot.place] ?? 0) === 0 || filter !== "active" && filter !== "quiet" && spot.kind === filter), [counts, filter]);
  const active = visibleSpots.filter(spot => (counts[spot.place] ?? 0) > 0).length;
  const filterLabels: Record<MapFilter, [string, string]> = { all: ["Todos los puntos", "Tots els punts"], active: ["Con planes", "Amb plans"], quiet: ["Lugares libres", "Llocs lliures"], plans: ["Planes", "Plans"], cafe: ["Cafés", "Cafés"], restaurant: ["Restaurantes", "Restaurants"], library: ["Bibliotecas", "Biblioteques"], nightlife: ["Discotecas", "Discoteques"], culture: ["Cultura", "Cultura"], outdoors: ["Aire libre", "Aire lliure"] };
  const filterLabel = filterLabels[filter][locale === "va" ? 1 : 0];

  useEffect(() => {
    let disposed = false;
    void import("leaflet").then(({ default: L }) => {
      if (disposed || !mapNode.current || mapRef.current) return;

      const map = L.map(mapNode.current, {
        center: [39.454, -0.356],
        zoom: 12,
        minZoom: 11,
        maxZoom: 17,
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: false,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png", {
        maxZoom: 19,
        subdomains: "a",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
      }).addTo(map);

      const bounds = L.latLngBounds(spots.map(spot => [spot.lat, spot.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [26, 26], maxZoom: 13 });
      mapRef.current = map;
      layersRef.current = L.layerGroup().addTo(map);
      window.setTimeout(() => map.invalidateSize(), 0);
    });

    return () => {
      disposed = true;
      layersRef.current?.clearLayers();
      layersRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    void import("leaflet").then(({ default: L }) => {
      if (disposed || !layersRef.current) return;
      layersRef.current.clearLayers();

      visibleSpots.forEach(spot => {
        const count = counts[spot.place] ?? 0;
        const isSelected = selected === spot.place;
        const label = spot.short[locale === "va" ? 1 : 0];
        const kindLabel = filterLabels[spot.kind][locale === "va" ? 1 : 0];
        const planLabel = count ? `${count} ${count === 1 ? c("planOne") : c("plans").toLocaleLowerCase()}` : kindLabel;
        const icon = L.divIcon({
          className: "u-leaflet-icon",
          iconSize: [108, 72],
          iconAnchor: [54, 62],
          html: `<div class="u-leaflet-pin u-leaflet-pin-${spot.kind} ${isSelected ? "active" : ""} ${count ? "" : "quiet"}"><span class="u-leaflet-pin-dot"><span class="u-leaflet-pin-mark" aria-hidden="true">${spot.icon}</span>${count > 0 ? `<span class="u-leaflet-pin-count">${count}</span>` : ""}</span><span class="u-leaflet-pin-label"><strong>${label}</strong><small>${planLabel}</small></span></div>`,
        });
        const marker = L.marker([spot.lat, spot.lng], { icon, keyboard: true, title: `${label}: ${planLabel}` });
        marker.on("click", () => onSelectRef.current(isSelected ? null : spot.place));
        marker.on("keydown", (event: L.LeafletKeyboardEvent) => {
          if (event.originalEvent.key === "Enter" || event.originalEvent.key === " ") {
            event.originalEvent.preventDefault();
            onSelectRef.current(isSelected ? null : spot.place);
          }
        });
        marker.addTo(layersRef.current!);
      });
    });

    return () => { disposed = true; };
  }, [counts, selected, locale, c, visibleSpots]);

  const chooseFilter = (next: MapFilter) => {
    setFilter(next);
    setFilterOpen(false);
    if (selected && next !== "all" && !visibleSpots.some(spot => spot.place === selected)) onSelect(null);
  };

  return <div className="u-map">
    <div className="u-map-head">
      <div>
        <p className="u-eyebrow">{c("mapSection")} · València</p>
        <h2>{c("mapTitle")}</h2>
        <p className="u-map-help">{c("mapPick")}</p>
      </div>
      <div className="u-map-actions">
        <div className="u-map-filter-wrap">
          <button type="button" className={`u-map-filter-button ${filter !== "all" ? "active" : ""}`} aria-expanded={filterOpen} aria-haspopup="menu" onClick={() => setFilterOpen(open => !open)}><Filter aria-hidden="true" />{filterLabel}</button>
          {filterOpen && <div className="u-map-filter-menu" role="menu" aria-label={locale === "va" ? "Filtrar el mapa" : "Filtrar el mapa"}>
            {(["all", "active", "quiet", "cafe", "restaurant", "library", "nightlife", "culture", "outdoors"] as MapFilter[]).map(value => <button type="button" role="menuitemradio" aria-checked={filter === value} key={value} className={filter === value ? "selected" : ""} onClick={() => chooseFilter(value)}>{filterLabels[value][locale === "va" ? 1 : 0]}<span>{value === "all" ? spots.length : value === "active" ? spots.filter(spot => (counts[spot.place] ?? 0) > 0).length : value === "quiet" ? spots.filter(spot => (counts[spot.place] ?? 0) === 0).length : spots.filter(spot => spot.kind === value).length}</span></button>)}
          </div>}
        </div>
        <button type="button" className={`u-map-reset ${selected ? "" : "active"}`} onClick={() => onSelect(null)} aria-pressed={!selected}>{c("allPlaces")}</button>
      </div>
    </div>

    <div className="u-map-canvas u-real-map" ref={mapNode} role="application" aria-label={locale === "va" ? "Mapa real de València amb punts de plans" : "Mapa real de Valencia con puntos de planes"}>
      <span className="u-map-badge">Mapa real · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a></span>
      {!visibleSpots.length && <div className="u-map-empty" role="status">{locale === "va" ? "No hi ha punts amb plans ara mateix." : "No hay puntos con planes ahora mismo."}</div>}
      <noscript>{locale === "va" ? "Activa JavaScript per a veure el mapa." : "Activa JavaScript para ver el mapa."}</noscript>
    </div>

    <p className="u-map-foot"><span className="u-map-foot-dot" aria-hidden="true" />{active} {c("spotsWithPlans")}</p>
  </div>;
}
