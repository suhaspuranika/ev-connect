import { useState, useCallback } from "react";
import { FALLBACK_LOCATION } from "../config.js";

/**
 * Hook to get the user's current location via the Geolocation API.
 * Falls back to a default location if permission is denied or unavailable.
 */
export function useGeolocation() {
  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | locating | success | fallback | error
  const [error, setError] = useState(null);

  const locate = useCallback(() => {
    setStatus("locating");
    setError(null);

    if (!("geolocation" in navigator)) {
      setLocation(FALLBACK_LOCATION);
      setStatus("fallback");
      setError("Geolocation is not supported by this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setStatus("success");
      },
      (geoError) => {
        // Use fallback location so the app is still usable
        setLocation(FALLBACK_LOCATION);
        setStatus("fallback");
        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Location permission denied. Showing a default area."
            : "Couldn't get your location. Showing a default area."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  return { location, status, error, locate };
}
