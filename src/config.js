// App configuration and API keys.
//
// Keys are read from Vite environment variables (import.meta.env). Define them
// in a local `.env` file (see `.env.example`) and, for deployment, in your
// hosting provider's environment settings (e.g. Vercel Project Settings).
//
// NOTE: `VITE_`-prefixed vars are embedded into the client bundle at build time,
// so they are still visible in the browser. Restrict these keys by HTTP referrer
// / domain in the Google Cloud Console and Mapbox account for production.

export const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

export const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

if (!GOOGLE_PLACES_API_KEY || !MAPBOX_ACCESS_TOKEN) {
  // Surface a clear message during dev/build if the env vars are missing.
  console.warn(
    "[config] Missing VITE_GOOGLE_PLACES_API_KEY or VITE_MAPBOX_ACCESS_TOKEN. " +
      "Copy .env.example to .env and fill in your keys."
  );
}

// Google Places Nearby Search (New) endpoint
export const PLACES_SEARCH_NEARBY_URL =
  "https://places.googleapis.com/v1/places:searchNearby";

// Field mask requesting the richer set of fields used across the UI.
export const PLACES_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.location",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.primaryTypeDisplayName",
  "places.businessStatus",
  "places.rating",
  "places.userRatingCount",
  "places.currentOpeningHours",
  "places.regularOpeningHours",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.googleMapsLinks",
  "places.paymentOptions",
  "places.evChargeOptions",
].join(",");

// Default search radius in meters
export const DEFAULT_SEARCH_RADIUS = 5000;

// Fallback location (Bengaluru - Banashankari) used if geolocation is denied/unavailable
export const FALLBACK_LOCATION = {
  latitude: 12.9241993,
  longitude: 77.5523184,
};
