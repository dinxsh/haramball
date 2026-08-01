import assert from "node:assert/strict";
import test from "node:test";
import { buildExplorerCatalog, resolveTournamentSlug, tournamentSlug } from "./_explorer.js";

const NOW = Date.parse("2026-07-27T00:00:00.000Z");

const completedFootball = {
  id: "world-cup",
  name: "World Cup Tournament",
  description: "FIFA World Cup group stage",
  sport: "Football",
  league: "World Cup",
  gameType: "CLASSIC",
  format: "GROUP_KNOCKOUT",
  status: "COMPLETED",
  entryCount: 12,
  prizePool: "5000000000000000000",
  stakeAsset: "credits",
};

const f1Season = {
  id: "f1-season",
  name: "F1 2026 Grid Predictor",
  description: "Predict the full season",
  sport: "Formula 1",
  gameType: "F1_GRID_PREDICTOR",
  status: "LIVE",
  entryCount: 8,
  prizePool: "25000000000000000000",
  stakeAsset: "usdc",
};

test("builds readable ID-backed slugs and resolves only verified tournaments", () => {
  const tournament = { ...completedFootball, id: "c774b2e1ba9b65f845745eca" };
  const slug = tournamentSlug(tournament);

  assert.equal(slug, "world-cup-tournament-c774b2e1");
  assert.equal(resolveTournamentSlug([tournament], slug)?.id, tournament.id);
  assert.equal(resolveTournamentSlug([{ ...tournament, name: "Test World Cup" }], "test-world-cup-c774b2e1"), null);
  assert.equal(resolveTournamentSlug([tournament], "world-cup-tournament-deadbeef"), null);
});

test("curates real football and F1 records without test or canceled data", async () => {
  const items = await buildExplorerCatalog({
    tournaments: [
      completedFootball,
      f1Season,
      { ...completedFootball, id: "e2e", name: "E2E SDK 123", status: "LIVE" },
      { ...completedFootball, id: "test", name: "Test Cup" },
      { ...completedFootball, id: "canceled", name: "Community Cup", status: "CANCELED" },
      { id: "missing-name", sport: "Football", status: "LIVE" },
    ],
    loadTournament: async () => ({
      stages: [{
        id: "group-stage",
        status: "SETTLED",
        startTime: "2026-07-17T15:30:00.000Z",
        endTime: "2026-07-20T00:16:04.372Z",
        markets: [{ title: "France vs England", teamAName: "France", teamBName: "England", startTime: "2026-07-17T15:30:00.000Z" }],
      }],
    }),
    loadF1Rounds: async () => ({
      rounds: [{
        id: "dutch-gp",
        roundNumber: 14,
        gpName: "Dutch Grand Prix",
        circuitName: "Circuit Zandvoort",
        country: "Netherlands",
        startDate: "2026-08-22T17:00:00.000Z",
        status: "UPCOMING",
        events: [
          { eventType: "QUALIFYING", lockTime: "2026-08-22T17:00:00.000Z", status: "OPEN" },
          { eventType: "RACE", lockTime: "2026-08-23T12:00:00.000Z", status: "OPEN" },
        ],
      }],
    }),
    now: NOW,
  });

  assert.deepEqual(items.map((item) => item.name), ["F1 2026 Grid Predictor", "World Cup Tournament"]);
  assert.equal(items[0].kind, "f1");
  assert.equal(items[0].slug, "f1-2026-grid-predictor-f1season");
  assert.equal(items[0].status, "upcoming");
  assert.equal(items[0].nextEvent.gpName, "Dutch Grand Prix");
  assert.equal(items[0].nextEvent.raceTime, "2026-08-23T12:00:00.000Z");
  assert.match(items[0].searchText, /zandvoort/i);
  assert.equal(items[1].status, "ended");
  assert.equal(items[1].nextEvent.title, "France vs England");
  assert.match(items[1].searchText, /france england/i);
});

test("keeps stale live rows listed instead of hiding Bento tournaments", async () => {
  const stale = {
    ...completedFootball,
    id: "stale-live",
    name: "Summer Cup",
    status: "LIVE",
  };

  const items = await buildExplorerCatalog({
    tournaments: [stale],
    loadTournament: async () => ({
      stages: [{
        id: "stage-1",
        status: "LIVE",
        startTime: "2026-07-10T00:00:00.000Z",
        endTime: "2026-07-20T00:00:00.000Z",
      }],
    }),
    loadF1Rounds: async () => ({ rounds: [] }),
    now: NOW,
  });

  assert.deepEqual(items.map((item) => [item.id, item.status, item.startTime]), [["stale-live", "live", null]]);
});

