import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flag,
  Gauge,
  Lock,
  MapPin,
  Trophy,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { enterTournament, fetchTournamentDetail, fetchTournamentStatus, formatExplorerDate, formatExplorerPrize, readCachedTournamentDetail } from "./explorer.js";

const SESSION_TOKEN_STORAGE_KEY = "haramball-session-token";
const SESSION_WALLET_STORAGE_KEY = "haramball-session-wallet";

export default function TournamentPage({ slug }) {
  return <TournamentRoute slug={slug} />;
}

export function TournamentDialog({ onClose, open, slug }) {
  return open ? (
    <div className="tournament-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()} role="presentation">
      <TournamentRoute slug={slug} onClose={onClose} dialog />
    </div>
  ) : null;
}

function TournamentRoute({ slug, onClose, dialog = false }) {
  const [tournament, setTournament] = useState(() => readCachedTournamentDetail(slug));
  const [loading, setLoading] = useState(() => !readCachedTournamentDetail(slug));
  const [error, setError] = useState("");
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [sessionAuth, setSessionAuth] = useState(() => readTournamentSession());
  const [tournamentStatus, setTournamentStatus] = useState(null);
  const [tournamentStatusLoading, setTournamentStatusLoading] = useState(false);
  const [tournamentStatusError, setTournamentStatusError] = useState("");
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    let active = true;
    const cached = readCachedTournamentDetail(slug);
    const firstLoad = !cached && (!tournament || tournament.slug !== slug);
    if (cached) setTournament(cached);
    else if (firstLoad) setTournament(null);
    setError("");
    setLeaderboardError("");
    setLoading(firstLoad);
    setLeaderboardLoading(!firstLoad);

    fetchTournamentDetail(slug, { leaderboardPage, leaderboardPageSize: 10 })
      .then((nextTournament) => {
        if (active) setTournament(nextTournament);
      })
      .catch((loadError) => {
        if (!active) return;
        const message = loadError.message || "Tournament could not be loaded";
        if (firstLoad) setError(message);
        else setLeaderboardError(message);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setLeaderboardLoading(false);
        }
      });

    return () => { active = false; };
  }, [slug, leaderboardPage]);

  useEffect(() => {
    setSessionAuth(readTournamentSession());
  }, [slug]);

  useEffect(() => {
    if (!slug || !sessionAuth.token) {
      setTournamentStatus(null);
      setTournamentStatusError("");
      setTournamentStatusLoading(false);
      return undefined;
    }

    let active = true;
    setTournamentStatusLoading(true);
    setTournamentStatusError("");
    fetchTournamentStatus(slug, sessionAuth)
      .then((status) => {
        if (active) setTournamentStatus(status);
      })
      .catch((loadError) => {
        if (!active) return;
        setTournamentStatus(null);
        setTournamentStatusError(loadError.message || "Tournament status unavailable");
      })
      .finally(() => {
        if (active) setTournamentStatusLoading(false);
      });

    return () => {
      active = false;
    };
  }, [sessionAuth.token, sessionAuth.wallet, slug]);

  const handleEnterTournament = async () => {
    if (!tournament || !sessionAuth.token) return;
    setEntering(true);
    setTournamentStatusError("");
    try {
      await enterTournament({
        token: sessionAuth.token,
        wallet: sessionAuth.wallet,
        slug: tournament.slug,
        stakeAsset: tournament.stakeAsset || "credits",
      });
      const status = await fetchTournamentStatus(tournament.slug, sessionAuth);
      setTournamentStatus(status);
    } catch (entryError) {
      setTournamentStatusError(entryError.message || "Tournament entry failed");
    } finally {
      setEntering(false);
    }
  };

  return dialog ? (
    <section className="tournament-route-shell tournament-route-shell-dialog" aria-busy={loading}>
      <div className="tournament-route-panel tournament-route-panel-dialog">
        <nav className="tournament-route-nav" aria-label="Tournament navigation">
          <a href="/"><ArrowLeft size={17} /> haramball.xyz</a>
          <div className="tournament-route-nav-actions">
            <button onClick={onClose} type="button"><X size={17} /> Close</button>
          </div>
        </nav>
        {loading ? <TournamentRouteSkeleton /> : null}
        {!loading && error ? (
          <div className="tournament-route-state" role="alert">
            <strong>Tournament unavailable</strong>
            <p>{error}</p>
            <button onClick={onClose} type="button">Close dialog</button>
          </div>
        ) : null}
        {!loading && tournament ? (
          <TournamentContent
            entering={entering}
            onEnterTournament={handleEnterTournament}
            leaderboardError={leaderboardError}
            leaderboardLoading={leaderboardLoading}
            onLeaderboardPageChange={setLeaderboardPage}
            sessionAuth={sessionAuth}
            tournament={tournament}
            tournamentStatus={tournamentStatus}
            tournamentStatusError={tournamentStatusError}
            tournamentStatusLoading={tournamentStatusLoading}
          />
        ) : null}
      </div>
    </section>
  ) : (
    <main className="tournament-route-shell">
      <section className="tournament-route-panel" aria-busy={loading}>
        <nav className="tournament-route-nav" aria-label="Tournament navigation">
          <a href="/"><ArrowLeft size={17} /> haramball.xyz</a>
          <a href="/"><ArrowLeft size={17} /> Switch tournament</a>
        </nav>

        {loading ? <TournamentRouteSkeleton /> : null}
        {!loading && error ? (
          <div className="tournament-route-state" role="alert">
            <strong>Tournament unavailable</strong>
            <p>{error}</p>
            <a href="/">Choose another tournament</a>
          </div>
        ) : null}
        {!loading && tournament ? (
          <TournamentContent
            entering={entering}
            onEnterTournament={handleEnterTournament}
            leaderboardError={leaderboardError}
            leaderboardLoading={leaderboardLoading}
            onLeaderboardPageChange={setLeaderboardPage}
            sessionAuth={sessionAuth}
            tournament={tournament}
            tournamentStatus={tournamentStatus}
            tournamentStatusError={tournamentStatusError}
            tournamentStatusLoading={tournamentStatusLoading}
          />
        ) : null}
      </section>
    </main>
  );
}

