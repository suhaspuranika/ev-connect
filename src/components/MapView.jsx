import { useEffect, useRef, useState, useCallback } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import mapboxgl from "mapbox-gl";
import { MAPBOX_ACCESS_TOKEN } from "../config.js";
import { summarizeEvOptions } from "../utils.js";
import { MdBolt, MdMyLocation, FaPlane, FaPause } from "../icons.js";

mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

// Pre-render the marker glyph (a bolt) to an SVG string for use in DOM markers.
const BOLT_SVG = renderToStaticMarkup(<MdBolt />);

// Autopilot orbit speed, in degrees of bearing change per second.
const AUTOPILOT_DEG_PER_SEC = 6;

/**
 * 3D Mapbox map showing the user's location and EV charging stations.
 * Renders in a tilted "bird's-eye" 3D view with extruded buildings.
 *
 * Autopilot: a cinematic camera that slowly orbits the current view for a
 * bird's-eye fly-around. It pauses automatically when the user interacts
 * with the map and resumes when re-enabled.
 */
export default function MapView({
  userLocation,
  stations,
  selectedId,
  onSelect,
  route,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const loadedRef = useRef(false);

  // Autopilot state + animation refs
  const [autopilot, setAutopilot] = useState(false);
  const autopilotRef = useRef(false);
  const rafRef = useRef(null);
  const lastTsRef = useRef(0);

  // Initialize the map once.
  useEffect(() => {
    if (mapRef.current || !containerRef.current || !userLocation) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/standard",
      center: [userLocation.longitude, userLocation.latitude],
      zoom: 16, // closer in so 3D buildings are prominent
      pitch: 62, // tilt for the 3D bird's-eye perspective
      bearing: -20,
      antialias: true,
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new mapboxgl.FullscreenControl(), "top-right");

    // Pause autopilot as soon as the user grabs the map with pointer/wheel.
    const pauseOnInteract = () => {
      if (autopilotRef.current) setAutopilot(false);
    };
    map.on("mousedown", pauseOnInteract);
    map.on("touchstart", pauseOnInteract);
    map.on("wheel", pauseOnInteract);
    map.on("dragstart", pauseOnInteract);

    map.on("style.load", () => {
      loadedRef.current = true;

      // Mapbox Standard ships 3D buildings/landmarks + lighting presets.
      // Use a bright daytime preset so the scene reads clearly (the previous
      // "dusk" preset made everything look near-black).
      try {
        map.setConfigProperty("basemap", "lightPreset", "day");
        // Make sure 3D buildings/landmarks and their labels are visible.
        map.setConfigProperty("basemap", "show3dObjects", true);
        map.setConfigProperty("basemap", "showPointOfInterestLabels", true);
        map.setConfigProperty("basemap", "showPlaceLabels", true);
      } catch {
        // Non-standard styles won't support these; ignore.
      }

      // Sky + atmosphere so tilted views don't fall off into a black void.
      try {
        map.setFog({
          range: [1, 12],
          color: "#dfe9f5",
          "high-color": "#a7c6ff",
          "horizon-blend": 0.2,
          "space-color": "#0b1220",
          "star-intensity": 0.0,
        });
      } catch {
        // ignore if the style doesn't support fog
      }

      // Add 3D terrain for extra depth.
      if (!map.getSource("mapbox-dem")) {
        map.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.15 });
      }

      // Empty route source + layers for the "Get directions" line.
      if (!map.getSource("route")) {
        map.addSource("route", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "route-casing",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#0b5c37", "line-width": 9, "line-opacity": 0.9 },
        });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#34d17e", "line-width": 5 },
        });
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation]);

  // Update the user marker + recenter when the user location changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;

    if (userMarkerRef.current) userMarkerRef.current.remove();

    const el = document.createElement("div");
    el.className = "user-marker";
    el.innerHTML =
      `<div class="user-pulse"></div>` +
      `<div class="user-dot">${renderToStaticMarkup(<MdMyLocation />)}</div>`;

    userMarkerRef.current = new mapboxgl.Marker({ element: el })
      .setLngLat([userLocation.longitude, userLocation.latitude])
      .setPopup(new mapboxgl.Popup({ offset: 18 }).setHTML("<strong>You are here</strong>"))
      .addTo(map);

    map.flyTo({
      center: [userLocation.longitude, userLocation.latitude],
      zoom: 15,
      pitch: 60,
      essential: true,
    });
  }, [userLocation]);

  // Render station markers whenever the station list changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    stations.forEach((place) => {
      if (!place.location) return;
      const { latitude, longitude } = place.location;

      const el = document.createElement("div");
      el.className = "station-marker";
      el.setAttribute("data-id", place.id);
      el.innerHTML = `<span class="bolt">${BOLT_SVG}</span>`;

      const ev = summarizeEvOptions(place);
      const evLine = ev
        ? `<div class="popup-ev">${
            ev.connectorCount != null ? `${ev.connectorCount} connectors` : ""
          }${ev.maxKw != null ? ` &middot; up to ${ev.maxKw} kW` : ""}</div>`
        : "";

      const open = place.currentOpeningHours?.openNow;
      const openLine =
        typeof open === "boolean"
          ? `<div class="popup-open ${open ? "is-open" : "is-closed"}">${
              open ? "Open now" : "Closed"
            }</div>`
          : "";

      const popup = new mapboxgl.Popup({ offset: 24 }).setHTML(
        `<div class="popup">
           <strong>${place.displayName?.text ?? "Charging station"}</strong>
           ${openLine}
           <div class="popup-addr">${
             place.shortFormattedAddress ?? place.formattedAddress ?? ""
           }</div>
           ${evLine}
         </div>`
      );

      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([longitude, latitude])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener("click", () => {
        onSelect?.(place.id);
      });

      markersRef.current.push(marker);
    });
  }, [stations, onSelect]);

  // --- Autopilot orbit loop ---
  const stepAutopilot = useCallback((ts) => {
    const map = mapRef.current;
    if (!map || !autopilotRef.current) return;

    if (!lastTsRef.current) lastTsRef.current = ts;
    const dt = (ts - lastTsRef.current) / 1000; // seconds
    lastTsRef.current = ts;

    // Advance the bearing to orbit the current center.
    const nextBearing = map.getBearing() + AUTOPILOT_DEG_PER_SEC * dt;
    map.setBearing(nextBearing);

    rafRef.current = requestAnimationFrame(stepAutopilot);
  }, []);

  // Start/stop the loop when autopilot is toggled.
  useEffect(() => {
    autopilotRef.current = autopilot;
    const map = mapRef.current;

    if (autopilot && map) {
      // Ease into a nice cinematic pitch/zoom for the fly-around.
      map.easeTo({ pitch: 70, duration: 1200, essential: true });
      lastTsRef.current = 0;
      rafRef.current = requestAnimationFrame(stepAutopilot);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = 0;
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [autopilot, stepAutopilot]);

  // Fly to a selected station and open its popup.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;

    // Selecting a specific station takes over the camera, so stop orbiting.
    if (autopilotRef.current) setAutopilot(false);

    const place = stations.find((p) => p.id === selectedId);
    if (!place?.location) return;

    map.flyTo({
      center: [place.location.longitude, place.location.latitude],
      zoom: 17,
      pitch: 65,
      essential: true,
    });

    const marker = markersRef.current.find(
      (m) => m.getElement().getAttribute("data-id") === selectedId
    );
    marker?.togglePopup();
  }, [selectedId, stations]);

  // Draw / clear the route line when the route prop changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyRoute = () => {
      const src = map.getSource("route");
      if (!src) return;

      if (!route?.geometry) {
        src.setData({ type: "FeatureCollection", features: [] });
        return;
      }

      // A directed route takes over the camera; stop orbiting.
      if (autopilotRef.current) setAutopilot(false);

      src.setData({
        type: "Feature",
        properties: {},
        geometry: route.geometry,
      });

      // Fit the map to the route bounds with a bird's-eye tilt.
      const coords = route.geometry.coordinates;
      if (coords?.length) {
        const bounds = coords.reduce(
          (b, c) => b.extend(c),
          new mapboxgl.LngLatBounds(coords[0], coords[0])
        );
        map.fitBounds(bounds, {
          padding: { top: 100, bottom: 220, left: 60, right: 60 },
          pitch: 55,
          duration: 1200,
        });
      }
    };

    if (map.isStyleLoaded() && map.getSource("route")) {
      applyRoute();
    } else {
      map.once("idle", applyRoute);
    }
  }, [route]);

  return (
    <div className="map-wrap">
      <div className="map-container" ref={containerRef} />
      <button
        className={`autopilot-btn${autopilot ? " active" : ""}`}
        onClick={() => setAutopilot((v) => !v)}
        title={autopilot ? "Stop autopilot" : "Start autopilot fly-around"}
      >
        <span className="autopilot-icon">
          {autopilot ? <FaPause /> : <FaPlane />}
        </span>
        <span className="autopilot-label">
          {autopilot ? "Autopilot on" : "Autopilot"}
        </span>
      </button>
    </div>
  );
}
