export const BENTO_SPORT_FILTERS = [
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
];

export const EXPLORER_SORTS = [
  { value: "volume24h", label: "24hr volume" },
  { value: "startTime", label: "Start time" },
  { value: "status", label: "Status" },
  { value: "name", label: "Name" },
];

const TOKEN_DECIMALS = 18n;
const EXPLORER_SESSION_CACHE_KEY = "haramball-explorer-items-v1";
const EXPLORER_LOCAL_CACHE_KEY = "haramball-explorer-items-v2";
const TOURNAMENT_DETAIL_SESSION_CACHE_PREFIX = "haramball-tournament-detail-v1:";
const EXPLORER_SESSION_CACHE_TTL_MS = 5 * 60 * 1000;
const EXPLORER_LOCAL_CACHE_TTL_MS = 30 * 60 * 1000;
let explorerCache = null;
let explorerRequest = null;
const tournamentDetailCache = new Map();
const tournamentDetailRequests = new Map();

export function defaultExplorerStatus(status) {
  return status || "All";
}

export function fetchExplorerItems({ refresh = false } = {}) {
  if (!refresh && explorerCache) return Promise.resolve(explorerCache);
  if (!refresh) {
    const sessionItems = readCachedExplorerItems();
    if (sessionItems.length) {
      explorerCache = sessionItems;
      seedTournamentDetailsFromItems(sessionItems);
      return Promise.resolve(sessionItems);
    }
  }
  if (!refresh && explorerRequest) return explorerRequest;

  const request = requestExplorerItems().then((items) => {
    explorerCache = items;
    seedTournamentDetailsFromItems(items);
    writeCachedExplorerItems(items);
    return items;
  }).finally(() => {
    if (explorerRequest === request) explorerRequest = null;
  });

  explorerRequest = request;
  return request;
}

export function preloadExplorerItems() {
  return fetchExplorerItems();
}

export function resetExplorerCache() {
  explorerCache = null;
  explorerRequest = null;
  tournamentDetailCache.clear();
  tournamentDetailRequests.clear();
  clearCachedExplorerItems();
}

export function readCachedExplorerItems({ now = Date.now() } = {}) {
  const sessionItems = readCachedExplorerItemsFromStorage("sessionStorage", EXPLORER_SESSION_CACHE_KEY, EXPLORER_SESSION_CACHE_TTL_MS, now);
  if (sessionItems.length) return sessionItems;
  return readCachedExplorerItemsFromStorage("localStorage", EXPLORER_LOCAL_CACHE_KEY, EXPLORER_LOCAL_CACHE_TTL_MS, now);
}

function readCachedExplorerItemsFromStorage(storageName, key, ttl, now) {
  try {
    const storage = globalThis?.[storageName];
    if (!storage) return [];
    const cached = JSON.parse(storage.getItem(key) || "null");
    if (!cached || !Array.isArray(cached.items)) return [];
    if (now - Number(cached.savedAt || 0) > ttl) return [];
    return cached.items;
  } catch {
    return [];
  }
}

function writeCachedExplorerItems(items) {
  if (!Array.isArray(items)) return;
  const payload = JSON.stringify({ savedAt: Date.now(), items });
  try { if (typeof sessionStorage !== "undefined") sessionStorage.setItem(EXPLORER_SESSION_CACHE_KEY, payload); } catch {}
  try { if (typeof localStorage !== "undefined") localStorage.setItem(EXPLORER_LOCAL_CACHE_KEY, payload); } catch {}
}

function clearCachedExplorerItems() {
  try { if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(EXPLORER_SESSION_CACHE_KEY); } catch {}
  try { if (typeof localStorage !== "undefined") localStorage.removeItem(EXPLORER_LOCAL_CACHE_KEY); } catch {}
}

export function readCachedTournamentDetail(slug, { now = Date.now() } = {}) {
  try {
    if (typeof sessionStorage === "undefined" || !slug) return null;
    const cached = JSON.parse(sessionStorage.getItem(`${TOURNAMENT_DETAIL_SESSION_CACHE_PREFIX}${slug}`) || "null");
    if (!cached || !cached.tournament) return null;
    if (now - Number(cached.savedAt || 0) > EXPLORER_SESSION_CACHE_TTL_MS) return null;
    return cached.tournament;
  } catch {
    return null;
  }
}

