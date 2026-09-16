// Small helpers used across the app.

/**
 * Haversine distance between two lat/lng points, in kilometers.
 */
export function distanceKm(a, b) {
  const R = 6371; // km
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Format a distance in km into a friendly string.
 */
export function formatDistance(km) {
  if (km == null || Number.isNaN(km)) return "";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/**
 * Format a duration in seconds into a friendly string (e.g. "12 min", "1 h 5 min").
 */
export function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return "";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// Known charging networks, matched against the place name (order matters:
// more specific labels first).
const KNOWN_NETWORKS = [
  { label: "ElectricPe", match: ["electricpe"] },
  { label: "Ather Grid", match: ["ather"] },
  { label: "BESCOM", match: ["bescom"] },
  { label: "Bolt.Earth", match: ["bolt.earth", "bolt earth", "bolt"] },
  { label: "Delta", match: ["delta"] },
  { label: "Suzuki", match: ["suzuki"] },
  { label: "Tata Power", match: ["tata"] },
  { label: "Statiq", match: ["statiq"] },
  { label: "ChargeZone", match: ["chargezone"] },
];

/**
 * Guess the charging network/brand from a place display name.
 * Returns a known network label or "Other".
 */
export function detectNetwork(place) {
  const name = (place?.displayName?.text ?? "").toLowerCase();
  for (const net of KNOWN_NETWORKS) {
    if (net.match.some((m) => name.includes(m))) return net.label;
  }
  return "Other";
}

/**
 * Whether a place is currently open, based on Places opening-hours fields.
 * Returns true | false | null (unknown).
 */
export function isOpenNow(place) {
  const cur = place?.currentOpeningHours?.openNow;
  if (typeof cur === "boolean") return cur;
  const reg = place?.regularOpeningHours?.openNow;
  if (typeof reg === "boolean") return reg;
  return null;
}

/**
 * Normalized business status: "OPERATIONAL" | "CLOSED_TEMPORARILY" |
 * "CLOSED_PERMANENTLY" | null.
 */
export function businessStatus(place) {
  return place?.businessStatus ?? null;
}

/**
 * A short human label for a place's rating, or null when unrated.
 */
export function ratingSummary(place) {
  if (typeof place?.rating !== "number") return null;
  return {
    rating: place.rating,
    count: place.userRatingCount ?? 0,
  };
}

/**
 * The best phone number to call, if any.
 */
export function phoneNumber(place) {
  return place?.internationalPhoneNumber || place?.nationalPhoneNumber || null;
}

/**
 * Build a sorted, de-duplicated list of networks present in the given places.
 */
export function collectNetworks(places) {
  const set = new Set();
  for (const p of places) set.add(detectNetwork(p));
  return Array.from(set).sort();
}

// Human-friendly labels for the Places EV connector type enum.
const CONNECTOR_TYPE_LABELS = {
  EV_CONNECTOR_TYPE_TYPE_2: "Type 2",
  EV_CONNECTOR_TYPE_CCS_COMBO_1: "CCS1",
  EV_CONNECTOR_TYPE_CCS_COMBO_2: "CCS2",
  EV_CONNECTOR_TYPE_CHADEMO: "CHAdeMO",
  EV_CONNECTOR_TYPE_TESLA: "Tesla",
  EV_CONNECTOR_TYPE_J1772: "J1772",
  EV_CONNECTOR_TYPE_UNSPECIFIED_GB_T: "GB/T",
  EV_CONNECTOR_TYPE_UNSPECIFIED_WALL_OUTLET: "Wall outlet",
  EV_CONNECTOR_TYPE_TYPE_3C: "Type 3C",
  EV_CONNECTOR_TYPE_OTHER: "Other",
  EV_CONNECTOR_TYPE_UNSPECIFIED: "Unspecified",
};

function connectorTypeLabel(type) {
  if (!type) return "Connector";
  return (
    CONNECTOR_TYPE_LABELS[type] ||
    type.replace("EV_CONNECTOR_TYPE_", "").replaceAll("_", " ")
  );
}

/**
 * Summarize EV charge options from a Google place (if present).
 *
 * Returns null when there is no evChargeOptions data, otherwise:
 * {
 *   connectorCount,        // total ports at the site
 *   maxKw,                 // fastest charge rate across aggregations
 *   availableCount,        // ports currently free (null if not reported)
 *   inUseCount,            // ports currently in use (derived)
 *   outOfServiceCount,     // ports out of service
 *   hasAvailability,       // whether availability data is present
 *   connectors: [          // per connector-type breakdown
 *     { type, label, maxKw, count, availableCount, inUseCount, outOfServiceCount }
 *   ]
 * }
 */
export function summarizeEvOptions(place) {
  const opts = place?.evChargeOptions;
  if (!opts) return null;

  const connectorCount = opts.connectorCount ?? null;
  let maxKw = null;

  let totalAvailable = null;
  let totalOutOfService = null;
  let sumTypeCounts = 0;
  const connectors = [];

  if (Array.isArray(opts.connectorAggregation)) {
    for (const agg of opts.connectorAggregation) {
      if (typeof agg.maxChargeRateKw === "number") {
        maxKw = Math.max(maxKw ?? 0, agg.maxChargeRateKw);
      }

      const count = typeof agg.count === "number" ? agg.count : null;
      const availableCount =
        typeof agg.availableCount === "number" ? agg.availableCount : null;
      const outOfServiceCount =
        typeof agg.outOfServiceCount === "number"
          ? agg.outOfServiceCount
          : null;

      if (count != null) sumTypeCounts += count;
      if (availableCount != null)
        totalAvailable = (totalAvailable ?? 0) + availableCount;
      if (outOfServiceCount != null)
        totalOutOfService = (totalOutOfService ?? 0) + outOfServiceCount;

      // in-use = total - available - out of service (when we can compute it)
      let inUseCount = null;
      if (count != null && availableCount != null) {
        inUseCount = Math.max(0, count - availableCount - (outOfServiceCount ?? 0));
      }

      connectors.push({
        type: agg.type ?? null,
        label: connectorTypeLabel(agg.type),
        maxKw: typeof agg.maxChargeRateKw === "number" ? agg.maxChargeRateKw : null,
        count,
        availableCount,
        inUseCount,
        outOfServiceCount,
      });
    }
  }

  const hasAvailability = totalAvailable != null;
  // Prefer the site connectorCount, fall back to the sum of per-type counts.
  const totalPorts = connectorCount ?? (sumTypeCounts || null);

  let inUseCount = null;
  if (hasAvailability && totalPorts != null) {
    inUseCount = Math.max(
      0,
      totalPorts - totalAvailable - (totalOutOfService ?? 0)
    );
  }

  return {
    connectorCount: totalPorts,
    maxKw,
    availableCount: totalAvailable,
    inUseCount,
    outOfServiceCount: totalOutOfService,
    hasAvailability,
    connectors,
  };
}
