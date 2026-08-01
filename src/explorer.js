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
const TOURNAMENT_DETAIL_SESSION_CACHE_PREFIX = "haramball-tournament-detail-v1:";
const EXPLORER_SESSION_CACHE_TTL_MS = 5 * 60 * 1000;
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
      return Promise.resolve(sessionItems);
    }
  }
  if (!refresh && explorerRequest) return explorerRequest;

  const request = requestExplorerItems().then((items) => {
    explorerCache = items;
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
  try {
    if (typeof sessionStorage === "undefined") return [];
    const cached = JSON.parse(sessionStorage.getItem(EXPLORER_SESSION_CACHE_KEY) || "null");
    if (!cached || !Array.isArray(cached.items)) return [];
    if (now - Number(cached.savedAt || 0) > EXPLORER_SESSION_CACHE_TTL_MS) return [];
    return cached.items;
  } catch {
    return [];
  }
}

function writeCachedExplorerItems(items) {
  try {
    if (typeof sessionStorage === "undefined" || !Array.isArray(items)) return;
    sessionStorage.setItem(EXPLORER_SESSION_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), items }));
  } catch {
    // Cache is an optimization only; private browsing or quota errors should not block Explorer.
  }
}

function clearCachedExplorerItems() {
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(EXPLORER_SESSION_CACHE_KEY);
  } catch {}
}

function readCachedTournamentDetail(slug, { now = Date.now() } = {}) {
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
    const cached = tournamentDetailCache.get(slug) || readCachedTournamentDetail(slug);
    if (cached) {
      tournamentDetailCache.set(slug, cached);
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
