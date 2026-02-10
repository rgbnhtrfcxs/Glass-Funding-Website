import mapboxgl from "mapbox-gl";
import { useEffect, useMemo, useRef } from "react";
import { mapboxToken } from "@/lib/mapbox";

export type MapMarker = {
  id: number | string;
  lng: number;
  lat: number;
  label?: string;
  subtitle?: string;
  address?: string;
  href?: string;
  imageUrl?: string;
  items?: Array<{
    id: number | string;
    label: string;
    subtitle?: string;
    address?: string;
    href?: string;
    imageUrl?: string;
  }>;
};

type MapboxMapProps = {
  markers: MapMarker[];
  className?: string;
  zoom?: number;
  interactive?: boolean;
  resizeKey?: string | number | boolean;
  onMarkerClick?: (marker: MapMarker) => void;
  onMapClick?: () => void;
  showPopups?: boolean;
  showNavigation?: boolean;
  navigationVariant?: "default" | "glass-pill";
};

export function MapboxMap({
  markers,
  className = "",
  zoom = 2,
  interactive = true,
  resizeKey,
  onMarkerClick,
  onMapClick,
  showPopups = true,
  showNavigation = false,
  navigationVariant = "default",
}: MapboxMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRefs = useRef<mapboxgl.Marker[]>([]);

  const accessToken = mapboxToken;

  const hasMarkers = markers.length > 0;
  const initialCenter = useMemo<[number, number]>(() => {
    if (hasMarkers) return [markers[0].lng, markers[0].lat];
    return [-98.5795, 39.8283];
  }, [hasMarkers, markers]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!accessToken) return;

    mapboxgl.accessToken = accessToken;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/standard",
      center: initialCenter,
      zoom,
      interactive,
      attributionControl: true,
    });

    if (showNavigation && navigationVariant === "default") {
      map.addControl(new mapboxgl.NavigationControl(), "bottom-right");
    }

    mapRef.current = map;

    return () => {
      markerRefs.current.forEach(marker => marker.remove());
      markerRefs.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [accessToken, initialCenter, interactive, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markerRefs.current.forEach(marker => marker.remove());
    markerRefs.current = [];

    if (!hasMarkers) return;

    const bounds = new mapboxgl.LngLatBounds();

    markers.forEach(marker => {
      const hasMultiple = (marker.items?.length ?? 0) > 1;
      const clusterEl = hasMultiple ? document.createElement("div") : undefined;
      if (clusterEl) {
        clusterEl.style.width = "30px";
        clusterEl.style.height = "30px";
        clusterEl.style.borderRadius = "999px";
        clusterEl.style.background = "#0ea5e9";
        clusterEl.style.color = "white";
        clusterEl.style.display = "flex";
        clusterEl.style.alignItems = "center";
        clusterEl.style.justifyContent = "center";
        clusterEl.style.fontSize = "12px";
        clusterEl.style.fontWeight = "700";
        clusterEl.style.boxShadow = "0 4px 10px rgba(14, 165, 233, 0.35)";
        clusterEl.textContent = String(marker.items?.length ?? "");
      }

      const next = new mapboxgl.Marker({ color: "#0ea5e9", element: clusterEl }).setLngLat([marker.lng, marker.lat]);

      const element = next.getElement();
      element.style.cursor = "pointer";
      element.addEventListener("click", () => {
        onMarkerClick?.(marker);
      });

      if (!showPopups) {
        next.addTo(map);
        markerRefs.current.push(next);
        bounds.extend([marker.lng, marker.lat]);
        return;
      }

      if (marker.items?.length) {
        const popup = new mapboxgl.Popup({ offset: 18, closeButton: false, closeOnClick: true });
        const container = document.createElement("div");
        container.className = "max-w-[260px]";

        const header = document.createElement("div");
        header.className = "mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground";
        header.textContent = `${marker.items.length} labs at this address`;
        container.appendChild(header);

        const list = document.createElement("div");
        list.className = "space-y-3 max-h-56 overflow-y-auto pr-1";

        marker.items.forEach(item => {
          const card = document.createElement("div");
          card.className = "rounded-lg border border-border bg-background/95 p-2 shadow-sm";

          if (item.imageUrl) {
            const image = document.createElement("img");
            image.src = item.imageUrl;
            image.alt = item.label ? `${item.label} photo` : "Lab photo";
            image.className = "mb-2 h-20 w-full rounded-md object-cover";
            card.appendChild(image);
          }

          const title = document.createElement("div");
          title.className = "text-sm font-semibold text-foreground";
          title.textContent = item.label;
          card.appendChild(title);

          if (item.subtitle) {
            const subtitle = document.createElement("div");
            subtitle.className = "mt-1 text-xs text-muted-foreground";
            subtitle.textContent = item.subtitle;
            card.appendChild(subtitle);
          }

          if (item.href) {
            const link = document.createElement("a");
            link.href = item.href;
            link.className = "mt-2 inline-flex text-xs font-medium text-primary hover:underline";
            link.textContent = "View lab";
            card.appendChild(link);
          }

          list.appendChild(card);
        });

        container.appendChild(list);
        popup.setDOMContent(container);
        next.setPopup(popup);
      } else if (marker.label || marker.subtitle || marker.href || marker.imageUrl) {
        const popup = new mapboxgl.Popup({ offset: 18, closeButton: false, closeOnClick: true });
        const container = document.createElement("div");
        container.className = "max-w-[240px]";

        if (marker.imageUrl) {
          const image = document.createElement("img");
          image.src = marker.imageUrl;
          image.alt = marker.label ? `${marker.label} photo` : "Lab photo";
          image.className = "mb-2 h-24 w-full rounded-lg object-cover";
          container.appendChild(image);
        }

        if (marker.label) {
          const title = document.createElement("div");
          title.className = "text-sm font-semibold text-foreground";
          title.textContent = marker.label;
          container.appendChild(title);
        }

        if (marker.subtitle) {
          const subtitle = document.createElement("div");
          subtitle.className = "mt-1 text-xs text-muted-foreground";
          subtitle.textContent = marker.subtitle;
          container.appendChild(subtitle);
        }

        if (marker.href) {
          const link = document.createElement("a");
          link.href = marker.href;
          link.className = "mt-2 inline-flex text-xs font-medium text-primary hover:underline";
          link.textContent = "View lab";
          container.appendChild(link);
        }

        popup.setDOMContent(container);
        next.setPopup(popup);
      }

      next.addTo(map);

      markerRefs.current.push(next);
      bounds.extend([marker.lng, marker.lat]);
    });

    if (markers.length === 1) {
      map.easeTo({ center: [markers[0].lng, markers[0].lat], zoom: Math.max(12, zoom) });
    } else {
      map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 700 });
    }

    const handleMapClick = (event: mapboxgl.MapMouseEvent) => {
      const target = event.originalEvent?.target as HTMLElement | null;
      if (target?.closest(".mapboxgl-marker")) return;
      if (target?.closest(".labs-map-overlay")) return;
      onMapClick?.();
    };
    map.on("click", handleMapClick);

    return () => {
      map.off("click", handleMapClick);
    };
  }, [hasMarkers, markers, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.resize();
  }, [resizeKey]);

  if (!accessToken) {
    return (
      <div className={`rounded-2xl border border-dashed border-border bg-card/60 p-6 text-sm text-muted-foreground ${className}`}>
        Mapbox token missing. Add `VITE_MAPBOX_TOKEN` to `client/.env.local` (or `.env`) to enable maps.
      </div>
    );
  }

  const isGlassPill = showNavigation && navigationVariant === "glass-pill";

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="h-full w-full" />
      {isGlassPill && (
        <div className="absolute bottom-6 right-8 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/60 px-2 py-1 shadow-sm backdrop-blur-xl">
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-white/70 text-sm font-semibold text-foreground transition hover:bg-white/90"
            aria-label="Zoom in"
          >
            +
          </button>
          <div className="h-6 w-px bg-white/60" />
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-white/70 text-sm font-semibold text-foreground transition hover:bg-white/90"
            aria-label="Zoom out"
          >
            –
          </button>
        </div>
      )}
    </div>
  );
}
