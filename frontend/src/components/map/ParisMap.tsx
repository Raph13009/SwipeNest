"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Popup,
  Source,
  type MapMouseEvent,
  type MapRef,
} from "react-map-gl/mapbox";
import type { GeoJSONSource, Map as MapboxMap, Marker as MapboxMarker } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { api, mediaUrl } from "@/lib/api";
import { formatRent } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { Layers3, LocateFixed } from "lucide-react";

type Point = {
  id: string;
  lat: number;
  lng: number;
  rent_eur: number;
  title: string;
  image: string;
  arrondissement: number;
  match_score: number;
  scam_risk: string;
};

const MAPBOX_TOKEN = (process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "")
  .replace(/^['"]|['"]$/g, "")
  .trim();

const PARIS = {
  longitude: 2.3522,
  latitude: 48.8566,
  zoom: 11.85,
  bearing: -22,
};

const STYLE = "mapbox://styles/mapbox/light-v11";
const PILL_ZOOM = 13.15;
const MAX_ZOOM = 17;

/** High pitch throws ground pins behind the camera once the zoom is close. */
function pitchForZoom(zoom: number, show3d: boolean) {
  if (!show3d) return 0;
  if (zoom <= 12.15) return 50;
  if (zoom >= 13.55) return 0;
  return 50 * (1 - (zoom - 12.15) / (13.55 - 12.15));
}

function stopMapGesture(event: Event) {
  event.stopPropagation();
}

function sameIds(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const id of b) if (!a.has(id)) return false;
  return true;
}

function PriceMarker({
  point,
  active,
  locale,
  onSelect,
}: {
  point: Point;
  active: boolean;
  locale: string;
  onSelect: (point: Point) => void;
}) {
  const markerRef = useRef<MapboxMarker | null>(null);

  useEffect(() => {
    const el = markerRef.current?.getElement();
    if (!el) return;
    el.addEventListener("touchstart", stopMapGesture);
    el.addEventListener("mousedown", stopMapGesture);
    el.addEventListener("pointerdown", stopMapGesture);
    el.addEventListener("click", stopMapGesture);
    return () => {
      el.removeEventListener("touchstart", stopMapGesture);
      el.removeEventListener("mousedown", stopMapGesture);
      el.removeEventListener("pointerdown", stopMapGesture);
      el.removeEventListener("click", stopMapGesture);
    };
  }, []);

  return (
    <Marker
      ref={markerRef}
      longitude={point.lng}
      latitude={point.lat}
      anchor="bottom"
      pitchAlignment="viewport"
      rotationAlignment="viewport"
      occludedOpacity={1}
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onSelect(point);
      }}
    >
      <button
        type="button"
        className={`sn-map-pill ${active ? "sn-map-pill--active" : ""} ${
          point.scam_risk === "high" ? "sn-map-pill--risk" : ""
        }`}
      >
        {formatRent(point.rent_eur, locale).replace(/\s/g, "\u00a0")}
      </button>
    </Marker>
  );
}

function brandPaint(map: MapboxMap) {
  const set = (layer: string, prop: string, value: unknown) => {
    if (!map.getLayer(layer)) return;
    // Soft brand tint over Mapbox light — layer names vary by style version
    try {
      map.setPaintProperty(layer, prop as never, value as never);
    } catch {
      /* layer paint unsupported */
    }
  };

  set("background", "background-color", "#f2eee5");
  set("landcover", "fill-color", "#ebe4d8");
  set("landuse", "fill-color", "#e4ece6");
  set("national-park", "fill-color", "#c5d9ce");
  set("park", "fill-color", "#c8d9cf");
  set("pitch", "fill-color", "#d5e3db");
  set("water", "fill-color", "#b4cdc5");
  set("waterway", "line-color", "#a3bfb6");
  ["road-primary", "road-secondary-tertiary", "road-street", "road-minor"].forEach((id) => {
    set(id, "line-color", "#f8f4ed");
  });
  set("road-motorway-trunk", "line-color", "#e6ddd0");
  set("building", "fill-color", "#ddd7cd");
  set("building", "fill-opacity", 0.9);

  if (!map.getLayer("sn-3d-buildings") && map.getSource("composite")) {
    map.addLayer({
      id: "sn-3d-buildings",
      source: "composite",
      "source-layer": "building",
      filter: ["==", ["get", "extrude"], "true"],
      type: "fill-extrusion",
      minzoom: 13.4,
      paint: {
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["zoom"],
          13.4,
          "#d7e1da",
          16,
          "#bccdc4",
        ],
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          13.4,
          0,
          14.6,
          ["get", "height"],
        ],
        "fill-extrusion-base": ["get", "min_height"],
        "fill-extrusion-opacity": 0.75,
      },
    });
  }

  map.setFog?.({
    color: "rgb(242, 238, 229)",
    "high-color": "rgb(198, 214, 205)",
    "horizon-blend": 0.1,
    "space-color": "rgb(228, 234, 230)",
    "star-intensity": 0,
  });
}