function TournamentContent({
  entering,
  leaderboardError,
  leaderboardLoading,
  onEnterTournament,
  onLeaderboardPageChange,
  sessionAuth,
  tournament,
  tournamentStatus,
  tournamentStatusError,
  tournamentStatusLoading,
}) {
  const prize = formatExplorerPrize(tournament.prizePool, tournament.stakeAsset);
  const isEnded = tournament.status === "ended";

  return (
    <>
      <header className={`tournament-route-hero ${tournament.status}`}>
        <div className="tournament-route-hero-top">
          <div className="tournament-route-eyebrow">
            <span>{tournament.kind === "f1" ? <Flag size={14} /> : <Trophy size={14} />}{tournament.sport}</span>
            {tournament.league ? <span>{tournament.league}</span> : null}
            <b><StatusIcon status={tournament.status} />{tournament.status}</b>
          </div>
          <a className="tournament-enter-action tournament-enter-action-hero" href="#tournament-entry">Enter</a>
        </div>
        <h1>{tournament.name}</h1>
        {tournament.description ? <p>{tournament.description}</p> : null}
        <div className="tournament-route-meta">
          {tournament.format ? <Meta label="Format" value={humanize(tournament.format)} /> : null}
          {tournament.entryCount > 0 ? <Meta label="Entries" value={String(tournament.entryCount)} /> : null}
          {prize ? <Meta label="Prize pool" value={prize} /> : null}
          {tournament.startTime ? <Meta label={isEnded ? "Final event" : "Next event"} value={formatExplorerDate(tournament.startTime)} /> : null}
          {isEnded && tournament.winner ? <Meta label="Winner" value={tournament.winner} /> : null}
          {isEnded && (tournament.homeScore !== null || tournament.awayScore !== null) ? <Meta label="Score" value={scoreLine(tournament)} /> : null}
        </div>
        {isEnded ? <div className="tournament-route-readonly"><Lock size={15} /> Final tournament data - read only</div> : null}
      </header>

      <div className="tournament-route-content">
        <section className="tournament-route-section" id="tournament-entry" aria-busy={tournamentStatusLoading || entering}>
          <div className="tournament-section-heading">
            <div><Wallet size={18} /><span>Tournament entry</span></div>
            <b>{entryLabel({ sessionAuth, tournament, tournamentStatus })}</b>
          </div>
          {tournamentStatusError ? <p className="tournament-leaderboard-error" role="alert">{tournamentStatusError}</p> : null}
          <TournamentEntryPanel
            entering={entering}
            onEnterTournament={onEnterTournament}
            sessionAuth={sessionAuth}
            tournament={tournament}
            status={tournamentStatus}
          />
        </section>

        <section className="tournament-route-section" id="official-schedule">
          <div className="tournament-section-heading">
            <div><CalendarDays size={18} /><span>Official schedule</span></div>
            <b>Live Bento data</b>
          </div>
          {tournament.kind === "f1"
            ? <F1Rounds rounds={tournament.rounds || []} />
            : <FootballStages stages={tournament.stages || []} />}
        </section>

        <section className="tournament-route-section" aria-busy={leaderboardLoading}>
          <div className="tournament-section-heading">
            <div><Users size={18} /><span>Tournament leaderboard</span></div>
            {tournament.leaderboardPagination?.total > 0 ? (
              <b>{tournament.leaderboardPagination.total} {tournament.leaderboardPagination.total === 1 ? "entry" : "entries"}</b>
            ) : null}
          </div>
          {leaderboardError ? <p className="tournament-leaderboard-error" role="alert">{leaderboardError}</p> : null}
          <TournamentLeaderboard
            loading={leaderboardLoading}
            onPageChange={onLeaderboardPageChange}
            pagination={tournament.leaderboardPagination}
            rows={tournament.leaderboard || []}
          />
        </section>
      </div>
    </>
  );
}

