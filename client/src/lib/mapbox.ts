export type MapboxPoint = { lng: number; lat: number };

export const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

export function buildAddress(parts: Array<string | null | undefined>) {
  return parts.map(part => (typeof part === "string" ? part.trim() : "")).filter(Boolean).join(", ");
}

export async function geocodeAddress(query: string, token = mapboxToken): Promise<MapboxPoint | null> {
  if (!query || !token) return null;
  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as { features?: Array<{ center?: [number, number] }> };
  const center = data.features?.[0]?.center;
  if (!center) return null;
  const [lng, lat] = center;
  if (typeof lng !== "number" || typeof lat !== "number") return null;
  return { lng, lat };
}