export function ParisMap() {
  const locale = useAppStore((s) => s.locale);
  const mapRef = useRef<MapRef>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [selected, setSelected] = useState<Point | null>(null);
  const [show3d, setShow3d] = useState(true);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(10.15);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const pointsRef = useRef(points);
  const show3dRef = useRef(show3d);
  const introDone = useRef(false);
  const pitchLock = useRef(false);
  pointsRef.current = points;
  show3dRef.current = show3d;

  useEffect(() => {
    api
      .map()
      .then((res) => setPoints(res.points))
      .catch(() => undefined);
  }, []);

  const avgRent = useMemo(() => {
    if (!points.length) return 0;
    return Math.round(points.reduce((a, p) => a + p.rent_eur, 0) / points.length);
  }, [points]);

  const geojson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: points.map((p) => ({
        type: "Feature" as const,
        properties: {
          id: p.id,
          rent: p.rent_eur,
          match: Math.round(p.match_score),
          risk: p.scam_risk,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [p.lng, p.lat],
        },
      })),
    }),
    [points]
  );

  const showPills = zoom >= PILL_ZOOM;

  const syncVisible = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const width = map.getContainer().clientWidth;
    const height = map.getContainer().clientHeight;
    const next = new Set<string>();
    if (map.getZoom() >= PILL_ZOOM) {
      for (const point of pointsRef.current) {
        const projected = map.project([point.lng, point.lat]);
        if (
          Number.isFinite(projected.x) &&
          Number.isFinite(projected.y) &&
          Math.abs(projected.x) < 1e6 &&
          Math.abs(projected.y) < 1e6 &&
          projected.x > -72 &&
          projected.y > -72 &&
          projected.x < width + 72 &&
          projected.y < height + 72
        ) {
          next.add(point.id);
        }
      }
    }
    setVisibleIds((prev) => (sameIds(prev, next) ? prev : next));
  }, []);

  const onLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    brandPaint(map);
    setReady(true);
    const pitch = pitchForZoom(PARIS.zoom, true);
    map.easeTo({
      ...PARIS,
      pitch,
      duration: 2400,
      easing: (t) => 1 - Math.pow(1 - t, 3),
    });
    map.once("moveend", () => {
      introDone.current = true;
      syncVisible();
    });
  }, [syncVisible]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !ready) return;
    for (const id of ["sn-clusters", "sn-cluster-count", "sn-points"]) {
      if (map.getLayer(id)) map.moveLayer(id);
    }
  }, [ready, points.length]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map?.getLayer("sn-3d-buildings")) return;
    map.setLayoutProperty("sn-3d-buildings", "visibility", show3d ? "visible" : "none");
    map.easeTo({ pitch: pitchForZoom(map.getZoom(), show3d), duration: 650 });
  }, [show3d]);

  useEffect(() => {
    if (!selected) return;
    let popup: Element | null = null;
    const frame = requestAnimationFrame(() => {
      popup = document.querySelector(".sn-map-shell .mapboxgl-popup");
      if (!popup) return;
      popup.addEventListener("touchstart", stopMapGesture);
      popup.addEventListener("mousedown", stopMapGesture);
      popup.addEventListener("pointerdown", stopMapGesture);
    });
    return () => {
      cancelAnimationFrame(frame);
      popup?.removeEventListener("touchstart", stopMapGesture);
      popup?.removeEventListener("mousedown", stopMapGesture);
      popup?.removeEventListener("pointerdown", stopMapGesture);
    };
  }, [selected]);

  const selectPoint = useCallback((point: Point) => {
    setSelected(point);
  }, []);

  const onClusterClick = useCallback(
    (e: MapMouseEvent) => {
      const rawTarget = e.originalEvent.target as HTMLElement | null;
      if (rawTarget?.closest(".mapboxgl-marker, .mapboxgl-popup, .mapboxgl-ctrl")) return;

      const feature = e.features?.[0];
      const map = mapRef.current?.getMap();
      if (!map) return;
      if (!feature) {
        setSelected(null);
        return;
      }
      e.originalEvent.stopPropagation();

      if (feature.properties?.cluster) {
        const clusterId = feature.properties.cluster_id as number;
        const source = map.getSource("listings") as GeoJSONSource;
        source.getClusterExpansionZoom(clusterId, (err, nextZoom) => {
          if (err || nextZoom == null) return;
          const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
          const zoom = Math.min(Math.max(nextZoom, map.getZoom()), 16.2);
          map.easeTo({
            center: coords,
            zoom,
            pitch: pitchForZoom(zoom, show3dRef.current),
            duration: 650,
          });
        });
        return;
      }

      const id = String(feature.properties?.id ?? "");
      const point = pointsRef.current.find((p) => p.id === id);
      if (!point) return;
      setSelected(point);
      if (map.getZoom() >= PILL_ZOOM) return;
      const zoom = Math.max(map.getZoom(), 14.4);
      map.easeTo({
        center: [point.lng, point.lat],
        zoom,
        pitch: pitchForZoom(zoom, show3dRef.current),
        offset: [0, -36],
        duration: 560,
      });
    },
    []
  );

  const recenter = () => {
    mapRef.current?.easeTo({
      ...PARIS,
      pitch: pitchForZoom(PARIS.zoom, show3dRef.current),
      duration: 950,
    });
    setSelected(null);
  };

  if (!MAPBOX_TOKEN) {
    return (
      <div className="relative flex h-[78vh] min-h-[480px] items-center justify-center overflow-hidden rounded-[28px] border border-[rgba(27,77,62,0.08)] bg-[linear-gradient(145deg,#f8f6f1,#e8efe9)] shadow-[var(--sn-card-shadow)]">
        <p className="max-w-sm px-6 text-center text-sm text-[var(--sn-muted)]">
          Mapbox token missing. Add{" "}
          <code className="text-[var(--sn-green)]">NEXT_PUBLIC_MAPBOX_TOKEN</code> to{" "}
          <code>.env</code> (no quotes) and restart the frontend.
        </p>
      </div>
    );
  }

  return (
    <div className="sn-map-shell relative h-[78vh] min-h-[480px] overflow-hidden rounded-[28px] shadow-[var(--sn-card-shadow)]">
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_top,rgba(248,246,241,0.4),transparent_52%),linear-gradient(180deg,rgba(248,246,241,0.28)_0%,transparent_16%,transparent_80%,rgba(242,238,229,0.5)_100%)]" />

      <div className="absolute right-4 top-4 z-20 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setShow3d((v) => !v)}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold shadow-[0_10px_28px_rgba(27,77,62,0.12)] backdrop-blur-xl transition ${
            show3d
              ? "border-[var(--sn-green)] bg-[var(--sn-green)] text-white"
              : "border-white/70 bg-white/90 text-[var(--sn-green)]"
          }`}
        >
          <Layers3 className="h-3.5 w-3.5" />
          3D
        </button>
        <button
          type="button"
          onClick={recenter}
          className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-3 py-2 text-xs font-bold text-[var(--sn-green)] shadow-[0_10px_28px_rgba(27,77,62,0.12)] backdrop-blur-xl"
        >
          <LocateFixed className="h-3.5 w-3.5" />
          Paris
        </button>
      </div>

      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: PARIS.longitude,
          latitude: PARIS.latitude,
          zoom: 10.15,
          pitch: 0,
          bearing: 0,
        }}
        mapStyle={STYLE}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
        onLoad={onLoad}
        onMove={(e) => {
          const nextZoom = e.viewState.zoom;
          setZoom((prev) => (Math.abs(prev - nextZoom) < 0.08 ? prev : nextZoom));
          syncVisible();
          const gesture = (e as { originalEvent?: Event }).originalEvent;
          if (!introDone.current || pitchLock.current || !gesture) return;
          const target = pitchForZoom(nextZoom, show3dRef.current);
          if (Math.abs(e.viewState.pitch - target) < 0.75) return;
          pitchLock.current = true;
          e.target.setPitch(target);
          pitchLock.current = false;
        }}
        interactiveLayerIds={["sn-clusters", "sn-points"]}
        onClick={onClusterClick}
        clickTolerance={12}
        cursor="pointer"
        maxBounds={[
          [1.95, 48.65],
          [2.75, 49.05],
        ]}
        minZoom={10}
        maxZoom={MAX_ZOOM}
        maxPitch={62}
      >
        <NavigationControl position="bottom-right" showCompass visualizePitch />

        <Source
            id="listings"
            type="geojson"
            data={geojson}
            cluster
            clusterMaxZoom={13}
            clusterRadius={58}
            maxzoom={MAX_ZOOM}
          >
            <Layer
              id="sn-clusters"
              type="circle"
              filter={["has", "point_count"]}
              paint={{
                "circle-color": [
                  "step",
                  ["get", "point_count"],
                  "#A7C4B8",
                  15,
                  "#6f9a88",
                  45,
                  "#1B4D3E",
                ],
                "circle-radius": ["step", ["get", "point_count"], 20, 15, 26, 45, 34],
                "circle-stroke-width": 3,
                "circle-stroke-color": "rgba(255,253,249,0.95)",
                "circle-opacity": 0.94,
              }}
            />
            <Layer
              id="sn-cluster-count"
              type="symbol"
              filter={["has", "point_count"]}
              layout={{
                "text-field": ["get", "point_count_abbreviated"],
                "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
                "text-size": 13,
              }}
              paint={{ "text-color": "#14352c" }}
            />
            <Layer
              id="sn-points"
              type="circle"
              filter={["!", ["has", "point_count"]]}
              paint={{
                "circle-color": [
                  "case",
                  ["==", ["get", "risk"], "high"],
                  "#FADADD",
                  [
                    "interpolate",
                    ["linear"],
                    ["get", "match"],
                    40,
                    "#A7C4B8",
                    70,
                    "#5f8f7a",
                    92,
                    "#1B4D3E",
                  ],
                ],
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 8, 14, 13, 16.5, 15],
                "circle-stroke-width": 2.5,
                "circle-stroke-color": "#fffdf9",
                "circle-pitch-alignment": "viewport",
                "circle-pitch-scale": "viewport",
              }}
            />
          </Source>

        {showPills &&
          points
            .filter((p) => visibleIds.has(p.id))
            .map((p) => (
              <PriceMarker
                key={p.id}
                point={p}
                active={selected?.id === p.id}
                locale={locale}
                onSelect={selectPoint}
              />
            ))}

        {selected && (
          <Popup
            longitude={selected.lng}
            latitude={selected.lat}
            anchor="bottom"
            offset={42}
            closeOnClick
            onClose={() => setSelected(null)}
            className="sn-map-popup"
            maxWidth="280px"
          >
            <Link href={`/listing/${selected.id}`} className="block overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaUrl(selected.image)}
                alt=""
                className="h-32 w-full object-cover"
              />
              <div className="bg-white px-3.5 py-3">
                <p className="text-base font-bold text-[var(--sn-green)]">
                  {formatRent(selected.rent_eur, locale)}
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm font-medium text-[var(--sn-ink)]">
                  {selected.title}
                </p>
                <p className="mt-1 text-xs text-[var(--sn-muted)]">
                  {selected.arrondissement}
                  {locale === "fr" ? "e" : "th"} · Match {Math.round(selected.match_score)}%
                </p>
                <span className="mt-2 inline-flex text-xs font-bold text-[var(--sn-green)]">
                  {locale === "fr" ? "Voir l'annonce →" : "View listing →"}
                </span>
              </div>
            </Link>
          </Popup>
        )}
      </Map>

      {!ready && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#f2eee5]">
          <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--sn-sage)]/55" />
        </div>
      )}

      <div className="pointer-events-none absolute bottom-4 left-4 z-20 rounded-full border border-white/60 bg-white/80 px-3 py-1.5 text-[10px] font-semibold text-[var(--sn-muted)] shadow backdrop-blur-md">
        Mapbox · Paris
        {avgRent > 0 && (
          <>
            <span className="mx-1.5 opacity-40">·</span>
            {locale === "fr" ? "moy." : "avg"} {formatRent(avgRent, locale)}
          </>
        )}
      </div>
    </div>
  );
}
