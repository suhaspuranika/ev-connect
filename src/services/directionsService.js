import { MAPBOX_ACCESS_TOKEN } from "../config.js";

/**
 * Fetch a driving route between two points using the Mapbox Directions API.
 *
 * @param {{ latitude: number, longitude: number }} from
 * @param {{ latitude: number, longitude: number }} to
 * @returns {Promise<{ geometry: object, distance: number, duration: number }>}
 *   geometry is GeoJSON LineString; distance in meters; duration in seconds.
 */
export async function getRoute(from, to) {
  const coords = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
    `?alternatives=false&geometries=geojson&overview=full&steps=false` +
    `&access_token=${MAPBOX_ACCESS_TOKEN}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Directions request failed (${response.status})`);
  }

  const data = await response.json();
  const route = data.routes?.[0];
  if (!route) {
    throw new Error("No route found to this station.");
  }

  return {
    geometry: route.geometry,
    distance: route.distance,
    duration: route.duration,
  };
}

/**
 * Build a URL that opens turn-by-turn navigation in the device's maps app.
 * Uses Apple Maps on iOS/macOS, Google Maps elsewhere.
 */
export function externalDirectionsUrl(from, to) {
  const isApple =
    typeof navigator !== "undefined" &&
    /iP(hone|ad|od)|Macintosh/.test(navigator.userAgent);

  if (isApple) {
    return `https://maps.apple.com/?saddr=${from.latitude},${from.longitude}&daddr=${to.latitude},${to.longitude}&dirflg=d`;
  }
  return `https://www.google.com/maps/dir/?api=1&origin=${from.latitude},${from.longitude}&destination=${to.latitude},${to.longitude}&travelmode=driving`;
}
