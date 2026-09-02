import { haversineKm } from "./helpers";

export const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_KEY;
export const OPENCAGE_API_KEY = process.env.EXPO_PUBLIC_OPENCAGE_API_KEY;

const DIRECTIONS_BASE_URL =
  "https://api.mapbox.com/directions/v5/mapbox/driving";
const OPENCAGE_BASE_URL = "https://api.opencagedata.com/geocode/v1/json";

export async function forwardGeocode(query, opts = {}) {
  if (!query || query.trim().length < 2) return [];
  if (!OPENCAGE_API_KEY) {
    console.error(
      "[OpenCage] Missing API key — set EXPO_PUBLIC_OPENCAGE_API_KEY in .env",
    );
    return [];
  }

  const params = new URLSearchParams({
    key: OPENCAGE_API_KEY,
    q: query,
    limit: String(opts.limit || 5),
    no_annotations: "1",
  });

  if (opts.proximity) {
    // opts.proximity is [longitude, latitude] to match existing Mapbox call sites
    params.append("proximity", `${opts.proximity[1]},${opts.proximity[0]}`);
  }
  if (opts.country) {
    params.append("countrycode", opts.country);
  }

  const url = `${OPENCAGE_BASE_URL}?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`OpenCage forward geocode failed: ${res.status}`);
  const data = await res.json();

  return (data.results || []).map((r) => ({
    id: r.annotations?.geohash || `${r.geometry.lat},${r.geometry.lng}`,
    name: r.components?.name || r.components?.road || r.formatted.split(",")[0],
    address: r.formatted,
    latitude: r.geometry.lat,
    longitude: r.geometry.lng,
  }));
}

export async function reverseGeocode(latitude, longitude) {
  if (!OPENCAGE_API_KEY) {
    console.error("[OpenCage] Missing API key");
    return {
      name: "Dropped pin",
      address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    };
  }

  const params = new URLSearchParams({
    key: OPENCAGE_API_KEY,
    q: `${latitude},${longitude}`,
    limit: "1",
    no_annotations: "1",
  });

  const url = `${OPENCAGE_BASE_URL}?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`OpenCage reverse geocode failed: ${res.status}`);
  const data = await res.json();

  const result = data.results?.[0];
  if (!result) {
    return {
      name: "Dropped pin",
      address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    };
  }

  return {
    name:
      result.components?.name ||
      result.components?.road ||
      result.formatted.split(",")[0] ||
      "Dropped pin",
    address:
      result.formatted || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
  };
}

/**
 * Get driving directions between ordered stops.
 * Accepts stops in two shapes:
 *   - { latitude, longitude }           (flat — from CreateRouteScreen old util)
 *   - { location: { latitude, longitude } } (nested — from VehicleRoutesSlice stop shape)
 */
export async function getRouteDirections(stops) {
  if (!MAPBOX_ACCESS_TOKEN) {
    console.error("[Mapbox] Missing access token");
    return { durationMins: 0, distanceKm: 0, geometry: null };
  }
  if (!stops || stops.length < 2) {
    return { durationMins: 0, distanceKm: 0, geometry: null };
  }

  const coordString = stops
    .map((s) => {
      // Support both flat { latitude, longitude } and nested { location: { ... } }
      const lat = s.latitude ?? s.location?.latitude;
      const lng = s.longitude ?? s.location?.longitude;
      return `${lng},${lat}`;
    })
    .join(";");

  const url = `${DIRECTIONS_BASE_URL}/${coordString}?geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_ACCESS_TOKEN}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Mapbox directions failed: ${res.status}`);
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) return { durationMins: 0, distanceKm: 0, geometry: null };

    const coordinates = route.geometry.coordinates.map((coord) => ({
      longitude: coord[0],
      latitude: coord[1],
    }));

    return {
      durationMins: Math.ceil(route.duration / 60),
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      geometry: route.geometry,
      coordinates: coordinates,
      legs: route.legs || [],
    };
  } catch (error) {
    console.error("[Mapbox] Directions error:", error);
    return { durationMins: 0, distanceKm: 0, geometry: null, coordinates: [] };
  }
}

export async function getRouteFromCurrentPosition(
  currentLat,
  currentLng,
  destinationLat,
  destinationLng,
) {
  if (!MAPBOX_ACCESS_TOKEN) {
    console.error("[Mapbox] Missing access token");
    return { durationMins: 0, distanceKm: 0, geometry: null, coordinates: [] };
  }

  const coordString = `${currentLng},${currentLat};${destinationLng},${destinationLat}`;

  const url = `${DIRECTIONS_BASE_URL}/${coordString}?geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_ACCESS_TOKEN}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Mapbox directions failed: ${res.status}`);
    const data = await res.json();
    const route = data.routes?.[0];

    if (!route)
      return {
        durationMins: 0,
        distanceKm: 0,
        geometry: null,
        coordinates: [],
      };

    const coordinates = route.geometry.coordinates.map((coord) => ({
      longitude: coord[0],
      latitude: coord[1],
    }));

    return {
      durationMins: Math.ceil(route.duration / 60),
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      geometry: route.geometry,
      coordinates: coordinates,
    };
  } catch (error) {
    console.error("[Mapbox] Directions error:", error);
    return {
      durationMins: 0,
      distanceKm: 0,
      geometry: null,
      coordinates: [],
    };
  }
}

export function distanceToPolyline(point, polylineCoords) {
  if (!polylineCoords || polylineCoords.length < 2) return Infinity;

  let minDist = Infinity;

  for (let i = 0; i < polylineCoords.length - 1; i++) {
    const p1 = polylineCoords[i];
    const p2 = polylineCoords[i + 1];
    const dist = distanceToSegment(point, p1, p2);
    if (dist < minDist) minDist = dist;
  }

  return minDist;
}

function distanceToSegment(point, segStart, segEnd) {
  const { latitude: lat, longitude: lng } = point;
  const { latitude: lat1, longitude: lng1 } = segStart;
  const { latitude: lat2, longitude: lng2 } = segEnd;

  // Convert to radians
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lng1Rad = (lng1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const lng2Rad = (lng2 * Math.PI) / 180;

  // Calculate using haversine formula for accurate distances
  const R = 6371; // Earth's radius in km

  // Project point onto line segment using spherical geometry
  const dLng = lng2Rad - lng1Rad;
  const dLat = lat2Rad - lat1Rad;

  // Calculate bearing
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  const bearing = Math.atan2(y, x);

  // Calculate distance from point to segment start
  const dLngStart = lngRad - lng1Rad;
  const dLatStart = latRad - lat1Rad;
  const distStart =
    Math.acos(
      Math.sin(lat1Rad) * Math.sin(latRad) +
        Math.cos(lat1Rad) * Math.cos(latRad) * Math.cos(dLngStart),
    ) * R;

  // Calculate angle between bearing and point direction
  const bearingToPoint = Math.atan2(
    Math.sin(dLngStart) * Math.cos(latRad),
    Math.cos(lat1Rad) * Math.sin(latRad) -
      Math.sin(lat1Rad) * Math.cos(latRad) * Math.cos(dLngStart),
  );

  const angleDiff = bearingToPoint - bearing;
  const perpDistance = Math.abs(Math.sin(angleDiff) * distStart);

  // Check if point projects onto the segment
  const projDistance = Math.cos(angleDiff) * distStart;
  if (projDistance < 0 || projDistance > distStart + R * 0.1) {
    return Math.min(
      haversineKm(lat, lng, lat1, lng1),
      haversineKm(lat, lng, lat2, lng2),
    );
  }

  return perpDistance;
}
