"use client";

import { useEffect, useId, useRef, useState } from "react";
import type {
  LayerGroup,
  Map as LeafletMap,
  Marker as LeafletMarker,
  LeafletMouseEvent,
  TileLayer,
} from "leaflet";
import {
  hasCoordinates,
  LATITUDE_RANGE,
  LONGITUDE_RANGE,
  type CustomerRecord,
} from "@/components/erp/records/customers-api";
import { formatCoordinate } from "@/lib/format";

type LeafletModule = typeof import("leaflet");

type MapContext = {
  map: LeafletMap;
  L: LeafletModule;
  layer: LayerGroup;
};

type LocatedCustomer = CustomerRecord & {
  latitude: number;
  longitude: number;
};

type MarkerEntry = {
  id: string;
  marker: LeafletMarker;
};

const VENEZUELA_CENTER: [number, number] = [7.8, -66.2];
const VENEZUELA_ZOOM = 5;
const SELECTED_ZOOM = 14;
const PICKER_ZOOM = 15;
const CLUSTER_THRESHOLD = 50;
const CLUSTER_CELL_PX = 64;
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function roundCoordinate(value: number) {
  return Number(value.toFixed(7));
}

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function createMap(
  L: LeafletModule,
  container: HTMLElement,
  { reduceMotion }: { reduceMotion: boolean },
) {
  const map = L.map(container, {
    attributionControl: true,
    scrollWheelZoom: false,
    minZoom: 3,
    maxZoom: 19,
    zoomControl: true,
    center: VENEZUELA_CENTER,
    zoom: VENEZUELA_ZOOM,
    zoomAnimation: !reduceMotion,
    fadeAnimation: !reduceMotion,
    markerZoomAnimation: !reduceMotion,
  });

  const tiles = L.tileLayer(TILE_URL, {
    maxZoom: 19,
    attribution: TILE_ATTRIBUTION,
  });

  return { map, tiles };
}

function watchTileFailures(
  tiles: TileLayer,
  isActive: () => boolean,
  onFailure: () => void,
) {
  let errors = 0;
  let loads = 0;
  tiles.on("tileload", () => {
    loads += 1;
  });
  tiles.on("tileerror", () => {
    errors += 1;
    if (isActive() && loads === 0 && errors >= 4) onFailure();
  });
}

