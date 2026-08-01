const PRIORITY_SPORTS = ["Football", "Formula 1"];
const TOKEN_DECIMALS = 18n;
const EXPLORER_SESSION_CACHE_KEY = "haramball-explorer-items-v1";
const EXPLORER_SESSION_CACHE_TTL_MS = 5 * 60 * 1000;
let explorerCache = null;
let explorerRequest = null;

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

export async function fetchTournamentDetail(slug, pagination) {
  const params = new URLSearchParams({ slug });
  if (pagination) {
    params.set("leaderboardPage", String(pagination.leaderboardPage));
    params.set("leaderboardPageSize", String(pagination.leaderboardPageSize));
  }
  const response = await fetch(`/api/tournament?${params}`, {
    headers: { Accept: "application/json" },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || `Tournament returned ${response.status}`);
  return payload?.tournament || null;
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

export function filterExplorerItems(items = [], { query = "", sport = "All", status = "All" } = {}) {
  const needle = String(query).trim().toLowerCase();

  return items
    .filter((item) => sport === "All" || item.sport === sport)
    .filter((item) => status === "All" || item.status === status)
    .filter((item) => !needle || String(item.searchText || [item.name, item.sport, item.league].join(" ")).toLowerCase().includes(needle))
    .sort(compareExplorerItems);
}

export function explorerSports(items = []) {
  const sports = [...new Set(items.map((item) => item.sport).filter(Boolean))];
  return [
    "All",
    ...PRIORITY_SPORTS.filter((sport) => sports.includes(sport)),
    ...sports.filter((sport) => !PRIORITY_SPORTS.includes(sport)).sort((left, right) => left.localeCompare(right)),
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

function compareExplorerItems(left, right) {
  const statusDifference = statusValue(left.status) - statusValue(right.status);
  if (statusDifference) return statusDifference;

  const dateDifference = left.status === "ended"
    ? dateValue(right.endTime || right.startTime) - dateValue(left.endTime || left.startTime)
    : dateValue(left.startTime) - dateValue(right.startTime);
  return dateDifference || String(left.name).localeCompare(String(right.name));
}

function statusValue(status) {
  return { live: 0, upcoming: 1, ended: 2 }[status] ?? 3;
}
