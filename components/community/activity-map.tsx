"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Filter } from "lucide-react";
import { useCommunity } from "./context";
import { kindLabels, placeKinds, spots, type KindFilter, type PlaceKind, type PlaceSpot } from "@/lib/community/places";

/* Los puntos viven en lib/community/places: el filtro de lugar de Explorar y el
   formulario de crear plan leen esa misma lista, así que todo punto del mapa
   puede tener planes y todo plan cae en un punto del mapa. */
export type MapSpotKind = PlaceKind;
export type MapSpot = PlaceSpot;

type LeafletMap = import("leaflet").Map;
type LeafletLayerGroup = import("leaflet").LayerGroup;
type MapFilter = KindFilter;

/* Si un punto entra en el filtro: por número de planes o por su tipo de sitio. */
const fits = (spot: PlaceSpot, filter: MapFilter, counts: Record<string, number>) => filter === "all" || (filter === "active" ? (counts[spot.place] ?? 0) > 0 : filter === "quiet" ? (counts[spot.place] ?? 0) === 0 : spot.kind === filter);

/* El tipo de sitio es controlado (`kind`/`onKindChange`) porque viaja con Explorar;
   «con planes» y «lugares libres» solo tienen sentido aquí y se quedan dentro. */
export function ActivityMap({ selected, onSelect, counts, kind, onKindChange }: { selected: string | null; onSelect: (place: string | null) => void; counts: Record<string, number>; kind: PlaceKind | null; onKindChange: (kind: PlaceKind | null) => void }) {
  const { c, locale } = useCommunity();
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<LeafletLayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  const [mode, setMode] = useState<"all" | "active" | "quiet">("all");
  const filter: MapFilter = kind ?? mode;
  const [filterOpen, setFilterOpen] = useState(false);
  onSelectRef.current = onSelect;
  const visibleSpots = useMemo(() => spots.filter(spot => fits(spot, filter, counts)), [counts, filter]);
  const active = visibleSpots.filter(spot => (counts[spot.place] ?? 0) > 0).length;
  const filterLabel = kindLabels[filter][locale === "va" ? 1 : 0];

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
        const kindLabel = kindLabels[spot.kind][locale === "va" ? 1 : 0];
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
    if (next === "all" || next === "active" || next === "quiet") { setMode(next); onKindChange(null); }
    else { setMode("all"); onKindChange(next); }
    setFilterOpen(false);
    // Se comprueba contra el filtro nuevo: el punto elegido se suelta si ya no se ve.
    const spot = spots.find(entry => entry.place === selected);
    if (spot && !fits(spot, next, counts)) onSelect(null);
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
            {(["all", "active", "quiet", ...placeKinds] as MapFilter[]).map(value => <button type="button" role="menuitemradio" aria-checked={filter === value} key={value} className={filter === value ? "selected" : ""} onClick={() => chooseFilter(value)}>{kindLabels[value][locale === "va" ? 1 : 0]}<span>{spots.filter(spot => fits(spot, value, counts)).length}</span></button>)}
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
