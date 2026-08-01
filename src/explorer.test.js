import assert from "node:assert/strict";
import test from "node:test";
import * as explorerModule from "./explorer.js";
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

test("shows Bento sport filters plus catalog-specific extras", () => {
  assert.deepEqual(explorerSports(items), [
    "All",
    "Cricket",
    "Football",
    "Basketball",
    "Hockey",
    "Formula 1",
    "American Football",
    "Baseball",
    "Tennis",
    "Esports",
    "Rugby",
  ]);
});

test("filters lifecycle and orders nearest dates first", () => {
  assert.deepEqual(
    filterExplorerItems(items, { query: "", sport: "All", status: "All" }).map((item) => item.id),
    ["football-live", "f1-14", "cricket", "football-ended"],
  );
  assert.deepEqual(
    filterExplorerItems(items, { query: "", sport: "Football", status: "ended" }).map((item) => item.id),
    ["football-ended"],
  );
});

test("sorts Explorer catalog by 24hr volume when provided", () => {
  assert.deepEqual(
    filterExplorerItems([
      { ...items[0], volume24h: 5 },
      { ...items[1], volume24h: 20 },
      { ...items[2], volume24h: 10 },
    ], { query: "", sort: "volume24h", sport: "All", status: "All" }).map((item) => item.id),
    ["football-live", "football-ended", "f1-14"],
  );
});

test("defaults explorer status to the whole catalog", () => {
  assert.equal(explorerModule.defaultExplorerStatus(), "All");
  assert.equal(explorerModule.defaultExplorerStatus("live"), "live");
});

test("keeps explorer schedule expansion separate from selected competition entry", () => {
  assert.deepEqual(
    explorerModule.nextExplorerModalState(
      { expandedId: "", selectedSlug: "" },
      { type: "toggle-schedule", itemId: "f1-14" },
    ),
    { expandedId: "f1-14", selectedSlug: "" },
  );
  assert.deepEqual(
    explorerModule.nextExplorerModalState(
      { expandedId: "f1-14", selectedSlug: "" },
      { type: "select-tournament", slug: "f1-14" },
    ),
    { expandedId: "", selectedSlug: "f1-14" },
  );
});

test("shows explorer skeleton immediately while an opened modal has not loaded", () => {
  assert.equal(
    explorerModule.shouldShowExplorerSkeleton({ open: true, loaded: false, error: "", loading: false }),
    true,
  );
  assert.equal(
    explorerModule.shouldShowExplorerSkeleton({ open: true, loaded: true, error: "", loading: false }),
    false,
  );
  assert.equal(
    explorerModule.shouldShowExplorerSkeleton({ open: true, loaded: false, error: "offline", loading: false }),
    false,
  );
});

test("formats Bento base-unit prize pools without floating point loss", () => {
  assert.equal(formatExplorerPrize("25000000000000000000", "usdc"), "25 USDC");
  assert.equal(formatExplorerPrize(null, "credits"), "");
});

