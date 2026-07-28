import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Compass,
  Flag,
  Gauge,
  Lock,
  MapPin,
  Trophy,
  Users,
} from "lucide-react";
import ExplorerModal from "./ExplorerModal.jsx";
import { fetchTournamentDetail, formatExplorerDate, formatExplorerPrize } from "./explorer.js";

export default function TournamentPage({ slug }) {
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");

  useEffect(() => {
    let active = true;
    const firstLoad = !tournament || tournament.slug !== slug;
    if (firstLoad) setTournament(null);
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

  return (
    <main className="tournament-route-shell">
      <section className="tournament-route-panel" aria-busy={loading}>
        <nav className="tournament-route-nav" aria-label="Tournament navigation">
          <a href="/"><ArrowLeft size={17} /> haramball.xyz</a>
          <button onClick={() => setExplorerOpen(true)} type="button"><Compass size={17} /> Switch tournament</button>
        </nav>

        {loading ? <TournamentRouteSkeleton /> : null}
        {!loading && error ? (
          <div className="tournament-route-state" role="alert">
            <strong>Tournament unavailable</strong>
            <p>{error}</p>
            <button onClick={() => setExplorerOpen(true)} type="button">Choose another tournament</button>
          </div>
        ) : null}
        {!loading && tournament ? (
          <TournamentContent
            leaderboardError={leaderboardError}
            leaderboardLoading={leaderboardLoading}
            onLeaderboardPageChange={setLeaderboardPage}
            tournament={tournament}
          />
        ) : null}
      </section>
      <ExplorerModal onClose={() => setExplorerOpen(false)} open={explorerOpen} />
    </main>
  );
}

function TournamentContent({ leaderboardError, leaderboardLoading, onLeaderboardPageChange, tournament }) {
  const prize = formatExplorerPrize(tournament.prizePool, tournament.stakeAsset);
  const isEnded = tournament.status === "ended";

  return (
    <>
      <header className={`tournament-route-hero ${tournament.status}`}>
        <div className="tournament-route-eyebrow">
          <span>{tournament.kind === "f1" ? <Flag size={14} /> : <Trophy size={14} />}{tournament.sport}</span>
          {tournament.league ? <span>{tournament.league}</span> : null}
          <b><StatusIcon status={tournament.status} />{tournament.status}</b>
        </div>
        <h1>{tournament.name}</h1>
        {tournament.description ? <p>{tournament.description}</p> : null}
        <div className="tournament-route-meta">
          {tournament.format ? <Meta label="Format" value={humanize(tournament.format)} /> : null}
          {tournament.entryCount > 0 ? <Meta label="Entries" value={String(tournament.entryCount)} /> : null}
          {prize ? <Meta label="Prize pool" value={prize} /> : null}
          {tournament.startTime ? <Meta label={isEnded ? "Final event" : "Next event"} value={formatExplorerDate(tournament.startTime)} /> : null}
        </div>
        {isEnded ? <div className="tournament-route-readonly"><Lock size={15} /> Final tournament data - read only</div> : null}
      </header>

      <div className="tournament-route-content">
        <section className="tournament-route-section">
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
