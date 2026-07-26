import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  Flag,
  Gauge,
  Lock,
  MapPin,
  RefreshCw,
  Search,
  Trophy,
  X,
} from "lucide-react";
import {
  explorerSports,
  fetchExplorerItems,
  filterExplorerItems,
  formatExplorerDate,
  formatExplorerPrize,
} from "./explorer.js";

const STATUS_FILTERS = ["All", "upcoming", "live", "ended"];

export default function ExplorerModal({ onClose, open }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sport, setSport] = useState("All");
  const [status, setStatus] = useState("All");
  const [expandedId, setExpandedId] = useState("");
  const dialogRef = useRef(null);
  const searchRef = useRef(null);
  const requestIdRef = useRef(0);

  const sports = useMemo(() => explorerSports(items), [items]);
  const visibleItems = useMemo(
    () => filterExplorerItems(items, { query, sport, status }),
    [items, query, sport, status],
  );

  const load = async ({ refresh = false } = {}) => {
    if (loading || (loaded && !refresh)) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");

    try {
      const nextItems = await fetchExplorerItems();
      if (requestId !== requestIdRef.current) return;
      setItems(nextItems);
      setLoaded(true);
      setExpandedId("");
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      setItems([]);
      setLoaded(false);
      setError(loadError.message || "Tournament Explorer is unavailable");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !loaded && !loading && !error) load();
  }, [open, loaded, loading, error]);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.requestAnimationFrame(() => searchRef.current?.focus());

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = [...(dialogRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) || [])].filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="explorer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="presentation">
      <section className="explorer-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="explorer-title">
        <header className="explorer-head">
          <div>
            <span className="explorer-kicker"><Gauge size={14} /> Verified Bento catalog</span>
            <h2 id="explorer-title">Explore the calendar</h2>
            <p>Real tournaments and race weekends. No mock rooms, stale cards, or invented dates.</p>
          </div>
          <button className="explorer-close" onClick={onClose} type="button" aria-label="Close Explorer">
            <X size={20} />
          </button>
        </header>

        <div className="explorer-controls">
          <label className="explorer-search">
            <Search size={18} />
            <span className="sr-only">Search tournaments, leagues, teams, races, circuits, or countries</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search league, team, race or circuit"
              ref={searchRef}
              type="search"
              value={query}
            />
          </label>
          <button className="explorer-refresh" disabled={loading} onClick={() => load({ refresh: true })} type="button">
            <RefreshCw className={loading ? "is-spinning" : ""} size={16} />
            Refresh
          </button>
        </div>

        <div className="explorer-filter-group" aria-label="Filter by sport">
          {sports.map((item) => (
            <button
              aria-pressed={sport === item}
              className={sport === item ? "active" : ""}
              key={item}
              onClick={() => setSport(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>

        <div className="explorer-filter-group status" aria-label="Filter by tournament status">
          {STATUS_FILTERS.map((item) => (
            <button
              aria-pressed={status === item}
              className={status === item ? "active" : ""}
              key={item}
              onClick={() => setStatus(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>

        <div className="explorer-results" aria-busy={loading} aria-live="polite">
          {loading && !loaded ? <ExplorerLoading /> : null}
          {error ? (
            <div className="explorer-state error" role="alert">
              <strong>Explorer could not load</strong>
              <span>{error}</span>
              <button onClick={() => load({ refresh: true })} type="button">Try again</button>
            </div>
          ) : null}
          {!loading && !error && loaded && visibleItems.length === 0 ? (
            <div className="explorer-state">
              <strong>No verified competitions available</strong>
              <span>Try another search or filter. Nothing unverified will be substituted.</span>
            </div>
          ) : null}
          {!error ? visibleItems.map((item) => (
            <ExplorerCard
              expanded={expandedId === item.id}
              item={item}
              key={item.id}
              onToggle={() => setExpandedId((current) => current === item.id ? "" : item.id)}
            />
          )) : null}
        </div>
      </section>
    </div>
  );
}

function ExplorerCard({ expanded, item, onToggle }) {
  const prize = formatExplorerPrize(item.prizePool, item.stakeAsset);
  const dateLabel = formatExplorerDate(item.startTime);
  const isF1 = item.kind === "f1";
  const isEnded = item.status === "ended";
  const showSchedule = isEnded || expanded;

  return (
    <article className={`explorer-card ${item.status} ${showSchedule ? "expanded" : ""}`}>
      <div className="explorer-card-stripe" aria-hidden="true" />
      <div className="explorer-card-main">
        <div className="explorer-card-copy">
          <div className="explorer-card-meta">
            <span>{isF1 ? <Flag size={13} /> : <Trophy size={13} />}{item.sport}</span>
            {item.league ? <span>{item.league}</span> : null}
            <b className={`explorer-status ${item.status}`}>{item.status === "ended" ? <Lock size={11} /> : null}{item.status}</b>
          </div>
          <h3>{item.name}</h3>
          {item.nextEvent?.title || item.nextEvent?.gpName ? (
            <p>{item.nextEvent.gpName || item.nextEvent.title}</p>
          ) : null}
        </div>
        <div className="explorer-card-date">
          <CalendarDays size={17} />
          {dateLabel ? <time dateTime={item.startTime}>{dateLabel}</time> : <span>Final record</span>}
        </div>
      </div>

      <div className="explorer-card-stats">
        {item.format ? <span><small>Format</small><b>{humanize(item.format)}</b></span> : null}
        <span><small>Entries</small><b>{item.entryCount}</b></span>
        {prize ? <span><small>Pool</small><b>{prize}</b></span> : null}
      </div>

      {!isEnded ? (
        <button className="explorer-schedule-toggle" aria-expanded={expanded} onClick={onToggle} type="button">
          View schedule
          <ChevronDown className={expanded ? "rotated" : ""} size={17} />
        </button>
      ) : null}

      {showSchedule ? (
        <div className="explorer-schedule">
          {isEnded ? <div className="explorer-readonly"><Lock size={14} /> Final schedule - read only</div> : null}
          {isF1 ? <F1Schedule event={item.nextEvent} /> : <TournamentSchedule event={item.nextEvent} />}
        </div>
      ) : null}
    </article>
  );
}

function F1Schedule({ event }) {
  if (!event) return <span className="explorer-detail-empty">No verified round schedule.</span>;
  return (
    <div className="explorer-detail-grid">
      <span><small>Grand Prix</small><b>{event.gpName}</b></span>
      <span><small>Location</small><b><MapPin size={12} /> {[event.circuitName, event.country].filter(Boolean).join(", ")}</b></span>
      {event.qualifyingTime ? <span><small>Qualifying</small><time dateTime={event.qualifyingTime}>{formatExplorerDate(event.qualifyingTime)}</time></span> : null}
      {event.raceTime ? <span><small>Race</small><time dateTime={event.raceTime}>{formatExplorerDate(event.raceTime)}</time></span> : null}
    </div>
  );
}

function TournamentSchedule({ event }) {
  if (!event) return <span className="explorer-detail-empty">No verified fixture schedule.</span>;
  return (
    <div className="explorer-detail-grid">
      <span><small>Fixture</small><b>{event.title}</b></span>
      {event.stageName ? <span><small>Stage</small><b>{event.stageName}</b></span> : null}
      {event.teams?.length ? <span><small>Teams</small><b>{event.teams.join(" vs ")}</b></span> : null}
      {event.lockTime ? <span><small>Locks</small><time dateTime={event.lockTime}>{formatExplorerDate(event.lockTime)}</time></span> : null}
    </div>
  );
}

function ExplorerLoading() {
  return (
    <div className="explorer-loading" role="status">
      <span>Checking Bento tournaments</span>
      {[0, 1, 2].map((item) => <div className="explorer-loading-card" key={item} />)}
    </div>
  );
}

function humanize(value) {
  return String(value || "").replaceAll("_", " ").toLowerCase();
}
