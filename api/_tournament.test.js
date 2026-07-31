import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTournamentDetail } from "./_tournament.js";

test("normalizes football stages, fixtures, and tournament leaderboard", () => {
  const result = normalizeTournamentDetail({
    item: {
      id: "football-12345678",
      slug: "nations-cup-football",
      kind: "tournament",
      name: "Nations Cup",
      sport: "Football",
      league: "International",
      status: "live",
      startTime: "2026-07-27T12:00:00.000Z",
      endTime: "2026-07-28T18:00:00.000Z",
    },
    source: { description: "International knockout competition", format: "KNOCKOUT", entryCount: 14 },
    detail: {
      stages: [{
        id: "semi-final",
        stageName: "Semi Final",
        status: "LIVE",
        markets: [{
          id: "fixture-1",
          title: "Japan vs Morocco",
          teamAName: "Japan",
          teamBName: "Morocco",
          startTime: "2026-07-27T12:00:00.000Z",
          lockTime: "2026-07-27T11:45:00.000Z",
          winner: "Japan",
          score: { home: 2, away: 1 },
        }],
      }],
    },
    leaderboard: { leaderboard: [{ rank: 1, username: "dinesh", points: 18 }] },
  });

  assert.equal(result.description, "International knockout competition");
  assert.equal(result.stages[0].name, "Semi Final");
  assert.deepEqual(result.stages[0].fixtures[0].teams, ["Japan", "Morocco"]);
  assert.equal(result.stages[0].fixtures[0].winner, "Japan");
  assert.equal(result.stages[0].fixtures[0].homeScore, 2);
  assert.equal(result.stages[0].fixtures[0].awayScore, 1);
  assert.equal(result.leaderboard[0].name, "dinesh");
  assert.equal(result.leaderboard[0].score, 18);
  assert.equal("rounds" in result, false);
});

test("normalizes F1 rounds without inventing missing leaderboard data", () => {
  const result = normalizeTournamentDetail({
    item: {
      id: "f1-12345678",
      slug: "f1-2026-grid-predictor-f1123456",
      kind: "f1",
      name: "F1 2026 Grid Predictor",
      sport: "Formula 1",
      league: "",
      status: "upcoming",
    },
    source: { description: "Season grid predictor" },
    detail: {
      rounds: [{
        id: "dutch-gp",
        roundNumber: 14,
        gpName: "Dutch Grand Prix",
        circuitName: "Circuit Zandvoort",
        country: "Netherlands",
        startDate: "2026-08-22T17:00:00.000Z",
        events: [{ eventType: "RACE", lockTime: "2026-08-23T12:00:00.000Z" }],
      }],
    },
    leaderboard: null,
  });

  assert.equal(result.rounds[0].name, "Dutch Grand Prix");
  assert.equal(result.rounds[0].raceTime, "2026-08-23T12:00:00.000Z");
  assert.deepEqual(result.leaderboard, []);
  assert.equal("stages" in result, false);
});

test("normalizes and paginates the fields Bento publishes for F1 leaderboard entries", () => {
  const result = normalizeTournamentDetail({
    item: { id: "f1", slug: "f1-12345678", kind: "f1", name: "F1" },
    detail: { rounds: [] },
    leaderboard: {
      total: 3,
      entries: [
        { rank: 1, wallet: "0xone", seasonPoints: 0, eloRating: 1000, racesParticipated: 0 },
        { rank: 1, wallet: "0xtwo", seasonPoints: 12, eloRating: 1012, racesParticipated: 1 },
        { rank: 3, wallet: "0xthree", seasonPoints: 8, eloRating: 1008, racesParticipated: 1 },
      ],
    },
    leaderboardPage: 2,
    leaderboardPageSize: 2,
  });

  assert.deepEqual(result.leaderboard, [{
    rank: 3,
    name: "0xthree",
    wallet: "0xthree",
    avatarUrl: "",
    score: 8,
    eloRating: 1008,
    racesParticipated: 1,
    stagesPlayed: null,
    status: "",
  }]);
  assert.deepEqual(result.leaderboardPagination, { page: 2, pageSize: 2, total: 3, totalPages: 2 });
});

test("preserves a server-paged football leaderboard and its total entry count", () => {
  const result = normalizeTournamentDetail({
    item: { id: "cup", slug: "cup-12345678", kind: "tournament", name: "Cup" },
    detail: { stages: [] },
    leaderboard: {
      leaderboard: [{ rank: 3, wallet: "0xthree", totalPoints: "900", stagesPlayed: 2 }],
      stats: { totalEntries: 3 },
    },
    leaderboardPage: 2,
    leaderboardPageSize: 2,
    leaderboardIsPaged: true,
  });

  assert.equal(result.leaderboard.length, 1);
  assert.equal(result.leaderboard[0].score, 900);
  assert.deepEqual(result.leaderboardPagination, { page: 2, pageSize: 2, total: 3, totalPages: 2 });
});

test("does not invent leaderboard rank or score when Bento omits them", () => {
  const result = normalizeTournamentDetail({
    item: { id: "cup", slug: "cup-12345678", kind: "tournament", name: "Cup" },
    detail: { stages: [] },
    leaderboard: { entries: [{ username: "verified-player" }] },
  });

  assert.deepEqual(result.leaderboard, [{
    rank: null,
    name: "verified-player",
    wallet: "",
    avatarUrl: "",
    score: null,
    eloRating: null,
    racesParticipated: null,
    stagesPlayed: null,
    status: "",
  }]);
});
