import {
  GOOGLE_PLACES_API_KEY,
  PLACES_SEARCH_NEARBY_URL,
  PLACES_FIELD_MASK,
  DEFAULT_SEARCH_RADIUS,
} from "../config.js";

/**
 * Search for EV charging stations near a given location using the
 * Google Places API (New) searchNearby endpoint.
 *
 * @param {{ latitude: number, longitude: number }} location
 * @param {number} [radius] radius in meters
 * @returns {Promise<Array>} array of place objects
 */
export async function searchNearbyChargingStations(
  location,
  radius = DEFAULT_SEARCH_RADIUS
) {
  const body = {
    // "electric_vehicle_charging_station" is the Places (New) type for EV chargers
    includedTypes: ["electric_vehicle_charging_station"],
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        radius,
      },
    },
  };

  const response = await fetch(PLACES_SEARCH_NEARBY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": PLACES_FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const err = await response.json();
      detail = err?.error?.message || JSON.stringify(err);
    } catch {
      detail = await response.text();
    }
    throw new Error(
      `Places API request failed (${response.status}): ${detail}`
    );
  }

  const data = await response.json();
  return data.places || [];
}
