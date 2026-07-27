import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
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

  useEffect(() => {
    let active = true;
    setTournament(null);
    setError("");
    setLoading(true);

    fetchTournamentDetail(slug)
      .then((nextTournament) => {
        if (active) setTournament(nextTournament);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Tournament could not be loaded");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [slug]);

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
        {!loading && tournament ? <TournamentContent tournament={tournament} /> : null}
      </section>
      <ExplorerModal onClose={() => setExplorerOpen(false)} open={explorerOpen} />
    </main>
  );
}

function TournamentContent({ tournament }) {
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

        <section className="tournament-route-section">
          <div className="tournament-section-heading">
            <div><Users size={18} /><span>Tournament leaderboard</span></div>
          </div>
          <TournamentLeaderboard rows={tournament.leaderboard || []} />
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

function TournamentLeaderboard({ rows }) {
  if (!rows.length) return <DataUnavailable label="No tournament leaderboard has been published by Bento." />;
  return (
    <div className="tournament-native-leaderboard">
      {rows.map((row, index) => (
        <div className={row.rank === null ? "no-rank" : ""} key={`${row.rank ?? index}-${row.name}`}>
          {row.rank !== null ? <b>{row.rank}</b> : null}
          <strong>{row.name}</strong>
          {row.score !== null ? <span>{row.score}</span> : null}
        </div>
      ))}
    </div>
  );
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
