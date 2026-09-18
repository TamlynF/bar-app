import type { PlaceHit } from "./rivals";

type GeocodeOk = { lat: number; lng: number };
type GeocodeFail = { error: string };

export async function geocodeAddress(
  address: string,
  apiKey: string,
): Promise<GeocodeOk | GeocodeFail> {
  const params = new URLSearchParams({ address, key: apiKey });
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) return { error: "Could not look up that area on the map." };
  const body = (await res.json()) as {
    status?: string;
    results?: { geometry?: { location?: { lat: number; lng: number } } }[];
    error_message?: string;
  };
  if (body.status === "ZERO_RESULTS" || !body.results?.length) {
    return { error: "That area could not be found on the map. Try a town name or postcode." };
  }
  if (body.status && body.status !== "OK") {
    return { error: body.error_message || "Maps could not geocode that area. Check the API key has Geocoding enabled." };
  }
  const loc = body.results[0]?.geometry?.location;
  if (loc == null || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) {
    return { error: "That area could not be found on the map." };
  }
  return { lat: loc.lat, lng: loc.lng };
}

type NewPlace = {
  id?: string;
  displayName?: { text?: string };
  websiteUri?: string;
  formattedAddress?: string;
  primaryType?: string;
  types?: string[];
  regularOpeningHours?: {
    periods?: { close?: { hour?: number } }[];
  };
};

function latestCloseHour(place: NewPlace): number | null {
  const hours = (place.regularOpeningHours?.periods ?? [])
    .map((p) => p.close?.hour)
    .filter((h): h is number => h != null && Number.isFinite(h));
  if (!hours.length) return null;
  return Math.max(...hours.map((h) => (h === 0 ? 24 : h)));
}

function stripPlacePrefix(id: string): string {
  return id.replace(/^places\//, "");
}

async function searchNearbyNew(
  lat: number,
  lng: number,
  radiusMeters: number,
  apiKey: string,
): Promise<PlaceHit[] | null> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.websiteUri,places.formattedAddress,places.primaryType,places.types,places.regularOpeningHours",
    },
    body: JSON.stringify({
      includedTypes: ["bar", "pub"],
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusMeters,
        },
      },
    }),
  });
  if (res.status === 403 || res.status === 404 || res.status === 400) return null;
  if (!res.ok) return null;
  const body = (await res.json()) as { places?: NewPlace[] };
  return (body.places ?? [])
    .map((p): PlaceHit | null => {
      const placeId = p.id ? stripPlacePrefix(p.id) : "";
      const name = p.displayName?.text?.trim() ?? "";
      if (!placeId || !name) return null;
      return {
        placeId,
        name,
        website: p.websiteUri?.trim() || null,
        address: p.formattedAddress?.trim() || null,
        types: p.types ?? [],
        primaryType: p.primaryType ?? null,
        latestCloseHour: latestCloseHour(p),
      };
    })
    .filter((p): p is PlaceHit => p != null);
}

type LegacyPlace = {
  place_id?: string;
  name?: string;
  vicinity?: string;
  types?: string[];
};

async function placeDetailsWebsite(placeId: string, apiKey: string): Promise<string | null> {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: "website",
    key: apiKey,
  });
  const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { result?: { website?: string } };
  return body.result?.website?.trim() || null;
}

async function searchNearbyLegacy(
  lat: number,
  lng: number,
  radiusMeters: number,
  apiKey: string,
): Promise<PlaceHit[]> {
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: String(radiusMeters),
    type: "bar",
    key: apiKey,
  });
  const res = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { status?: string; results?: LegacyPlace[]; error_message?: string };
  if (body.status && body.status !== "OK" && body.status !== "ZERO_RESULTS") {
    throw new Error(body.error_message || "Places Nearby is not enabled on this Maps API key.");
  }
  const basics = (body.results ?? [])
    .map((p) => ({
      placeId: p.place_id ?? "",
      name: p.name?.trim() ?? "",
      address: p.vicinity?.trim() || null,
      types: p.types ?? [],
      primaryType: p.types?.[0] ?? null,
      latestCloseHour: null as number | null,
    }))
    .filter((p) => p.placeId && p.name)
    .slice(0, 20);

  const websites = await Promise.all(basics.map((p) => placeDetailsWebsite(p.placeId, apiKey)));
  return basics.map((p, i) => ({ ...p, website: websites[i] }));
}

export async function searchNearbyPubs(opts: {
  lat: number;
  lng: number;
  radiusMeters: number;
  apiKey: string;
}): Promise<PlaceHit[]> {
  const modern = await searchNearbyNew(opts.lat, opts.lng, opts.radiusMeters, opts.apiKey);
  if (modern && modern.length > 0) return modern;
  return searchNearbyLegacy(opts.lat, opts.lng, opts.radiusMeters, opts.apiKey);
}
