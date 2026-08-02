import { normalizeTournamentDetail } from "./_tournament.js";

const TERMINAL_STATUSES = new Set(["completed", "ended", "resolved", "settled"]);
const REJECTED_STATUSES = new Set(["canceled", "cancelled", "discarded"]);
const TEST_RECORD_PATTERN = /\b(?:e2e|sdk|test|demo|mock)\b/i;

export function isExplorerCandidate(row = {}) {
  const status = normalizeStatus(row.status);
  const identity = [row.name, row.description, row.league].filter(Boolean).join(" ");

  return Boolean(
    row.id
    && String(row.name || "").trim()
    && String(row.sport || "").trim()
    && !REJECTED_STATUSES.has(status)
    && !TEST_RECORD_PATTERN.test(identity),
  );
}

export function tournamentSlug(row = {}) {
  const name = String(row.name || "tournament")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "tournament";
  const idPrefix = String(row.id || "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 8);
  return idPrefix ? `${name}-${idPrefix}` : name;
}

export function resolveTournamentSlug(tournaments = [], slug = "") {
  const idPrefix = String(slug).toLowerCase().split("-").at(-1);
  if (!/^[a-z0-9]{8}$/.test(idPrefix)) return null;

  const matches = tournaments.filter((row) => isExplorerCandidate(row)
    && String(row.id).toLowerCase().replace(/[^a-z0-9]+/g, "").startsWith(idPrefix));
  return matches.length === 1 ? matches[0] : null;
}

export async function buildExplorerCatalog({
  tournaments = [],
  loadTournament,
  loadF1Rounds,
  now = Date.now(),
  concurrency = 4,
} = {}) {
  const candidates = tournaments.filter(isExplorerCandidate);
  const items = await mapWithConcurrency(candidates, concurrency, async (row) => {
    const kind = isF1(row) ? "f1" : "tournament";
    let enrichment = null;

    try {
      enrichment = kind === "f1"
        ? await loadF1Rounds(row.id)
        : await loadTournament(row.id);
    } catch {
      enrichment = null;
    }

    const item = normalizeExplorerTournament(row, enrichment, now);
    if (!item) return null;

    return {
      ...item,
      ...(enrichment ? {
        detailPreview: normalizeTournamentDetail({
          item,
          source: row,
          detail: enrichment,
          leaderboard: null,
        }),
      } : {}),
    };
  });

  return items.filter(Boolean).sort(compareExplorerItems);
}

function compareExplorerItems(left, right) {
  const statusDifference = statusSortValue(left.status) - statusSortValue(right.status);
  if (statusDifference) return statusDifference;

  const leftDate = dateSortValue(left.endTime || left.startTime);
  const rightDate = dateSortValue(right.endTime || right.startTime);
  const dateDifference = left.status === "ended" ? rightDate - leftDate : leftDate - rightDate;
  return dateDifference || left.name.localeCompare(right.name);
}

export function normalizeExplorerTournament(row = {}, enrichment, now = Date.now()) {
  if (!isExplorerCandidate(row)) return null;

  const kind = isF1(row) ? "f1" : "tournament";
  const sourceStatus = String(row.status || "").trim();
  const terminal = TERMINAL_STATUSES.has(normalizeStatus(sourceStatus));
  const schedule = kind === "f1"
    ? f1Schedule(enrichment, now, terminal)
    : tournamentSchedule(enrichment, now, terminal);

  const status = terminal ? "ended" : lifecycleFromSchedule(schedule, now) || lifecycleFromSourceStatus(sourceStatus) || "listed";

  const nextEvent = schedule?.nextEvent || null;
  const sport = displaySport(row.sport || row.category || row.gameType);
  const category = displaySport(row.category || row.sport || row.gameType);
  const searchText = [
    row.name,
    row.description,
    sport,
    row.league,
    category,
    row.format,
    row.gameType,
    ...(schedule?.searchValues || []),
  ].filter(Boolean).join(" ");

  return {
    id: String(row.id),
    slug: tournamentSlug(row),
    kind,
    name: String(row.name).trim(),
    sport,
    category,
    league: String(row.league || "").trim(),
    status,
    startTime: schedule?.startTime || null,
    endTime: schedule?.endTime || null,
    nextEvent,
    format: String(row.format || row.gameType || "").trim(),
    entryCount: finiteNumber(row.entryCount),
    prizePool: valueOrNull(row.prizePool),
    stakeAsset: String(row.stakeAsset || row.config?.stakeAsset || "").trim(),
    volume24h: finiteNumber(row.volume24h ?? row.volume24hr ?? row.volume24H ?? row["24hrVolume"] ?? row.volume_24h),
    volume: finiteNumber(row.volume ?? row.totalVolume ?? row.total_volume),
    searchText,
    sourceStatus,
  };
}

function f1Schedule(enrichment, now, terminal) {
  const rounds = arrayFrom(enrichment?.rounds ?? enrichment)
    .map((round) => normalizeF1Round(round))
    .filter((round) => round.startTime || round.endTime)
    .sort((left, right) => dateSortValue(left.startTime || left.endTime) - dateSortValue(right.startTime || right.endTime));

  if (!rounds.length) return null;

  const selected = terminal
    ? rounds.at(-1)
    : rounds.find((round) => Math.max(parseTime(round.endTime), parseTime(round.startTime)) >= now);

  if (!selected) return null;

  return {
    startTime: selected.startTime,
    endTime: selected.endTime,
    nextEvent: selected,
    searchValues: [selected.gpName, selected.circuitName, selected.country],
  };
}

function normalizeF1Round(round = {}) {
  const events = arrayFrom(round.events);
  const qualifying = events.find((event) => String(event.eventType || "").toUpperCase() === "QUALIFYING");
  const race = events.find((event) => String(event.eventType || "").toUpperCase() === "RACE");
  const startTime = isoTime(round.startDate || qualifying?.lockTime || race?.lockTime);
  const endTime = isoTime(race?.lockTime || round.endDate || startTime);

  return {
    id: String(round.id || ""),
    roundNumber: finiteNumber(round.roundNumber),
    gpName: String(round.gpName || "").trim(),
    circuitName: String(round.circuitName || "").trim(),
    country: String(round.country || "").trim(),
    status: String(round.status || "").trim(),
    qualifyingTime: isoTime(qualifying?.lockTime),
    raceTime: isoTime(race?.lockTime),
    startTime,
    endTime,
  };
}

function tournamentSchedule(enrichment, now, terminal) {
  const stages = arrayFrom(enrichment?.stages);
  const events = stages.flatMap((stage) => {
    const markets = arrayFrom(stage.markets ?? stage.fixtures);
    if (!markets.length) return [normalizeStage(stage)];
    return markets.map((market) => normalizeTournamentEvent(stage, market));
  }).filter((event) => event.startTime || event.endTime);

  if (!events.length) return null;

  events.sort((left, right) => dateSortValue(left.startTime || left.endTime) - dateSortValue(right.startTime || right.endTime));
  const selected = terminal
    ? events.at(-1)
    : events.find((event) => Math.max(parseTime(event.endTime), parseTime(event.startTime)) >= now);

  if (!selected) return null;

  return {
    startTime: selected.startTime,
    endTime: selected.endTime,
    nextEvent: selected,
    searchValues: [selected.title, selected.stageName, ...(selected.teams || [])],
  };
}

function normalizeStage(stage = {}) {
  return {
    id: String(stage.id || ""),
    stageId: String(stage.id || ""),
    stageName: String(stage.stageName || "").trim(),
    title: String(stage.stageName || "Tournament stage").trim(),
    teams: [],
    status: String(stage.status || "").trim(),
    startTime: isoTime(stage.startTime),
    lockTime: isoTime(stage.lockTime),
    endTime: isoTime(stage.endTime || stage.lockTime),
  };
}

function normalizeTournamentEvent(stage = {}, event = {}) {
  return {
    id: String(event.id || ""),
    stageId: String(stage.id || ""),
    stageName: String(stage.stageName || "").trim(),
    title: String(event.title || stage.stageName || "Tournament fixture").trim(),
    teams: [event.teamAName, event.teamBName].filter(Boolean).map(String),
    status: String(event.status || stage.status || "").trim(),
    startTime: isoTime(event.startTime || stage.startTime),
    lockTime: isoTime(event.lockTime || stage.lockTime),
    endTime: isoTime(event.endTime || event.expiryTime || stage.endTime || event.lockTime || stage.lockTime),
  };
}

function lifecycleFromSchedule(schedule, now) {
  const start = parseTime(schedule?.startTime);
  const end = parseTime(schedule?.endTime);
  if (start > now) return "upcoming";
  if (start && start <= now && (!end || end >= now)) return "live";
  if (!start && end >= now) return "upcoming";
  return null;
}

function lifecycleFromSourceStatus(value) {
  const status = normalizeStatus(value);
  if (["active", "live", "open", "running"].includes(status)) return "live";
  if (["upcoming", "created", "draft", "scheduled", "pending"].includes(status)) return "upcoming";
  return "";
}

async function mapWithConcurrency(values, concurrency, mapper) {
  const results = new Array(values.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(Number(concurrency) || 1, values.length || 1));

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await mapper(values[index], index);
    }
  }));

  return results;
}

function isF1(row) {
  return String(row.gameType || "").toUpperCase() === "F1_GRID_PREDICTOR"
    || /^formula\s*1$/i.test(String(row.sport || ""));
}

function displaySport(value) {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!normalized) return "";
  if (/formula\s*1|f1/.test(normalized)) return "Formula 1";
  if (/american football|nfl/.test(normalized)) return "American Football";
  if (/e\s*sports|esports/.test(normalized)) return "Esports";
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function arrayFrom(value) {
  return Array.isArray(value) ? value : [];
}

function parseTime(value) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoTime(value) {
  const parsed = parseTime(value);
  return parsed ? new Date(parsed).toISOString() : null;
}

function dateSortValue(value) {
  return parseTime(value) || Number.MAX_SAFE_INTEGER;
}

function statusSortValue(status) {
  return { live: 0, upcoming: 1, ended: 2 }[status] ?? 3;
}

function finiteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function valueOrNull(value) {
  return value === undefined || value === null || value === "" ? null : String(value);
}
