import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import MapView from "./components/MapView.jsx";
import StationList from "./components/StationList.jsx";
import FilterBar from "./components/FilterBar.jsx";
import Splash from "./components/Splash.jsx";
import { useGeolocation } from "./hooks/useGeolocation.js";
import { useBottomSheet } from "./hooks/useBottomSheet.js";
import { searchNearbyChargingStations } from "./services/placesService.js";
import { getRoute, externalDirectionsUrl } from "./services/directionsService.js";
import { DEFAULT_SEARCH_RADIUS } from "./config.js";
import {
  collectNetworks,
  detectNetwork,
  summarizeEvOptions,
  isOpenNow,
} from "./utils.js";
import {
  MdBolt,
  MdRefresh,
  MdKeyboardArrowUp,
  MdKeyboardArrowDown,
} from "./icons.js";

export default function App() {
  const { location, status: geoStatus, error: geoError, locate } =
    useGeolocation();

  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  // Bottom sheet: 0=full, 1=half, 2=collapsed. Start at half.
  const sheet = useBottomSheet({ snapPoints: [0.08, 0.45, 0.9], initial: 1 });

  // Filters
  const [network, setNetwork] = useState("all");
  const [minKw, setMinKw] = useState(0);
  const [openNow, setOpenNow] = useState(false);

  // Directions
  const [route, setRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(null);

  // Splash screen: visible on boot, fades out after the first data settles
  // (with a minimum on-screen time so the gif isn't a flash).
  const [showSplash, setShowSplash] = useState(true);
  const [splashHiding, setSplashHiding] = useState(false);
  const mountedAt = useRef(Date.now());
  const firstLoadDone = useRef(false);

  const dismissSplash = useCallback(() => {
    const MIN_MS = 1800;
    const elapsed = Date.now() - mountedAt.current;
    const wait = Math.max(0, MIN_MS - elapsed);
    setTimeout(() => setSplashHiding(true), wait);
  }, []);

  // Kick off geolocation on mount.
  useEffect(() => {
    locate();
  }, [locate]);

  // Safety net: never let the splash hang if something stalls.
  useEffect(() => {
    const t = setTimeout(() => setSplashHiding(true), 8000);
    return () => clearTimeout(t);
  }, []);

  // When we have a location, fetch nearby charging stations.
  const fetchStations = useCallback(async (loc) => {
    if (!loc) return;
    setLoading(true);
    setApiError(null);
    try {
      const results = await searchNearbyChargingStations(
        loc,
        DEFAULT_SEARCH_RADIUS
      );
      setStations(results);
    } catch (err) {
      setApiError(err.message || "Failed to load charging stations.");
      setStations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (location) {
      fetchStations(location).finally(() => {
        if (!firstLoadDone.current) {
          firstLoadDone.current = true;
          dismissSplash();
        }
      });
    }
  }, [location, fetchStations, dismissSplash]);

  // Available networks derived from the raw results.
  const networks = useMemo(() => collectNetworks(stations), [stations]);

  // Apply the active filters.
  const filteredStations = useMemo(() => {
    return stations.filter((place) => {
      if (network !== "all" && detectNetwork(place) !== network) return false;
      if (openNow && isOpenNow(place) !== true) return false;
      if (minKw > 0) {
        const ev = summarizeEvOptions(place);
        if (!ev || ev.maxKw == null || ev.maxKw < minKw) return false;
      }
      return true;
    });
  }, [stations, network, minKw, openNow]);

  // Clear any drawn route when filters change.
  useEffect(() => {
    setRoute(null);
    setRouteError(null);
  }, [network, minKw, openNow]);

  const handleSelect = (id) => {
    setSelectedId(id);
    setRoute(null);
    setRouteError(null);
    // Bring the sheet to the half snap so the selected card + actions are visible.
    if (sheet.snapIndex === 2) sheet.setSnapIndex(1);
  };

  const handleGetDirections = useCallback(
    async (place) => {
      if (!location || !place?.location) return;
      setRouteLoading(true);
      setRouteError(null);
      setRoute(null);
      try {
        const result = await getRoute(location, place.location);
        setRoute(result);
      } catch (err) {
        setRouteError(err.message || "Couldn't get directions.");
      } finally {
        setRouteLoading(false);
      }
    },
    [location]
  );

  const handleOpenExternal = useCallback(
    (place) => {
      if (!location || !place?.location) return;
      const url = externalDirectionsUrl(location, place.location);
      window.open(url, "_blank", "noopener,noreferrer");
    },
    [location]
  );

  return (
    <div className="app">
      {showSplash && (
        <Splash
          hiding={splashHiding}
          onHidden={() => setShowSplash(false)}
        />
      )}

      {location && (
        <MapView
          userLocation={location}
          stations={filteredStations}
          selectedId={selectedId}
          onSelect={handleSelect}
          route={route}
        />
      )}

      {/* Header */}
      <header className="app-header">
        <div className="brand">
          <span className="brand-bolt">
            <MdBolt />
          </span>
          <span>EV Charger Finder</span>
        </div>
        <button
          className="refresh-btn"
          onClick={() => location && fetchStations(location)}
          disabled={loading || !location}
          title="Refresh nearby stations"
        >
          <MdRefresh className={`refresh-icon${loading ? " spin" : ""}`} />
          <span className="refresh-label">
            {loading ? "Searching" : "Refresh"}
          </span>
        </button>
      </header>

      {/* Status banners */}
      {geoStatus === "locating" && !location && (
        <div className="banner">Finding your location...</div>
      )}
      {geoError && <div className="banner warn">{geoError}</div>}
      {apiError && <div className="banner error">{apiError}</div>}

      {/* Bottom sheet (mobile) / side drawer (desktop) */}
      <section
        className={`sheet${sheet.dragging ? " dragging" : ""}`}
        style={{ transform: `translateY(${sheet.translateY}px)` }}
      >
        <div
          className="sheet-header"
          {...sheet.handlers}
          onClick={() =>
            sheet.setSnapIndex(sheet.snapIndex === 0 ? 1 : 0)
          }
        >
          <span className="grabber" />
          <div className="sheet-title-row">
            <span className="panel-title">
              {loading
                ? "Searching nearby…"
                : `${filteredStations.length} ${
                    filteredStations.length === 1 ? "station" : "stations"
                  } nearby`}
            </span>
            <span className="panel-chevron">
              {sheet.snapIndex === 0 ? (
                <MdKeyboardArrowDown />
              ) : (
                <MdKeyboardArrowUp />
              )}
            </span>
          </div>
        </div>

        {!loading && stations.length > 0 && (
          <FilterBar
            networks={networks}
            network={network}
            onNetworkChange={setNetwork}
            minKw={minKw}
            onMinKwChange={setMinKw}
            openNow={openNow}
            onOpenNowChange={setOpenNow}
            resultCount={filteredStations.length}
          />
        )}

        <div className="panel-content">
          {loading && stations.length === 0 ? (
            <div className="list-empty">
              <span className="spinner" />
              <p>Loading charging stations…</p>
            </div>
          ) : (
            <StationList
              stations={filteredStations}
              userLocation={location}
              selectedId={selectedId}
              onSelect={handleSelect}
              onGetDirections={handleGetDirections}
              onOpenExternal={handleOpenExternal}
              route={route}
              routeLoading={routeLoading}
              routeError={routeError}
            />
          )}
        </div>
      </section>
    </div>
  );
}
