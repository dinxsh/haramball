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
  EXPLORER_SORTS,
  defaultExplorerStatus,
  explorerSports,
  fetchExplorerItems,
  fetchTournamentDetail,
  filterExplorerItems,
  formatExplorerDate,
  formatExplorerPrize,
  nextExplorerModalState,
  preloadExplorerItems,
  preloadTournamentDetail,
  readCachedExplorerItems,
  shouldShowExplorerSkeleton,
} from "./explorer.js";

const STATUS_FILTERS = ["All", "live", "upcoming", "listed", "ended"];

export default function ExplorerModal({ initialStatus = "All", onClose, onEnterTournament, onSelectTournament, open }) {
  const [initialCachedItems] = useState(() => readCachedExplorerItems());
  const [items, setItems] = useState(initialCachedItems);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(() => initialCachedItems.length > 0);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("volume24h");
  const [sport, setSport] = useState("All");
  const [status, setStatus] = useState(() => defaultExplorerStatus(initialStatus));
  const [expandedId, setExpandedId] = useState("");
  const [expandedTournament, setExpandedTournament] = useState(null);
  const [expandedTournamentLoading, setExpandedTournamentLoading] = useState(false);
  const [expandedTournamentError, setExpandedTournamentError] = useState("");
  const [selectedSlug, setSelectedSlug] = useState("");
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [selectedTournamentLoading, setSelectedTournamentLoading] = useState(false);
  const [selectedTournamentError, setSelectedTournamentError] = useState("");
  const dialogRef = useRef(null);
  const searchRef = useRef(null);
  const requestIdRef = useRef(0);

  const sports = useMemo(() => explorerSports(items), [items]);
  const visibleItems = useMemo(
    () => filterExplorerItems(items, { query, sort, sport, status }),
    [items, query, sort, sport, status],
  );
  const showInitialSkeleton = shouldShowExplorerSkeleton({ open, loaded, error, loading });

  const load = async ({ refresh = false } = {}) => {
    if (loading || (loaded && !refresh)) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");

    try {
      const nextItems = await fetchExplorerItems({ refresh });
      if (requestId !== requestIdRef.current) return;
      setItems(nextItems);
      setLoaded(true);
      setExpandedId("");
      if (selectedSlug && !nextItems.some((item) => item.slug === selectedSlug)) {
        setSelectedSlug("");
      }
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
    let active = true;
    const request = initialCachedItems.length
      ? fetchExplorerItems({ refresh: true })
      : preloadExplorerItems();
    request.then((nextItems) => {
      if (!active) return;
      setItems(nextItems);
      setLoaded(true);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (open && !loaded && !loading && !error) load();
  }, [open, loaded, loading, error]);

  useEffect(() => {
    if (open) setStatus(defaultExplorerStatus(initialStatus));
  }, [initialStatus, open]);

  useEffect(() => {
    if (!open || !loaded || !visibleItems.length) return;
    visibleItems
      .filter((item) => item.kind === "f1" && item.status !== "ended")
      .slice(0, 3)
      .forEach((item) => {
        preloadTournamentDetail(item.slug);
      });
  }, [open, loaded, visibleItems]);

  useEffect(() => {
    if (!expandedId) {
      setExpandedTournament(null);
      setExpandedTournamentLoading(false);
      setExpandedTournamentError("");
      return;
    }

    const item = items.find((candidate) => candidate.id === expandedId);
    if (!item || item.kind !== "f1") {
      setExpandedTournament(null);
      setExpandedTournamentLoading(false);
      setExpandedTournamentError("");
      return;
    }

    let active = true;
    setExpandedTournamentLoading(true);
    setExpandedTournamentError("");

    fetchTournamentDetail(item.slug)
      .then((tournament) => {
        if (!active) return;
        setExpandedTournament(tournament);
      })
      .catch((loadError) => {
        if (!active) return;
        setExpandedTournament(null);
        setExpandedTournamentError(loadError.message || "Bracket details unavailable");
      })
      .finally(() => {
        if (active) setExpandedTournamentLoading(false);
      });

    return () => {
      active = false;
    };
  }, [expandedId, items]);

  useEffect(() => {
    if (!selectedSlug) {
      setSelectedTournament(null);
      setSelectedTournamentLoading(false);
      setSelectedTournamentError("");
      return;
    }

    let active = true;
    setSelectedTournamentLoading(true);
    setSelectedTournamentError("");

    fetchTournamentDetail(selectedSlug)
      .then((tournament) => {
        if (!active) return;
        setSelectedTournament(tournament);
      })
      .catch((loadError) => {
        if (!active) return;
        setSelectedTournament(null);
        setSelectedTournamentError(loadError.message || "Schedule details unavailable");
      })
      .finally(() => {
        if (active) setSelectedTournamentLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedSlug]);

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
          <label className="explorer-sort">
            <span className="sr-only">Sort Explorer tournaments</span>
            <select onChange={(event) => setSort(event.target.value)} value={sort}>
              {EXPLORER_SORTS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <ChevronDown size={16} />
          </label>
          <button className="explorer-refresh" disabled={loading} onClick={() => load({ refresh: true })} type="button">
            <RefreshCw className={loading ? "is-spinning" : ""} size={16} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="explorer-filter-bar">
          <div className="explorer-filter-scroll">
            <div className="explorer-filter-group" aria-label="Filter by sport" role="group">
              <span>Sport</span>
              {sports.map((item) => (
                <button
                  aria-pressed={sport === item}
                  className={sport === item ? "active" : ""}
                  key={item}
                  onClick={() => setSport(item)}
                  type="button"
                >
                  {item === "All" ? "All sports" : item}
                </button>
              ))}
            </div>
            <div className="explorer-filter-divider" aria-hidden="true" />
            <div className="explorer-filter-group status" aria-label="Filter by tournament status" role="group">
              <span>Status</span>
              {STATUS_FILTERS.map((item) => (
                <button
                  aria-pressed={status === item}
                  className={status === item ? "active" : ""}
                  key={item}
                  onClick={() => setStatus(item)}
                  type="button"
                >
                  {item === "All" ? "All status" : item}
                </button>
              ))}
            </div>
          </div>
          <div className="explorer-filter-summary">
            <b>{showInitialSkeleton ? "Checking catalog" : `${visibleItems.length} ${visibleItems.length === 1 ? "competition" : "competitions"}`}</b>
            {query || sport !== "All" || status !== "All" || sort !== "volume24h" ? (
              <button onClick={() => { setQuery(""); setSport("All"); setStatus("All"); setSort("volume24h"); }} type="button">Clear filters</button>
            ) : null}
          </div>
        </div>

        <div className="explorer-results" aria-busy={showInitialSkeleton || loading} aria-live="polite">
          {showInitialSkeleton ? <ExplorerLoading /> : null}
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
              expandedTournament={expandedTournament}
              expandedTournamentError={expandedTournamentError}
              expandedTournamentLoading={expandedTournamentLoading}
              item={item}
              key={item.id}
              onEnterTournament={onEnterTournament}
              onSelectTournament={(slug) => {
                const nextState = nextExplorerModalState(
                  { expandedId, selectedSlug },
                  { type: "select-tournament", slug },
                );
                setSelectedSlug(nextState.selectedSlug);
                setExpandedId(nextState.expandedId);
                onSelectTournament?.(slug);
              }}
              onToggle={() => {
                const nextState = nextExplorerModalState(
                  { expandedId, selectedSlug },
                  { type: "toggle-schedule", itemId: item.id },
                );
                setExpandedId(nextState.expandedId);
                setSelectedSlug(nextState.selectedSlug);
              }}
            />
          )) : null}
        </div>

        {selectedSlug ? (
          <div className="explorer-selected-panel" aria-live="polite">
            <div className="explorer-selected-panel-head">
              <div>
                <span className="explorer-selected-kicker">Selected competition</span>
                <h3>{selectedTournament?.name || "Loading competition..."}</h3>
              </div>
              <button className="explorer-selected-close" onClick={() => { setSelectedSlug(""); setExpandedId(""); }} type="button">
                Close
              </button>
            </div>
            {selectedTournamentLoading ? <span className="explorer-detail-empty">Loading schedule and timings...</span> : null}
            {selectedTournamentError ? <span className="explorer-detail-empty">{selectedTournamentError}</span> : null}
            {!selectedTournamentLoading && !selectedTournamentError && selectedTournament ? (
              <SelectedTournamentDetails onEnterTournament={onEnterTournament} tournament={selectedTournament} />
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ExplorerCard({
  expanded,
  expandedTournament,
  expandedTournamentError,
  expandedTournamentLoading,
  item,
  onEnterTournament,
  onSelectTournament,
  onToggle,
}) {
  const prize = formatExplorerPrize(item.prizePool, item.stakeAsset);
  const dateLabel = formatExplorerDate(item.startTime);
  const isF1 = item.kind === "f1";
  const isEnded = item.status === "ended";
  const showSchedule = !isEnded && expanded;
  const hasStats = Boolean(item.format || item.entryCount > 0 || prize);
  const dateCaption = isEnded ? "Final event" : item.status === "live" ? "In progress" : item.status === "listed" ? "Listed" : "Next event";

  return (
    <article className={`explorer-card ${item.status} ${showSchedule ? "expanded" : ""}`}>
      <div className="explorer-card-stripe" aria-hidden="true" />
      <button className="explorer-card-link" onClick={() => onSelectTournament?.(item.slug)} type="button">
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
            <div>
              <small>{dateCaption}</small>
              {dateLabel ? <time dateTime={item.startTime}>{dateLabel}</time> : <span>{item.status === "listed" ? "Awaiting schedule" : "No date from Bento"}</span>}
            </div>
          </div>
        </div>

        {hasStats ? (
          <div className="explorer-card-stats">
            {item.format ? <span><small>Format</small><b>{humanize(item.format)}</b></span> : null}
            {item.entryCount > 0 ? <span><small>Entries</small><b>{item.entryCount}</b></span> : null}
            {prize ? <span><small>Pool</small><b>{prize}</b></span> : null}
          </div>
        ) : null}

              {isEnded ? <div className="explorer-card-lockline"><Lock size={13} /> Archived schedule <span>View live matches in Explore</span></div> : null}
      </button>

        <div className="explorer-card-actions">
        {!isEnded ? (
          <button className="explorer-schedule-toggle" aria-expanded={expanded} onClick={onToggle} type="button">
            {expanded ? "Hide schedule" : "View schedule"}
            <ChevronDown className={expanded ? "rotated" : ""} size={17} />
          </button>
        ) : <span className="explorer-schedule-toggle explorer-schedule-toggle-disabled">Archived</span>}
        <button className="explorer-enter-button" onClick={() => onEnterTournament?.(item.slug)} type="button">
          Enter
        </button>
      </div>

      {showSchedule ? (
        <div className="explorer-schedule">
          {isF1 ? (
            <>
              <div className="explorer-readonly">
                <Gauge size={12} />
                Bracket preview
              </div>
              {expandedTournamentLoading ? <span className="explorer-detail-empty">Loading round bracket...</span> : null}
              {expandedTournamentError ? <span className="explorer-detail-empty">{expandedTournamentError}</span> : null}
              {expandedTournament?.rounds?.length ? <F1Rounds rounds={expandedTournament.rounds} /> : null}
              {!expandedTournamentLoading && !expandedTournamentError && !expandedTournament?.rounds?.length ? <F1Schedule event={item.nextEvent} /> : null}
            </>
          ) : (
            <TournamentSchedule event={item.nextEvent} />
          )}
        </div>
      ) : null}
    </article>
  );
}

function SelectedTournamentDetails({ onEnterTournament, tournament }) {
  return (
    <div className="explorer-selected-details">
      <div className="explorer-selected-meta">
        <span>{tournament.kind === "f1" ? <Flag size={13} /> : <Trophy size={13} />}{tournament.sport}</span>
        {tournament.league ? <span>{tournament.league}</span> : null}
        {tournament.status ? <b className={`explorer-status ${tournament.status}`}>{tournament.status}</b> : null}
      </div>
      <p className="explorer-selected-description">{tournament.description || "Schedule and timings loaded from the competition slug page."}</p>
      <div className="explorer-selected-actions">
        <button className="explorer-enter-button" onClick={() => onEnterTournament?.(tournament.slug)} type="button">
          Enter
        </button>
      </div>
      <div className="explorer-schedule explorer-schedule-selected">
        {tournament.kind === "f1"
          ? <F1Schedule event={tournament.nextEvent} />
          : <TournamentSchedule event={tournament.nextEvent} />}
        {tournament.kind === "f1" && tournament.rounds?.length ? <F1Rounds rounds={tournament.rounds} /> : null}
        {tournament.kind !== "f1" && tournament.stages?.length ? <TournamentStages stages={tournament.stages} /> : null}
      </div>
    </div>
  );
}

function TournamentStages({ stages }) {
  if (!stages.length) return <span className="explorer-detail-empty">No verified fixture schedule.</span>;
  return (
    <div className="explorer-stage-list">
      {stages.map((stage, index) => (
        <article className="explorer-stage" key={stage.id || `${stage.name}-${index}`}>
          <div className="explorer-stage-head">
            <div>
              {stage.name ? <h4>{stage.name}</h4> : null}
              {stage.status ? <small>{humanize(stage.status)}</small> : null}
            </div>
          </div>
          {stage.fixtures?.length ? (
            <div className="explorer-fixture-list">
              {stage.fixtures.map((fixture, fixtureIndex) => (
                <div className="explorer-fixture" key={fixture.id || `${fixture.title}-${fixtureIndex}`}>
                  <div>
                    {fixture.title ? <strong>{fixture.title}</strong> : null}
                    {fixture.teams?.length ? <span>{fixture.teams.join(" vs ")}</span> : null}
                  </div>
                  {fixture.startTime ? <time dateTime={fixture.startTime}>{formatExplorerDate(fixture.startTime)}</time> : null}
                </div>
              ))}
            </div>
          ) : <span className="explorer-detail-empty">No fixtures have been published for this stage.</span>}
        </article>
      ))}
    </div>
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

function F1Rounds({ rounds }) {
  if (!rounds.length) return <span className="explorer-detail-empty">No race rounds have been published by Bento.</span>;

  return (
    <div className="explorer-round-grid">
      {rounds.map((round, index) => (
        <article className={`explorer-round ${round.number ? "" : "no-number"}`} key={round.id || `${round.name}-${index}`}>
          {round.number ? <div className="explorer-round-number">{round.number}</div> : null}
          <div className="explorer-round-copy">
            {round.status ? <small>{humanize(round.status)}</small> : null}
            {round.name ? <h4>{round.name}</h4> : null}
            {round.circuit || round.country ? <p><MapPin size={12} /> {[round.circuit, round.country].filter(Boolean).join(", ")}</p> : null}
          </div>
          <div className="explorer-round-dates">
            {round.qualifyingTime ? <span><small>Qualifying</small><time dateTime={round.qualifyingTime}>{formatExplorerDate(round.qualifyingTime)}</time></span> : null}
            {round.raceTime ? <span><small>Race</small><time dateTime={round.raceTime}>{formatExplorerDate(round.raceTime)}</time></span> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function ExplorerLoading() {
  return (
    <div className="explorer-loading" role="status">
      <span className="sr-only">Checking Bento tournaments</span>
      {[0, 1, 2].map((item) => (
        <div className="explorer-loading-card" key={item}>
          <i className="explorer-skeleton-stripe" />
          <div className="explorer-skeleton-copy">
            <i className="short" />
            <i className="title" />
            <i className="medium" />
          </div>
          <i className="explorer-skeleton-date" />
        </div>
      ))}
    </div>
  );
}

function humanize(value) {
  return String(value || "").replaceAll("_", " ").toLowerCase();
}