function writeCachedTournamentDetail(slug, tournament) {
  try {
    if (typeof sessionStorage === "undefined" || !slug || !tournament) return;
    sessionStorage.setItem(`${TOURNAMENT_DETAIL_SESSION_CACHE_PREFIX}${slug}`, JSON.stringify({
      savedAt: Date.now(),
      tournament,
    }));
  } catch {
    // Detail cache only improves perceived speed; storage failures should stay silent.
  }
}

export function nextExplorerModalState(state = {}, action = {}) {
  if (action.type === "toggle-schedule") {
    const nextExpandedId = state.expandedId === action.itemId ? "" : action.itemId;
    return { expandedId: nextExpandedId, selectedSlug: state.selectedSlug || "" };
  }

  if (action.type === "select-tournament") {
    return { expandedId: "", selectedSlug: action.slug || "" };
  }

  return {
    expandedId: state.expandedId || "",
    selectedSlug: state.selectedSlug || "",
  };
}

export function shouldShowExplorerSkeleton({ open = false, loaded = false, error = "", loading = false } = {}) {
  return Boolean(open && !loaded && !error && (loading || !loaded));
}

export function tournamentSlugFromPath(pathname = "") {
  const match = String(pathname).match(/^\/tournaments\/([^/]+)\/?$/);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return "";
  }
}

export function preloadTournamentDetail(slug) {
  return fetchTournamentDetail(slug).catch(() => null);
}

export async function fetchTournamentDetail(slug, pagination) {
  const cacheable = !pagination;
  if (cacheable) {
    const cached = tournamentDetailCache.get(slug) || readCachedTournamentDetail(slug) || detailPreviewFromExplorerCache(slug);
    if (cached) {
      tournamentDetailCache.set(slug, cached);
      writeCachedTournamentDetail(slug, cached);
      return cached;
    }
    if (tournamentDetailRequests.has(slug)) return tournamentDetailRequests.get(slug);
  }

  const params = new URLSearchParams({ slug });
  if (pagination) {
    params.set("leaderboardPage", String(pagination.leaderboardPage));
    params.set("leaderboardPageSize", String(pagination.leaderboardPageSize));
  }

  const request = fetch(`/api/tournament?${params}`, {
    headers: { Accept: "application/json" },
  }).then(async (response) => {
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error?.message || `Tournament returned ${response.status}`);
    const tournament = payload?.tournament || null;
    if (cacheable && tournament) {
      tournamentDetailCache.set(slug, tournament);
      writeCachedTournamentDetail(slug, tournament);
    }
    return tournament;
  }).finally(() => {
    if (cacheable) tournamentDetailRequests.delete(slug);
  });

  if (cacheable) tournamentDetailRequests.set(slug, request);
  return request;
}

function seedTournamentDetailsFromItems(items = []) {
  items.forEach((item) => {
    const detail = detailPreviewFromItem(item);
    if (!detail?.slug) return;
    tournamentDetailCache.set(detail.slug, detail);
    writeCachedTournamentDetail(detail.slug, detail);
  });
}

function detailPreviewFromExplorerCache(slug) {
  const memoryPreview = (explorerCache || []).find((item) => item.slug === slug);
  const cachedPreview = memoryPreview || readCachedExplorerItems().find((item) => item.slug === slug);
  return detailPreviewFromItem(cachedPreview);
}

export function detailPreviewFromItem(item = {}) {
  const preview = item?.detailPreview || null;
  if (!preview) return null;
  return { ...preview, slug: preview.slug || item.slug };
}

export async function fetchTournamentStatus(slug, { token, wallet } = {}) {
  const params = new URLSearchParams({ route: "status", slug });
  if (wallet) params.set("wallet", wallet);
  const response = await fetch(`/api/tournament?${params}`, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || `Tournament status returned ${response.status}`);
  return payload?.status || null;
}

export async function enterTournament({ token, ...body }) {
  const response = await fetch("/api/tournament?route=enter", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || `Tournament enter returned ${response.status}`);
  return payload?.entry || null;
}

