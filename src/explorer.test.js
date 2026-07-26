import assert from "node:assert/strict";
import test from "node:test";
import { explorerSports, filterExplorerItems, formatExplorerPrize } from "./explorer.js";

const items = [
  {
    id: "f1-14",
    name: "F1 2026 Grid Predictor",
    sport: "Formula 1",
    league: "",
    status: "upcoming",
    startTime: "2026-08-22T17:00:00.000Z",
    searchText: "F1 2026 Grid Predictor Formula 1 Dutch Grand Prix Circuit Zandvoort Netherlands",
  },
  {
    id: "football-live",
    name: "Nations Cup",
    sport: "Football",
    league: "International",
    status: "live",
    startTime: "2026-07-27T12:00:00.000Z",
    searchText: "Nations Cup Football International Japan Morocco",
  },
  {
    id: "football-ended",
    name: "World Cup Tournament",
    sport: "Football",
    league: "World Cup",
    status: "ended",
    startTime: "2026-07-17T15:30:00.000Z",
    searchText: "World Cup Tournament Football France England",
  },
  {
    id: "cricket",
    name: "Champions Trophy",
    sport: "Cricket",
    league: "ICC",
    status: "upcoming",
    startTime: "2026-09-01T12:00:00.000Z",
    searchText: "Champions Trophy Cricket ICC",
  },
];

test("searches league, team, Grand Prix, circuit, and country metadata", () => {
  for (const query of ["zandvoort", "dutch grand prix", "netherlands"]) {
    assert.deepEqual(
      filterExplorerItems(items, { query, sport: "All", status: "upcoming" }).map((item) => item.id),
      ["f1-14"],
      query,
    );
  }

  assert.deepEqual(
    filterExplorerItems(items, { query: "morocco", sport: "Football", status: "live" }).map((item) => item.id),
    ["football-live"],
  );
});

test("derives prioritized sports from valid catalog items", () => {
  assert.deepEqual(explorerSports(items), ["All", "Football", "Formula 1", "Cricket"]);
});

test("filters lifecycle and orders nearest dates first", () => {
  assert.deepEqual(
    filterExplorerItems(items, { query: "", sport: "All", status: "All" }).map((item) => item.id),
    ["football-ended", "football-live", "f1-14", "cricket"],
  );
  assert.deepEqual(
    filterExplorerItems(items, { query: "", sport: "Football", status: "ended" }).map((item) => item.id),
    ["football-ended"],
  );
});

test("formats Bento base-unit prize pools without floating point loss", () => {
  assert.equal(formatExplorerPrize("25000000000000000000", "usdc"), "25 USDC");
  assert.equal(formatExplorerPrize(null, "credits"), "");
});
