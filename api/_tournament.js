export function normalizeTournamentDetail({
  item = {},
  source = {},
  detail = {},
  leaderboard,
  leaderboardPage = 1,
  leaderboardPageSize = 10,
  leaderboardIsPaged = false,
} = {}) {
  const normalizedLeaderboard = normalizeLeaderboard(leaderboard);
  const total = numberOrNull(leaderboard?.total ?? leaderboard?.stats?.totalEntries) ?? normalizedLeaderboard.length;
  const firstRow = (leaderboardPage - 1) * leaderboardPageSize;
  const normalized = {
    ...item,
    description: text(source.description || detail.tournament?.description || detail.description),
    format: text(item.format || source.format || source.gameType || detail.tournament?.format),
    entryCount: finiteNumber(item.entryCount ?? source.entryCount ?? detail.tournament?.entryCount),
    prizePool: valueOrNull(item.prizePool ?? source.prizePool ?? detail.tournament?.prizePool),
    stakeAsset: text(item.stakeAsset || source.stakeAsset || source.config?.stakeAsset),
    leaderboard: leaderboardIsPaged
      ? normalizedLeaderboard
      : normalizedLeaderboard.slice(firstRow, firstRow + leaderboardPageSize),
    leaderboardPagination: {
      page: leaderboardPage,
      pageSize: leaderboardPageSize,
      total,
      totalPages: Math.ceil(total / leaderboardPageSize),
    },
  };

  if (item.kind === "f1") {
    normalized.rounds = arrayFrom(detail.rounds ?? detail.data?.rounds ?? detail)
      .map(normalizeF1Round)
      .filter((round) => round.id || round.name || round.startTime || round.raceTime);
  } else {
    normalized.stages = arrayFrom(detail.stages ?? detail.data?.stages)
      .map(normalizeStage)
      .filter((stage) => stage.id || stage.name || stage.fixtures.length);
  }

  return normalized;
}

function normalizeStage(stage = {}) {
  return {
    id: text(stage.id),
    name: text(stage.stageName || stage.name),
    status: text(stage.status),
    startTime: isoTime(stage.startTime),
    endTime: isoTime(stage.endTime || stage.lockTime),
    fixtures: arrayFrom(stage.markets ?? stage.fixtures).map((fixture) => normalizeFixture(fixture, stage)),
  };
}

function normalizeFixture(fixture = {}, stage = {}) {
  const teams = [fixture.teamAName, fixture.teamBName].filter(Boolean).map(String);
  const score = fixture.score ?? fixture.scores ?? fixture.result?.score ?? fixture.result?.scores ?? {};
  const winner = fixture.winner ?? fixture.result?.winner ?? fixture.outcome ?? fixture.result?.outcome ?? "";
  return {
    id: text(fixture.id),
    title: text(fixture.title || fixture.name || (teams.length === 2 ? teams.join(" vs ") : "")),
    teams,
    status: text(fixture.status || stage.status),
    startTime: isoTime(fixture.startTime || stage.startTime),
    lockTime: isoTime(fixture.lockTime || stage.lockTime),
    endTime: isoTime(fixture.endTime || fixture.expiryTime || stage.endTime),
    homeScore: numberOrNull(score.home ?? score.a ?? score.teamA ?? fixture.homeScore ?? fixture.home_score),
    awayScore: numberOrNull(score.away ?? score.b ?? score.teamB ?? fixture.awayScore ?? fixture.away_score),
    winner: winnerFrom(winner, teams),
  };
}

function normalizeF1Round(round = {}) {
  const events = arrayFrom(round.events);
  const qualifying = events.find((event) => text(event.eventType).toUpperCase() === "QUALIFYING");
  const race = events.find((event) => text(event.eventType).toUpperCase() === "RACE");
  return {
    id: text(round.id),
    number: finiteNumber(round.roundNumber),
    name: text(round.gpName || round.name),
    circuit: text(round.circuitName),
    country: text(round.country),
    status: text(round.status),
    startTime: isoTime(round.startDate || qualifying?.lockTime || race?.lockTime),
    qualifyingTime: isoTime(qualifying?.lockTime),
    raceTime: isoTime(race?.lockTime || round.endDate),
  };
}

function normalizeLeaderboard(payload) {
  const rows = arrayFrom(
    payload?.leaderboard
    ?? payload?.entries
    ?? payload?.rows
    ?? payload?.data?.leaderboard
    ?? payload?.data?.entries
    ?? payload?.data,
  );

  return rows.map((row) => ({
    rank: numberOrNull(row.rank),
    name: text(row.username || row.name || row.displayName || row.wallet || row.address),
    wallet: text(row.wallet || row.address),
    avatarUrl: text(row.avatarUrl || row.avatar),
    score: numberOrNull(row.points ?? row.score ?? row.totalPoints ?? row.seasonPoints ?? row.wins),
    eloRating: numberOrNull(row.eloRating),
    racesParticipated: numberOrNull(row.racesParticipated),
    stagesPlayed: numberOrNull(row.stagesPlayed),
    status: text(row.status),
  })).filter((row) => row.name);
}

function arrayFrom(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function finiteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoTime(value) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function valueOrNull(value) {
  return value === undefined || value === null || value === "" ? null : String(value);
}

function winnerFrom(winner, teams = []) {
  if (typeof winner === "number") return teams[winner] || "";
  if (typeof winner === "string") return winner.trim();
  if (winner && typeof winner === "object") {
    return winner.name || winner.label || winner.title || winner.team || winner.option || "";
  }
  return "";
}