async function requestExplorerItems() {
  const response = await fetch("/api/explorer", { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => null);

  if (!response.ok) throw new Error(payload?.error?.message || `Explorer returned ${response.status}`);

  return Array.isArray(payload?.items) ? payload.items : [];
}

export function filterExplorerItems(items = [], { query = "", sort = "volume24h", sport = "All", status = "All" } = {}) {
  const needle = String(query).trim().toLowerCase();

  return items
    .filter((item) => sport === "All" || item.sport === sport || item.category === sport)
    .filter((item) => status === "All" || item.status === status)
    .filter((item) => !needle || String(item.searchText || [item.name, item.sport, item.category, item.league].join(" ")).toLowerCase().includes(needle))
    .sort((left, right) => compareExplorerItems(left, right, sort));
}

export function explorerSports(items = []) {
  const sports = [...new Set(items.flatMap((item) => [item.sport, item.category]).filter(Boolean))];
  return [
    ...BENTO_SPORT_FILTERS,
    ...sports.filter((sport) => !BENTO_SPORT_FILTERS.includes(sport)).sort((left, right) => left.localeCompare(right)),
  ];
}

export const LIVE_CENTRE_SPORTS = [
  "Football",
  "Cricket",
  "Formula 1",
  "American Football",
  "Basketball",
  "Baseball",
  "Tennis",
];

export const LIVE_CENTRE_LEAGUES = [
  "All Live",
  "WC",
  "EPL",
  "LaLiga",
  "SerieA",
  "BL",
  "L1",
  "UCL",
  "UEL",
  "EFL",
  "FA",
  "LL2",
  "CDR",
  "SerieB",
  "CI",
  "ERE",
];

const LEAGUE_ALIASES = {
  WC: ["world cup", "wc"],
  EPL: ["premier league", "epl"],
  LaLiga: ["la liga", "laliga"],
  SerieA: ["serie a", "seriea"],
  BL: ["bundesliga", "bl"],
  L1: ["ligue 1", "l1"],
  UCL: ["champions league", "ucl"],
  UEL: ["europa league", "uel"],
  EFL: ["efl", "championship"],
  FA: ["fa cup"],
  LL2: ["la liga 2", "laliga2", "ll2"],
  CDR: ["copa del rey", "cdr"],
  SerieB: ["serie b", "serieb"],
  CI: ["coppa italia", "ci"],
  ERE: ["eredivisie", "ere"],
};

export function buildLiveCentreRows(items = [], feeds = {}) {
  const feedRows = [
    ...feedItemsFrom(feeds.fixtures, "fixture"),
    ...feedItemsFrom(feeds.calendar, "calendar"),
    ...feedItemsFrom(feeds.liveFeed, "live"),
  ];
  const catalogRows = (Array.isArray(items) ? items : []).map((item) => liveRowFromExplorerItem(item));
  const byKey = new Map();

  for (const row of [...catalogRows, ...feedRows].filter(Boolean)) {
    const key = row.slug || row.id || `${row.title}-${row.sport}-${row.startsAt}`;
    const current = byKey.get(key);
    byKey.set(key, current ? { ...row, ...current, source: [current.source, row.source].filter(Boolean).join("+") } : row);
  }

  return [...byKey.values()].sort((left, right) => statusValue(left.status) - statusValue(right.status) || dateValue(left.startsAt) - dateValue(right.startsAt));
}

export function filterLiveCentreRows(rows = [], { league = "All Live", query = "", section = "matches", sport = "Football" } = {}) {
  const needle = String(query || "").trim().toLowerCase();
  const normalizedSport = String(sport || "").toLowerCase();

  return (Array.isArray(rows) ? rows : [])
    .filter((row) => !normalizedSport || row.sport.toLowerCase() === normalizedSport || row.category.toLowerCase() === normalizedSport)
    .filter((row) => league === "All Live" || leagueMatches(row, league))
    .filter((row) => {
      if (section === "results") return row.status === "ended";
      if (section === "standings") return true;
      return row.status !== "ended";
    })
    .filter((row) => !needle || row.searchText.toLowerCase().includes(needle));
}

export function liveCentreStats(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    matches: list.length,
    live: list.filter((row) => row.status === "live").length,
    upcoming: list.filter((row) => row.status === "upcoming" || row.status === "listed").length,
    ended: list.filter((row) => row.status === "ended").length,
    sports: new Set(list.map((row) => row.sport).filter(Boolean)).size,
  };
}

export function formatExplorerDate(value, { dateOnly = false } = {}) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(undefined, dateOnly
    ? { day: "numeric", month: "short", year: "numeric" }
    : { day: "numeric", hour: "numeric", minute: "2-digit", month: "short", year: "numeric" })
    .format(date);
}

export function formatExplorerPrize(value, stakeAsset = "") {
  if (value === undefined || value === null || value === "") return "";

  try {
    const amount = BigInt(String(value));
    const base = 10n ** TOKEN_DECIMALS;
    const whole = amount / base;
    const fraction = String(amount % base).padStart(Number(TOKEN_DECIMALS), "0").slice(0, 2).replace(/0+$/, "");
    const formatted = fraction ? `${whole}.${fraction}` : String(whole);
    return `${formatted} ${String(stakeAsset || "tokens").toUpperCase()}`;
  } catch {
    return "";
  }
}