test("normalizes the next football stage from wrapped tournament details", async () => {
  const upcoming = {
    ...completedFootball,
    id: "nations-cup",
    name: "Nations Cup",
    league: "International",
    status: "ACTIVE",
  };

  const items = await buildExplorerCatalog({
    tournaments: [upcoming],
    loadTournament: async () => ({
      tournament: upcoming,
      stages: [{
        id: "stage-2",
        stageName: "Quarter Finals",
        status: "UPCOMING",
        startTime: "2026-08-02T16:00:00.000Z",
        lockTime: "2026-08-02T15:45:00.000Z",
        endTime: "2026-08-02T20:00:00.000Z",
        markets: [{
          id: "match-1",
          title: "Japan vs Morocco",
          teamAName: "Japan",
          teamBName: "Morocco",
          startTime: "2026-08-02T16:00:00.000Z",
          lockTime: "2026-08-02T15:45:00.000Z",
        }],
      }],
    }),
    loadF1Rounds: async () => ({ rounds: [] }),
    now: NOW,
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].status, "upcoming");
  assert.equal(items[0].startTime, "2026-08-02T16:00:00.000Z");
  assert.deepEqual(items[0].nextEvent.teams, ["Japan", "Morocco"]);
});

test("keeps active records listed when enrichment fails", async () => {
  const items = await buildExplorerCatalog({
    tournaments: [
      { ...completedFootball, id: "active", name: "Active Cup", status: "LIVE" },
      completedFootball,
    ],
    loadTournament: async () => {
      throw new Error("upstream unavailable");
    },
    loadF1Rounds: async () => ({ rounds: [] }),
    now: NOW,
  });

  assert.deepEqual(items.map((item) => [item.id, item.status]), [["active", "live"], ["world-cup", "ended"]]);
});

test("keeps same-league aliases so Explorer shows every Bento tournament", async () => {
  const duplicate = { ...completedFootball, id: "world-cup-copy" };
  const laterEdition = { ...completedFootball, id: "world-cup-later", name: "FIFA World Cup Tournament" };

  const items = await buildExplorerCatalog({
    tournaments: [completedFootball, duplicate, laterEdition],
    loadTournament: async (id) => ({
      stages: [{
        id: `stage-${id}`,
        stageName: "Final",
        startTime: id === "world-cup-later" ? "2026-07-24T16:00:00.000Z" : "2026-07-17T16:00:00.000Z",
        endTime: id === "world-cup-later" ? "2026-07-26T18:00:00.000Z" : "2026-07-19T18:00:00.000Z",
        markets: [{ title: id === "world-cup-later" ? "Spain vs Argentina" : "France vs England" }],
      }],
    }),
    loadF1Rounds: async () => ({ rounds: [] }),
    now: NOW,
  });

  assert.deepEqual(items.map((item) => item.id), ["world-cup-later", "world-cup", "world-cup-copy"]);
});

test("orders live competitions before upcoming and ended records", async () => {
  const tournaments = [
    { ...completedFootball, id: "ended", name: "Ended Cup", league: "Ended League" },
    { ...completedFootball, id: "upcoming", name: "Future Cup", league: "Future League", status: "ACTIVE" },
    { ...completedFootball, id: "live", name: "Live Cup", league: "Live League", status: "ACTIVE" },
  ];

  const items = await buildExplorerCatalog({
    tournaments,
    loadTournament: async (id) => ({
      stages: [{
        id: `stage-${id}`,
        startTime: id === "upcoming" ? "2026-08-02T16:00:00.000Z" : "2026-07-26T16:00:00.000Z",
        endTime: id === "live" ? "2026-07-28T18:00:00.000Z" : "2026-08-02T18:00:00.000Z",
      }],
    }),
    loadF1Rounds: async () => ({ rounds: [] }),
    now: NOW,
  });

  assert.deepEqual(items.map((item) => [item.id, item.status]), [
    ["live", "live"],
    ["upcoming", "upcoming"],
    ["ended", "ended"],
  ]);
});
