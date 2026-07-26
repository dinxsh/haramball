const PRIORITY_SPORTS = ["Football", "Formula 1"];
const TOKEN_DECIMALS = 18n;

export async function fetchExplorerItems() {
  const response = await fetch("/api/explorer", { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error?.message || `Explorer returned ${response.status}`);
  }

  return Array.isArray(payload?.items) ? payload.items : [];
}

export function filterExplorerItems(items = [], { query = "", sport = "All", status = "All" } = {}) {
  const needle = String(query).trim().toLowerCase();

  return items
    .filter((item) => sport === "All" || item.sport === sport)
    .filter((item) => status === "All" || item.status === status)
    .filter((item) => !needle || String(item.searchText || [item.name, item.sport, item.league].join(" ")).toLowerCase().includes(needle))
    .sort((left, right) => dateValue(left.startTime) - dateValue(right.startTime)
      || String(left.name).localeCompare(String(right.name)));
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