test("prefetch shares one request with modal loading and refresh bypasses the cache", async () => {
  assert.equal(typeof explorerModule.preloadExplorerItems, "function");

  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  let releaseRequest;
  const requestGate = new Promise((resolve) => { releaseRequest = resolve; });
  globalThis.fetch = async () => {
    fetchCount += 1;
    await requestGate;
    return { ok: true, json: async () => ({ items: [items[0]] }) };
  };

  try {
    const preload = explorerModule.preloadExplorerItems();
    const modalLoad = explorerModule.fetchExplorerItems();
    assert.equal(fetchCount, 1);
    releaseRequest();
    assert.deepEqual(await preload, [items[0]]);
    assert.deepEqual(await modalLoad, [items[0]]);

    await explorerModule.fetchExplorerItems();
    assert.equal(fetchCount, 1);

    await explorerModule.fetchExplorerItems({ refresh: true });
    assert.equal(fetchCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("uses fresh session Explorer cache before making a network request", async () => {
  assert.equal(typeof explorerModule.readCachedExplorerItems, "function");
  explorerModule.resetExplorerCache();

  const originalFetch = globalThis.fetch;
  const originalSessionStorage = globalThis.sessionStorage;
  const storage = new Map();
  globalThis.sessionStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  };
  globalThis.fetch = async () => {
    throw new Error("network should not be needed for fresh cache");
  };

  try {
    storage.set("haramball-explorer-items-v1", JSON.stringify({
      savedAt: Date.now(),
      items: [items[2]],
    }));

    assert.deepEqual(await explorerModule.fetchExplorerItems(), [items[2]]);
    assert.deepEqual(explorerModule.readCachedExplorerItems(), [items[2]]);
  } finally {
    explorerModule.resetExplorerCache();
    globalThis.fetch = originalFetch;
    if (originalSessionStorage === undefined) {
      delete globalThis.sessionStorage;
    } else {
      globalThis.sessionStorage = originalSessionStorage;
    }
  }
});

test("a failed prefetch leaves the modal load free to retry", async () => {
  assert.equal(typeof explorerModule.resetExplorerCache, "function");
  explorerModule.resetExplorerCache();

  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    if (fetchCount === 1) throw new Error("temporary outage");
    return { ok: true, json: async () => ({ items: [items[1]] }) };
  };

  try {
    await assert.rejects(explorerModule.preloadExplorerItems(), /temporary outage/);
    assert.deepEqual(await explorerModule.fetchExplorerItems(), [items[1]]);
    assert.equal(fetchCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("parses canonical tournament paths without treating other routes as tournaments", () => {
  assert.equal(
    explorerModule.tournamentSlugFromPath("/tournaments/world-cup-tournament-c774b2e1"),
    "world-cup-tournament-c774b2e1",
  );
  assert.equal(explorerModule.tournamentSlugFromPath("/profiles/dinesh"), "");
  assert.equal(explorerModule.tournamentSlugFromPath("/tournaments/"), "");
});

test("fetches details for the selected tournament slug", async () => {
  explorerModule.resetExplorerCache();
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return { ok: true, json: async () => ({ tournament: { slug: "world-cup-c774b2e1" } }) };
  };

  try {
    assert.deepEqual(
      await explorerModule.fetchTournamentDetail("world-cup-c774b2e1"),
      { slug: "world-cup-c774b2e1" },
    );
    assert.equal(requestedUrl, "/api/tournament?slug=world-cup-c774b2e1");
  } finally {
    globalThis.fetch = originalFetch;
    explorerModule.resetExplorerCache();
  }
});

test("dedupes and caches tournament detail requests for bracket previews", async () => {
  explorerModule.resetExplorerCache();
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  let releaseRequest;
  const requestGate = new Promise((resolve) => { releaseRequest = resolve; });
  globalThis.fetch = async () => {
    fetchCount += 1;
    await requestGate;
    return { ok: true, json: async () => ({ tournament: { slug: "f1-2026-grid-predictor-f1season" } }) };
  };

  try {
    const preload = explorerModule.preloadTournamentDetail("f1-2026-grid-predictor-f1season");
    const expand = explorerModule.fetchTournamentDetail("f1-2026-grid-predictor-f1season");
    assert.equal(fetchCount, 1);
    releaseRequest();
    assert.deepEqual(await preload, { slug: "f1-2026-grid-predictor-f1season" });
    assert.deepEqual(await expand, { slug: "f1-2026-grid-predictor-f1season" });

    await explorerModule.fetchTournamentDetail("f1-2026-grid-predictor-f1season");
    assert.equal(fetchCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
    explorerModule.resetExplorerCache();
  }
});

test("fetches a selected leaderboard page without losing the tournament slug", async () => {
  explorerModule.resetExplorerCache();
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return { ok: true, json: async () => ({ tournament: { slug: "world-cup-c774b2e1" } }) };
  };

  try {
    await explorerModule.fetchTournamentDetail("world-cup-c774b2e1", { leaderboardPage: 2, leaderboardPageSize: 10 });
    assert.equal(
      requestedUrl,
      "/api/tournament?slug=world-cup-c774b2e1&leaderboardPage=2&leaderboardPageSize=10",
    );
  } finally {
    globalThis.fetch = originalFetch;
    explorerModule.resetExplorerCache();
  }
});