function dateValue(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function compareExplorerItems(left, right, sort = "volume24h") {
  if (sort === "volume24h") {
    const volumeDifference = Number(right.volume24h || right.volume || 0) - Number(left.volume24h || left.volume || 0);
    if (volumeDifference) return volumeDifference;
  }
  if (sort === "name") return String(left.name).localeCompare(String(right.name));

  const statusDifference = statusValue(left.status) - statusValue(right.status);
  if (statusDifference && sort !== "startTime") return statusDifference;

  const dateDifference = left.status === "ended"
    ? dateValue(right.endTime || right.startTime) - dateValue(left.endTime || left.startTime)
    : dateValue(left.startTime) - dateValue(right.startTime);
  return dateDifference || String(left.name).localeCompare(String(right.name));
}

function statusValue(status) {
  return { live: 0, upcoming: 1, listed: 2, ended: 3 }[status] ?? 4;
}

function liveRowFromExplorerItem(item = {}) {
  const sport = item.sport || item.category || "Football";
  const league = item.league || leagueFromSearchText(item.searchText) || (sport === "Football" ? "Tournament" : sport);
  return {
    id: String(item.id || item.slug || item.name),
    slug: item.slug,
    title: String(item.name || "Bento tournament"),
    subtitle: [league, item.status].filter(Boolean).join(" - "),
    sport: String(sport),
    category: String(item.category || sport),
    league: String(league),
    status: normalizeLiveStatus(item.status),
    startsAt: item.startTime || item.nextEventTime || "",
    entries: Number(item.entries || item.participants || 0) || 0,
    pool: item.prizePool || item.pool || "",
    source: "tournament-catalog",
    searchText: String(item.searchText || [item.name, sport, league, item.category].join(" ")),
  };
}

function feedItemsFrom(source, kind) {
  const rows = listFromFeed(source);
  return rows.map((item, index) => liveRowFromFeedItem(item, kind, index)).filter(Boolean);
}

function liveRowFromFeedItem(item = {}, kind = "feed", index = 0) {
  const title = item.title || item.name || item.fixtureName || item.matchName || item.eventName || item.homeName && item.awayName && `${item.homeName} vs ${item.awayName}`;
  if (!title) return null;
  const sport = item.sport || item.sportName || item.category || "Football";
  const league = item.league || item.leagueName || item.competition || item.tournament || item.section || "";
  return {
    id: String(item.id || item.fixtureId || item.marketId || `${kind}-${index}-${title}`),
    slug: item.slug || item.tournamentSlug || "",
    title: String(title),
    subtitle: String(item.subtitle || item.statusText || league || kind),
    sport: String(sport),
    category: String(item.category || sport),
    league: String(league || sport),
    status: normalizeLiveStatus(item.status || item.state || item.fixtureStatus),
    startsAt: item.startsAt || item.startTime || item.kickoff || item.date || item.createdAt || "",
    entries: Number(item.entries || item.participants || 0) || 0,
    pool: item.pool || item.prizePool || "",
    source: `bento-${kind}`,
    searchText: String([title, sport, league, item.subtitle, item.statusText].filter(Boolean).join(" ")),
    raw: item,
  };
}

function listFromFeed(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.fixtures)) return value.fixtures;
  if (Array.isArray(value.matches)) return value.matches;
  if (Array.isArray(value.events)) return value.events;
  if (Array.isArray(value.sections)) return value.sections.flatMap(listFromFeed);
  return [];
}

function normalizeLiveStatus(value) {
  const status = String(value || "").toLowerCase();
  if (/live|running|active|in[-_\s]?play/.test(status)) return "live";
  if (/end|final|settled|result|complete|closed/.test(status)) return "ended";
  if (/upcoming|scheduled|future|open|listed/.test(status)) return "upcoming";
  return "listed";
}

function leagueMatches(row, league) {
  const aliases = LEAGUE_ALIASES[league] || [league];
  const haystack = String([row.league, row.title, row.subtitle, row.searchText].filter(Boolean).join(" ")).toLowerCase();
  return aliases.some((alias) => haystack.includes(String(alias).toLowerCase()));
}

function leagueFromSearchText(value = "") {
  const haystack = String(value).toLowerCase();
  for (const [league, aliases] of Object.entries(LEAGUE_ALIASES)) {
    if (aliases.some((alias) => haystack.includes(alias))) return league;
  }
  return "";
}