function TournamentEntryPanel({ entering, onEnterTournament, sessionAuth, status, tournament }) {
  const entered = hasTournamentEntry(status);
  const blockedReason = status?.eligibility?.reason || status?.eligibility?.error || status?.myStatus?.error || "";

  if (tournament.status === "ended") {
    return <DataUnavailable label="This tournament is final and read-only." />;
  }

  if (!sessionAuth?.token) {
    return (
      <div className="tournament-entry-panel">
        <strong>Connect on the main market page first.</strong>
        <span>Tournament entry uses your session wallet token; no local placeholder entry is shown.</span>
        <a className="tournament-enter-action" href="/">Connect wallet</a>
      </div>
    );
  }

  return (
    <div className="tournament-entry-panel">
      <strong>{entered ? "Entry confirmed by Bento" : "Ready to enter with Bento"}</strong>
      <span>{entrySummary(status) || blockedReason || "Eligibility and entry state are read from the tournament host."}</span>
      {!entered ? (
        <button className="tournament-enter-action" disabled={entering || Boolean(blockedReason)} onClick={onEnterTournament} type="button">
          {entering ? "Entering..." : `Enter ${tournament.stakeAsset || "credits"}`}
        </button>
      ) : null}
    </div>
  );
}

function FootballStages({ stages }) {
  if (!stages.length) return <DataUnavailable label="No stage or fixture schedule has been published by Bento." />;
  return (
    <div className="tournament-stage-list">
      {stages.map((stage, index) => (
        <article className="tournament-stage" key={stage.id || `${stage.name}-${index}`}>
          <header>
            <div>
              {stage.name ? <h2>{stage.name}</h2> : null}
            </div>
            {stage.status ? <b>{humanize(stage.status)}</b> : null}
          </header>
          {stage.fixtures.length ? (
            <div className="tournament-fixture-list">
              {stage.fixtures.map((fixture, fixtureIndex) => (
                <div className="tournament-fixture" key={fixture.id || `${fixture.title}-${fixtureIndex}`}>
                  <div>
                    {fixture.title ? <strong>{fixture.title}</strong> : null}
                    {fixture.teams.length ? <span>{fixture.teams.join(" vs ")}</span> : null}
                  </div>
                  {fixture.winner || fixture.homeScore !== null || fixture.awayScore !== null ? (
                    <div className="tournament-fixture-score">
                      {fixture.winner ? <strong>{fixture.winner}</strong> : null}
                      {fixture.homeScore !== null || fixture.awayScore !== null ? <span>{scoreLine(fixture)}</span> : null}
                    </div>
                  ) : null}
                  {fixture.startTime ? <time dateTime={fixture.startTime}>{formatExplorerDate(fixture.startTime)}</time> : null}
                </div>
              ))}
            </div>
          ) : <DataUnavailable label="No fixtures have been published for this stage." />}
        </article>
      ))}
    </div>
  );
}

