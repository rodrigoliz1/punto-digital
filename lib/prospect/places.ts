import { ProspectError } from "./types";

/**
 * Agente investigador: Google Places API (New) — Text Search.
 * Términos: el place_id puede conservarse indefinidamente; el resto del contenido de Places tiene
 * restricciones de caché. Por eso cada registro guarda `places_content_expires_at` (30 días) y existe
 * una purga. Requiere revisión legal de los términos vigentes antes de operar a escala.
 */
export const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
export const PLACES_FIELD_MASK = ["places.id", "places.displayName", "places.formattedAddress", "places.websiteUri", "places.nationalPhoneNumber", "places.primaryType", "places.businessStatus", "places.googleMapsUri"].join(",");
export const PLACES_RETENTION_DAYS = 30;

export type PlacesQuery = { category: string; city: string; zone?: string | null; pageSize?: number };

export type PlaceCandidate = {
  placeId: string;
  name: string;
  address: string | null;
  website: string | null;
  phone: string | null;
  primaryType: string | null;
  mapsUrl: string;
};

type PlacesResponse = {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    websiteUri?: string;
    nationalPhoneNumber?: string;
    primaryType?: string;
    businessStatus?: string;
    googleMapsUri?: string;
  }>;
};

export function buildTextQuery(query: PlacesQuery) {
  return [query.category, query.zone ? `en ${query.zone}` : null, `${query.zone ? "" : "en "}${query.city}, Jalisco, México`].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export function mapPlaces(data: PlacesResponse): PlaceCandidate[] {
  return (data.places ?? [])
    .filter((place) => place.id && place.displayName?.text && place.businessStatus !== "CLOSED_PERMANENTLY")
    .map((place) => ({
      placeId: place.id!,
      name: place.displayName!.text!.slice(0, 200),
      address: place.formattedAddress?.slice(0, 300) ?? null,
      website: place.websiteUri ?? null,
      phone: place.nationalPhoneNumber ?? null,
      primaryType: place.primaryType ?? null,
      mapsUrl: place.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${place.id}`,
    }));
}

export async function searchPlaces(query: PlacesQuery, apiKey: string, fetchImpl: typeof fetch = fetch): Promise<PlaceCandidate[]> {
  if (!apiKey) throw new ProspectError("Falta GOOGLE_PLACES_API_KEY.", 503, "missing_credentials");
  const response = await fetchImpl(PLACES_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": PLACES_FIELD_MASK },
    body: JSON.stringify({ textQuery: buildTextQuery(query), languageCode: "es", regionCode: "MX", pageSize: Math.min(Math.max(query.pageSize ?? 20, 1), 20) }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    // No se reenvía el cuerpo del error: podría contener detalles de la credencial.
    throw new ProspectError(`Google Places respondió ${response.status}.`, 502, "provider_error");
  }
  return mapPlaces((await response.json()) as PlacesResponse);
}
