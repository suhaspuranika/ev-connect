import {
  distanceKm,
  formatDistance,
  formatDuration,
  summarizeEvOptions,
  isOpenNow,
  businessStatus,
  ratingSummary,
  phoneNumber,
} from "../utils.js";
import {
  MdEvStation,
  MdStar,
  MdAccessTime,
  MdPhone,
  MdLanguage,
  MdDirectionsCar,
  MdOpenInNew,
  MdNavigation,
  MdPower,
  MdBolt,
} from "../icons.js";

/**
 * Scrollable list of nearby charging stations, sorted by distance.
 * The selected station expands to show details + directions actions.
 */
export default function StationList({
  stations,
  userLocation,
  selectedId,
  onSelect,
  onGetDirections,
  onOpenExternal,
  route,
  routeLoading,
  routeError,
}) {
  const withDistance = stations
    .map((place) => {
      const dist =
        userLocation && place.location
          ? distanceKm(userLocation, place.location)
          : null;
      return { place, dist };
    })
    .sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity));

  if (stations.length === 0) {
    return (
      <div className="list-empty">
        <MdEvStation className="empty-icon" />
        <p>No charging stations match your filters.</p>
      </div>
    );
  }

  return (
    <ul className="station-list">
      {withDistance.map(({ place, dist }) => {
        const ev = summarizeEvOptions(place);
        const active = place.id === selectedId;
        const open = isOpenNow(place);
        const status = businessStatus(place);
        const rating = ratingSummary(place);
        const phone = phoneNumber(place);
        const closedTemp = status === "CLOSED_TEMPORARILY";

        return (
          <li key={place.id} className={`station-item${active ? " active" : ""}`}>
            <div className="station-row" onClick={() => onSelect(place.id)}>
              <div className="station-icon">
                <MdEvStation />
              </div>
              <div className="station-body">
                <div className="station-name">
                  {place.displayName?.text ?? "Charging station"}
                </div>

                <div className="station-meta">
                  {rating && (
                    <span className="chip chip-rating">
                      <MdStar />
                      {rating.rating.toFixed(1)}
                      {rating.count > 0 && (
                        <span className="chip-sub">({rating.count})</span>
                      )}
                    </span>
                  )}
                  {open === true && (
                    <span className="chip chip-open">
                      <MdAccessTime />
                      Open
                    </span>
                  )}
                  {open === false && (
                    <span className="chip chip-closed">
                      <MdAccessTime />
                      Closed
                    </span>
                  )}
                  {closedTemp && (
                    <span className="chip chip-warn">Temporarily closed</span>
                  )}
                </div>

                <div className="station-addr">
                  {place.shortFormattedAddress ?? place.formattedAddress}
                </div>

                {ev && (
                  <div className="station-ev">
                    {ev.maxKw != null && (
                      <span className="ev-tag ev-power">
                        <MdBolt />
                        {ev.maxKw} kW
                      </span>
                    )}
                    {ev.connectorCount != null && (
                      <span className="ev-tag">
                        <MdPower />
                        {ev.connectorCount} {ev.connectorCount === 1 ? "port" : "ports"}
                      </span>
                    )}
                    {ev.hasAvailability && (
                      <span className="ev-tag ev-avail">
                        {ev.availableCount} free
                        {ev.inUseCount != null && ` \u00B7 ${ev.inUseCount} in use`}
                      </span>
                    )}
                    {ev.outOfServiceCount > 0 && (
                      <span className="ev-tag ev-oos">
                        {ev.outOfServiceCount} out of service
                      </span>
                    )}
                  </div>
                )}
              </div>

              {dist != null && (
                <div className="station-dist">
                  <MdNavigation className="dist-icon" />
                  {formatDistance(dist)}
                </div>
              )}
            </div>

            {active && ev?.connectors?.length > 0 && (
              <div className="connector-breakdown">
                {ev.connectors.map((c, i) => (
                  <div className="connector-row" key={c.type ?? i}>
                    <span className="connector-type">
                      <MdPower />
                      {c.label}
                    </span>
                    {c.maxKw != null && (
                      <span className="connector-kw">{c.maxKw} kW</span>
                    )}
                    <span className="connector-avail">
                      {c.availableCount != null && c.count != null ? (
                        <>
                          <strong
                            className={c.availableCount > 0 ? "ok" : "none"}
                          >
                            {c.availableCount}
                          </strong>
                          /{c.count} free
                        </>
                      ) : c.count != null ? (
                        <>{c.count} ports</>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {active && (
              <div className="station-actions">
                <button
                  className="dir-btn primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onGetDirections(place);
                  }}
                  disabled={routeLoading}
                >
                  <MdDirectionsCar className="btn-icon" />
                  {routeLoading ? "Routing..." : "Get directions"}
                </button>
                <button
                  className="dir-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenExternal(place);
                  }}
                >
                  <MdOpenInNew className="btn-icon" />
                  Open in Maps
                </button>
                {phone && (
                  <a
                    className="dir-btn"
                    href={`tel:${phone}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MdPhone className="btn-icon" />
                    Call
                  </a>
                )}
                {place.websiteUri && (
                  <a
                    className="dir-btn"
                    href={place.websiteUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MdLanguage className="btn-icon" />
                    Website
                  </a>
                )}

                {route && (
                  <div className="route-info">
                    <MdDirectionsCar className="btn-icon" />
                    {formatDistance(route.distance / 1000)} &middot;{" "}
                    {formatDuration(route.duration)} drive
                  </div>
                )}
                {routeError && <div className="route-error">{routeError}</div>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
