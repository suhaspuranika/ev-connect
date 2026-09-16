import { MdFilterList, MdAccessTime } from "../icons.js";

/**
 * Filter controls for the station list:
 *  - open-now toggle
 *  - network/brand (derived from results)
 *  - minimum charge rate in kW
 */
export default function FilterBar({
  networks,
  network,
  onNetworkChange,
  minKw,
  onMinKwChange,
  openNow,
  onOpenNowChange,
  resultCount,
}) {
  const kwOptions = [0, 25, 50, 100, 150];

  return (
    <div className="filter-bar">
      <div className="filter-head">
        <MdFilterList />
        <span>Filters</span>
        <span className="filter-count">{resultCount} shown</span>
      </div>

      <div className="filter-controls">
        <button
          type="button"
          className={`chip-toggle${openNow ? " active" : ""}`}
          onClick={() => onOpenNowChange(!openNow)}
          aria-pressed={openNow}
        >
          <MdAccessTime />
          Open now
        </button>

        <div className="filter-group">
          <label className="filter-label" htmlFor="network-filter">
            Network
          </label>
          <select
            id="network-filter"
            className="filter-select"
            value={network}
            onChange={(e) => onNetworkChange(e.target.value)}
          >
            <option value="all">All networks</option>
            {networks.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label" htmlFor="kw-filter">
            Min power
          </label>
          <select
            id="kw-filter"
            className="filter-select"
            value={minKw}
            onChange={(e) => onMinKwChange(Number(e.target.value))}
          >
            {kwOptions.map((kw) => (
              <option key={kw} value={kw}>
                {kw === 0 ? "Any" : `${kw}+ kW`}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