function F1Rounds({ rounds }) {
  if (!rounds.length) return <DataUnavailable label="No race rounds have been published by Bento." />;
  return (
    <div className="tournament-round-grid">
      {rounds.map((round, index) => (
        <article className={`tournament-round ${round.number ? "" : "no-number"}`} key={round.id || `${round.name}-${index}`}>
          {round.number ? <div className="tournament-round-number">{round.number}</div> : null}
          <div>
            {round.status ? <small>{humanize(round.status)}</small> : null}
            {round.name ? <h2>{round.name}</h2> : null}
            {round.circuit || round.country ? <p><MapPin size={13} />{[round.circuit, round.country].filter(Boolean).join(", ")}</p> : null}
          </div>
          <div className="tournament-round-dates">
            {round.qualifyingTime ? <span><small>Qualifying</small><time dateTime={round.qualifyingTime}>{formatExplorerDate(round.qualifyingTime)}</time></span> : null}
            {round.raceTime ? <span><small>Race</small><time dateTime={round.raceTime}>{formatExplorerDate(round.raceTime)}</time></span> : null}
            {!round.qualifyingTime && !round.raceTime && round.startTime ? <time dateTime={round.startTime}>{formatExplorerDate(round.startTime)}</time> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function TournamentLeaderboard({ loading, onPageChange, pagination, rows }) {
  if (!rows.length) return <DataUnavailable label="No tournament leaderboard has been published by Bento." />;
  return (
    <>
      <div className={`tournament-native-leaderboard ${loading ? "is-loading" : ""}`}>
        {rows.map((row, index) => {
          const details = leaderboardDetails(row);
          return (
            <div className={`tournament-leaderboard-row ${row.rank === null ? "no-rank" : ""}`} key={`${row.rank ?? index}-${row.name}`}>
              {row.rank !== null ? <b>{row.rank}</b> : null}
              <div className="tournament-leaderboard-identity">
                <strong title={row.name}>{row.name}</strong>
                {details ? <small>{details}</small> : null}
              </div>
              {row.score !== null ? <span className="tournament-leaderboard-score"><small>PTS</small>{row.score}</span> : null}
            </div>
          );
        })}
      </div>
      {pagination?.totalPages > 1 ? (
        <nav className="tournament-leaderboard-pagination" aria-label="Leaderboard pages">
          <button disabled={loading || pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)} type="button">
            <ChevronLeft size={15} /> Previous
          </button>
          <span>Page <b>{pagination.page}</b> of {pagination.totalPages}</span>
          <button disabled={loading || pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)} type="button">
            Next <ChevronRight size={15} />
          </button>
        </nav>
      ) : null}
    </>
  );
}

function leaderboardDetails(row) {
  const details = [];
  if (row.status) details.push(humanize(row.status));
  if (row.stagesPlayed !== null) details.push(`${row.stagesPlayed} ${row.stagesPlayed === 1 ? "stage" : "stages"}`);
  if (row.racesParticipated !== null) details.push(`${row.racesParticipated} ${row.racesParticipated === 1 ? "race" : "races"}`);
  if (row.eloRating !== null) details.push(`ELO ${row.eloRating}`);
  return details.join(" / ");
}

function Meta({ label, value }) {
  return <div><small>{label}</small><strong>{value}</strong></div>;
}

function StatusIcon({ status }) {
  return status === "ended" ? <Lock size={12} /> : <Gauge size={12} />;
}

function DataUnavailable({ label }) {
  return <p className="tournament-data-unavailable">{label}</p>;
}

function readTournamentSession() {
  if (typeof sessionStorage === "undefined") return { token: "", wallet: "" };
  return {
    token: sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY) || "",
    wallet: sessionStorage.getItem(SESSION_WALLET_STORAGE_KEY) || "",
  };
}

function hasTournamentEntry(status = {}) {
  return Boolean(
    status?.myStatus?.hasEntry
    || status?.myStatus?.entered
    || status?.myStatus?.entry
    || status?.eligibility?.hasEntry
    || status?.myPicks?.hasEntry
    || status?.myPicks?.entry,
  );
}

function entrySummary(status = {}) {
  const chips = status?.myStatus?.chipsSummary || status?.myStatus?.chips || status?.myPicks?.chipsSummary;
  if (chips?.chipsRemaining !== undefined) return `${chips.chipsRemaining} chips remaining`;
  if (chips?.startChips !== undefined) return `${chips.startChips} starting chips`;
  if (status?.eligibility?.eligible === false) return "Wallet is not eligible for entry";
  if (status?.eligibility?.eligible === true) return "Wallet is eligible";
  return "";
}

function entryLabel({ sessionAuth, tournament, tournamentStatus }) {
  if (tournament?.status === "ended") return "Read-only";
  if (!sessionAuth?.token) return "Connect";
  if (hasTournamentEntry(tournamentStatus)) return "Entered";
  return "Bento status";
}

function TournamentRouteSkeleton() {
  return (
    <div className="tournament-route-loading" role="status">
      <span className="sr-only">Loading tournament details</span>
      <i className="hero" />
      <i />
      <i />
    </div>
  );
}

function humanize(value) {
  return String(value || "").replaceAll("_", " ").toLowerCase();
}

function scoreLine(match = {}) {
  const home = match.homeScore ?? null;
  const away = match.awayScore ?? null;
  if (home === null && away === null) return "";
  const teams = Array.isArray(match.teams) && match.teams.length === 2 ? match.teams : ["Home", "Away"];
  return `${teams[0]} ${home ?? "-"} - ${away ?? "-"} ${teams[1]}`;
}