function customerMarkerIcon(L: LeafletModule) {
  return L.divIcon({
    className: "fm-map-marker",
    html: '<span aria-hidden="true"></span>',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

function clusterIcon(L: LeafletModule, count: number) {
  return L.divIcon({
    className: "fm-map-cluster",
    html: `<span aria-hidden="true">${count}</span>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

function pickerMarkerIcon(L: LeafletModule) {
  return L.divIcon({
    className: "fm-map-picker-marker",
    html: '<span aria-hidden="true"></span>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function attachMarkerActivation(element: HTMLElement, activate: () => void) {
  element.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    activate();
  });
}

type MapFallbackProps = {
  message: string;
};

function MapFallback({ message }: MapFallbackProps) {
  return (
    <div
      className="flex h-full min-h-40 items-center justify-center rounded-2xl border border-line bg-background px-5 py-8 text-center"
      role="alert"
    >
      <p className="max-w-sm text-[13px] leading-6 text-muted">{message}</p>
    </div>
  );
}

type CustomerMapProps = {
  customers: CustomerRecord[];
  selectedId: string | null;
  onSelect: (customer: CustomerRecord) => void;
  centerRequest?: { latitude: number; longitude: number } | null;
  totalLocatedCount?: number;
  className?: string;
};

export function CustomerMap({
  customers,
  selectedId,
  onSelect,
  centerRequest = null,
  totalLocatedCount,
  className = "",
}: CustomerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapContextRef = useRef<MapContext | null>(null);
  const entriesRef = useRef<MarkerEntry[]>([]);
  const reduceMotionRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const descriptionId = useId();

  const onSelectRef = useRef(onSelect);
  const selectedIdRef = useRef(selectedId);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    let active = true;
    let observer: ResizeObserver | null = null;
    let tiles: TileLayer | null = null;
    let mapInstance: LeafletMap | null = null;

    reduceMotionRef.current = prefersReducedMotion();
    const isActive = () => active;

    async function init() {
      try {
        const leafletModule = await import("leaflet");
        if (!active) return;
        const L = (leafletModule.default ?? leafletModule) as LeafletModule;
        const container = containerRef.current;
        if (!container) return;

        const created = createMap(L, container, {
          reduceMotion: reduceMotionRef.current,
        });
        mapInstance = created.map;
        tiles = created.tiles;
        watchTileFailures(tiles, isActive, () => setUnavailable(true));
        tiles.addTo(created.map);

        const layer = L.layerGroup().addTo(created.map);
        mapContextRef.current = { map: created.map, L, layer };

        if (typeof ResizeObserver !== "undefined") {
          observer = new ResizeObserver(() => {
            created.map.invalidateSize(false);
          });
          observer.observe(container);
        }

        setReady(true);
      } catch {
        if (active) setUnavailable(true);
      }
    }

    void init();

    return () => {
      active = false;
      observer?.disconnect();
      tiles?.off();
      entriesRef.current = [];
      mapContextRef.current = null;
      mapInstance?.remove();
    };
  }, []);

  const locatedCount = customers.reduce(
    (total, customer) => (hasCoordinates(customer) ? total + 1 : total),
    0,
  );

  useEffect(() => {
    const context = mapContextRef.current;
    if (!ready || !context) return;
    const { map, L, layer } = context;
    const locatedCustomers = customers.filter(hasCoordinates);

    function draw() {
      layer.clearLayers();
      entriesRef.current = [];

      function addCustomerMarker(customer: LocatedCustomer) {
        const marker = L.marker([customer.latitude, customer.longitude], {
          icon: customerMarkerIcon(L),
          keyboard: true,
          title: customer.fullName,
          alt: customer.fullName,
          riseOnHover: true,
          autoPanOnFocus: !reduceMotionRef.current,
        });

        marker.on("click", () => onSelectRef.current(customer));
        const tooltip = document.createElement("span");
        tooltip.textContent = customer.fullName;
        marker.bindTooltip(tooltip, {
          direction: "top",
          offset: [0, -12],
          opacity: 1,
        });
        marker.addTo(layer);

        const element = marker.getElement();
        if (element) {
          element.setAttribute(
            "aria-label",
            `Ubicación de ${customer.fullName}`,
          );
          attachMarkerActivation(element, () => onSelectRef.current(customer));
        }

        entriesRef.current.push({ id: String(customer.id), marker });
      }

      function addClusterMarker(group: LocatedCustomer[]) {
        const center: [number, number] = [
          group.reduce((sum, item) => sum + item.latitude, 0) / group.length,
          group.reduce((sum, item) => sum + item.longitude, 0) / group.length,
        ];
        const count = group.length;
        const marker = L.marker(center, {
          icon: clusterIcon(L, count),
          keyboard: true,
          title: `${count} clientes en esta zona`,
          riseOnHover: true,
        });
        const zoomIn = () => {
          map.setView(center, Math.min(map.getZoom() + 2, 18), {
            animate: false,
          });
        };
        marker.on("click", zoomIn);
        marker.addTo(layer);
        const element = marker.getElement();
        if (element) {
          element.setAttribute(
            "aria-label",
            `${count} clientes en esta zona. Activa para acercar el mapa.`,
          );
          attachMarkerActivation(element, zoomIn);
        }
      }

      function groupByCell(items: LocatedCustomer[]) {
        const cells = new Map<string, LocatedCustomer[]>();
        for (const customer of items) {
          const point = map.project(
            [customer.latitude, customer.longitude],
            map.getZoom(),
          );
          const key = `${Math.floor(point.x / CLUSTER_CELL_PX)}:${Math.floor(
            point.y / CLUSTER_CELL_PX,
          )}`;
          const bucket = cells.get(key);
          if (bucket) bucket.push(customer);
          else cells.set(key, [customer]);
        }
        return cells;
      }

      if (locatedCustomers.length >= CLUSTER_THRESHOLD && map.getZoom() < 16) {
        for (const group of groupByCell(locatedCustomers).values()) {
          if (group.length === 1) addCustomerMarker(group[0]);
          else addClusterMarker(group);
        }
      } else {
        for (const customer of locatedCustomers) addCustomerMarker(customer);
      }

      if (locatedCustomers.length === 0) {
        map.setView(VENEZUELA_CENTER, VENEZUELA_ZOOM, { animate: false });
      }

      const currentSelected = selectedIdRef.current;
      for (const entry of entriesRef.current) {
        const isActive = entry.id === currentSelected;
        const element = entry.marker.getElement();
        if (element) {
          element.classList.toggle("fm-map-marker--active", isActive);
          if (isActive) element.setAttribute("aria-current", "true");
          else element.removeAttribute("aria-current");
        }
        entry.marker.setZIndexOffset(isActive ? 1000 : 0);
      }
    }

    draw();

    const handleZoomEnd = () => {
      if (locatedCustomers.length >= CLUSTER_THRESHOLD) draw();
    };
    map.on("zoomend", handleZoomEnd);

    return () => {
      map.off("zoomend", handleZoomEnd);
    };
  }, [customers, ready]);

  useEffect(() => {
    if (!ready) return;
    for (const entry of entriesRef.current) {
      const isActive = entry.id === selectedId;
      const element = entry.marker.getElement();
      if (element) {
        element.classList.toggle("fm-map-marker--active", isActive);
        if (isActive) element.setAttribute("aria-current", "true");
        else element.removeAttribute("aria-current");
      }
      entry.marker.setZIndexOffset(isActive ? 1000 : 0);
    }
  }, [ready, selectedId]);

  useEffect(() => {
    const context = mapContextRef.current;
    if (!ready || !context || !centerRequest) return;
    context.map.setView(
      [centerRequest.latitude, centerRequest.longitude],
      SELECTED_ZOOM,
      { animate: !reduceMotionRef.current },
    );
  }, [centerRequest, ready]);

  const totalLocated = totalLocatedCount ?? locatedCount;
  const emptyMessage =
    totalLocated === 0
      ? "Ningún cliente tiene ubicación registrada."
      : "No hay clientes con ubicación que coincidan con la búsqueda.";
  const description =
    locatedCount > 0
      ? `Mapa con ${locatedCount} ${
          locatedCount === 1 ? "cliente ubicado" : "clientes ubicados"
        }. Selecciona un marcador para resaltar su fila en la tabla.`
      : totalLocated === 0
        ? "Mapa de Venezuela sin clientes con ubicación registrada. La tabla contiene toda la información."
        : "Mapa de Venezuela sin clientes con ubicación que coincidan con la búsqueda. La tabla contiene toda la información.";

  return (
    <div className={`relative isolate z-0 h-full w-full ${className}`}>
      <p className="sr-only" id={descriptionId}>
        {description}
      </p>
      {unavailable && (
        <MapFallback message="No pudimos cargar el mapa. Puedes seguir gestionando los clientes en la tabla." />
      )}
      <div className={unavailable ? "hidden" : "h-full w-full"}>
        <div
          aria-describedby={descriptionId}
          aria-label="Mapa de ubicaciones de clientes"
          className="h-full w-full rounded-2xl"
          ref={containerRef}
          role="region"
        />
      </div>
      {!unavailable && locatedCount === 0 && (
        <div
          className="pointer-events-none absolute left-1/2 top-3 w-max max-w-[calc(100%-5rem)] -translate-x-1/2 rounded-xl border border-brand/20 bg-surface/95 px-4 py-2.5 text-center text-[12px] font-semibold text-ink shadow-[0_10px_24px_rgba(27,12,104,0.12)]"
          role="status"
        >
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

type CustomerLocationPickerProps = {
  latitude: number | null;
  longitude: number | null;
  onPick: (latitude: number, longitude: number) => void;
  className?: string;
};

export function CustomerLocationPicker({
  latitude,
  longitude,
  onPick,
  className = "",
}: CustomerLocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<MapContext | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const reduceMotionRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const descriptionId = useId();

  const onPickRef = useRef(onPick);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    let active = true;
    let observer: ResizeObserver | null = null;
    let tiles: TileLayer | null = null;
    let mapInstance: LeafletMap | null = null;

    reduceMotionRef.current = prefersReducedMotion();
    const isActive = () => active;

    async function init() {
      try {
        const leafletModule = await import("leaflet");
        if (!active) return;
        const L = (leafletModule.default ?? leafletModule) as LeafletModule;
        const container = containerRef.current;
        if (!container) return;

        const created = createMap(L, container, {
          reduceMotion: reduceMotionRef.current,
        });
        mapInstance = created.map;
        tiles = created.tiles;
        watchTileFailures(tiles, isActive, () => setUnavailable(true));
        tiles.addTo(created.map);

        created.map.on("click", (event: LeafletMouseEvent) => {
          onPickRef.current(
            roundCoordinate(event.latlng.lat),
            roundCoordinate(event.latlng.lng),
          );
        });

        const layer = L.layerGroup().addTo(created.map);
        contextRef.current = { map: created.map, L, layer };

        if (typeof ResizeObserver !== "undefined") {
          observer = new ResizeObserver(() => {
            created.map.invalidateSize(false);
          });
          observer.observe(container);
        }

        setReady(true);
      } catch {
        if (active) setUnavailable(true);
      }
    }

    void init();

    return () => {
      active = false;
      observer?.disconnect();
      tiles?.off();
      markerRef.current = null;
      contextRef.current = null;
      mapInstance?.remove();
    };
  }, []);

  const hasPoint =
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= LATITUDE_RANGE.min &&
    latitude <= LATITUDE_RANGE.max &&
    longitude >= LONGITUDE_RANGE.min &&
    longitude <= LONGITUDE_RANGE.max;

  useEffect(() => {
    const context = contextRef.current;
    if (!ready || !context) return;
    const { map, L, layer } = context;

    if (!hasPoint) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      map.setView(VENEZUELA_CENTER, VENEZUELA_ZOOM, { animate: false });
      return;
    }

    const position: [number, number] = [latitude, longitude];
    if (!markerRef.current) {
      const marker = L.marker(position, {
        icon: pickerMarkerIcon(L),
        interactive: false,
        keyboard: false,
      });
      marker.addTo(layer);
      markerRef.current = marker;
      map.setView(position, PICKER_ZOOM, {
        animate: !reduceMotionRef.current,
      });
      return;
    }

    markerRef.current.setLatLng(position);
    if (!map.getBounds().contains(position)) {
      map.setView(position, map.getZoom(), {
        animate: !reduceMotionRef.current,
      });
    }
  }, [hasPoint, latitude, longitude, ready]);

  const status = hasPoint
    ? `Ubicación seleccionada: latitud ${formatCoordinate(
        latitude,
      )}, longitud ${formatCoordinate(longitude)}.`
    : "Sin ubicación seleccionada. Haz clic en el mapa o escribe la latitud y la longitud.";

  return (
    <div className={`relative isolate z-0 h-full w-full ${className}`}>
      <p className="sr-only" id={descriptionId}>
        Mapa para seleccionar la ubicación del cliente. Haz clic en el mapa para
        fijar la latitud y la longitud, o escríbelas en los campos del
        formulario.
      </p>
      {unavailable && (
        <MapFallback message="No pudimos cargar el mapa. Puedes escribir la latitud y la longitud manualmente." />
      )}
      <div className={unavailable ? "hidden" : "h-full w-full"}>
        <div
          aria-describedby={descriptionId}
          aria-label="Mapa para seleccionar la ubicación del cliente"
          className="h-full w-full rounded-2xl"
          ref={containerRef}
          role="region"
        />
      </div>
      {!unavailable && (
        <p className="pointer-events-none absolute left-1/2 top-3 w-max max-w-[calc(100%-5rem)] -translate-x-1/2 rounded-xl border border-brand/20 bg-surface/95 px-4 py-2.5 text-center text-[12px] font-semibold text-ink shadow-[0_10px_24px_rgba(27,12,104,0.12)]">
          Haz clic en el mapa para ajustar la ubicación.
        </p>
      )}
      <p aria-live="polite" className="sr-only">
        {status}
      </p>
    </div>
  );
}
