import { createBentoSdk, jwtAuthProvider, walletAuthProvider } from "@bento.fun/sdk";
import { buildExplorerCatalog, normalizeExplorerTournament, resolveTournamentSlug } from "./_explorer.js";
import { normalizeTournamentDetail } from "./_tournament.js";

const DEFAULT_BENTO_URL = "https://internal-server.bento.fun";

export function getBentoServerConfig() {
  const baseUrl = stripTrailingSlash(process.env.BENTO_URL || DEFAULT_BENTO_URL);
  const tournamentsBaseUrl = stripTrailingSlash(
    process.env.PARLAY_TOURNMENT_URL || process.env.PARLAY_TOURNAMENT_URL || "",
  );
  const apiKey = process.env.BENTO_BUILDER_API_KEY || process.env.BUILDER_API_KEY;

  return {
    baseUrl,
    tournamentsBaseUrl,
    apiKey,
    configured: hasValue(apiKey),
    missing: [!hasValue(apiKey) ? "BENTO_BUILDER_API_KEY or BUILDER_API_KEY" : null].filter(Boolean),
  };
}

export function bentoReadinessPayload() {
  const config = getBentoServerConfig();

  return {
    baseUrl: config.baseUrl,
    tournamentsBaseUrl: config.tournamentsBaseUrl || null,
    configured: config.configured,
    hasBuilderApiKey: hasValue(config.apiKey),
    missing: config.missing.map(displayMissingKey),
  };
}

export async function fetchBentoMarkets({ page = 1, limit = 20 } = {}) {
  const sdk = createPublicBentoSdk();
  const payload = await sdk.public.listDuels({ page: numberOr(page, 1), limit: numberOr(limit, 20) });
  return {
    raw: payload,
    markets: listFrom(payload?.data ?? payload?.markets ?? payload?.duels ?? payload).map(normalizeBentoMarket),
  };
}

export async function fetchBentoExplorer({ now = Date.now() } = {}) {
  const config = requireConfiguredBento();
  if (!config.tournamentsBaseUrl) {
    throw httpError(503, "Tournament Explorer requires the tournaments host", true);
  }

  const sdk = createPublicBentoSdk();
  if (!sdk.tournaments) {
    throw httpError(503, "Tournament Explorer is unavailable", true);
  }

  const payload = await sdk.tournaments.tournaments.list({ limit: 100, offset: 0 });
  const tournaments = Array.isArray(payload?.tournaments) ? payload.tournaments : [];
  const items = await buildExplorerCatalog({
    tournaments,
    loadTournament: (id) => sdk.tournaments.tournaments.getById(id),
    loadF1Rounds: (id) => sdk.tournaments.f1.listRounds(id),
    now,
    concurrency: 4,
  });

  return { items };
}

export async function fetchBentoTournament(slug, {
  now = Date.now(),
  leaderboardPage = 1,
  leaderboardPageSize = 10,
} = {}) {
  const config = requireConfiguredBento();
  if (!config.tournamentsBaseUrl) {
    throw httpError(503, "Tournament details require the tournaments host", true);
  }

  const sdk = createPublicBentoSdk();
  const payload = await sdk.tournaments.tournaments.list({ limit: 100, offset: 0 });
  const tournaments = Array.isArray(payload?.tournaments) ? payload.tournaments : [];
  const source = resolveTournamentSlug(tournaments, slug);
  if (!source) throw httpError(404, "Verified tournament not found", true);

  const isF1 = String(source.gameType || "").toUpperCase() === "F1_GRID_PREDICTOR"
    || /^formula\s*1$/i.test(String(source.sport || ""));
  let detail;
  let sourceDetail = source;
  let leaderboard = null;
  let leaderboardIsPaged = false;

  if (isF1) {
    const [tournamentPayload, roundsPayload, leaderboardPayload] = await Promise.all([
      sdk.tournaments.f1.getTournament(source.id).catch(() => null),
      sdk.tournaments.f1.listRounds(source.id),
      sdk.tournaments.f1.getSeasonLeaderboard(source.id).catch(() => null),
    ]);
    sourceDetail = { ...source, ...(tournamentPayload?.tournament || tournamentPayload || {}) };
    detail = roundsPayload;
    leaderboard = leaderboardPayload;
  } else {
    const offset = (leaderboardPage - 1) * leaderboardPageSize;
    [detail, leaderboard] = await Promise.all([
      sdk.tournaments.tournaments.getById(source.id),
      sdk.tournaments.tournaments.getLeaderboard(source.id, {
        limit: leaderboardPageSize,
        offset,
      }).catch(() => null),
    ]);
    leaderboardIsPaged = true;
    sourceDetail = { ...source, ...(detail?.tournament || {}) };
  }

  const item = normalizeExplorerTournament(source, detail, now);
  if (!item) throw httpError(404, "Verified tournament is unavailable", true);

  return {
    tournament: normalizeTournamentDetail({
      item,
      source: sourceDetail,
      detail,
      leaderboard,
      leaderboardPage,
      leaderboardPageSize,
      leaderboardIsPaged,
    }),
  };
}

export async function fetchBentoTournamentStatus({ slug, token, wallet } = {}) {
  if (!token) throw httpError(401, "Bento login is required");
  const { sdk, source, isF1 } = await resolveTournamentForSlug(slug, token);

  if (isF1) {
    const [eligibility, myPicks, payouts] = await Promise.all([
      wallet ? sdk.tournaments.f1.getEligibility(source.id, wallet).catch((error) => ({ error: error.message })) : null,
      wallet ? sdk.tournaments.f1.getMyPicks(source.id, wallet).catch((error) => ({ error: error.message })) : null,
      sdk.tournaments.f1.getPayouts(source.id).catch((error) => ({ error: error.message })),
    ]);
    return { status: { kind: "f1", tournamentId: source.id, eligibility, myPicks, payouts } };
  }

  const [eligibility, myStatus, formatInfo, payouts] = await Promise.all([
    sdk.tournaments.tournaments.getEligibility(source.id).catch((error) => ({ error: error.message })),
    sdk.tournaments.tournaments.getMyStatus(source.id).catch((error) => ({ error: error.message })),
    sdk.tournaments.tournaments.getFormatInfo(source.id).catch((error) => ({ error: error.message })),
    sdk.tournaments.tournaments.getPayouts(source.id).catch((error) => ({ error: error.message })),
  ]);
  return { status: { kind: "tournament", tournamentId: source.id, eligibility, myStatus, formatInfo, payouts } };
}

export async function enterBentoTournament({ slug, token, wallet, ...body } = {}) {
  if (!token) throw httpError(401, "Bento login is required");
  const { sdk, source, isF1 } = await resolveTournamentForSlug(slug, token);
  const payload = {
    ...body,
    ...(wallet ? { wallet } : {}),
  };
  const entry = isF1
    ? await sdk.tournaments.f1.enter(source.id, payload)
    : await sdk.tournaments.tournaments.enter(source.id, payload);
  return { entry: { kind: isF1 ? "f1" : "tournament", tournamentId: source.id, raw: entry } };
}

export async function fetchBentoMarketAnalytics(duelId) {
  if (!duelId) throw httpError(400, "duelId is required");
  const sdk = createPublicBentoSdk();
  const [yesPercentageSnapshots, sellUnlockLiquidity, platformReport, protocolSummary] = await Promise.all([
    sdk.public.publicBets.getYesPercentageSnapshots(duelId).catch((error) => ({ error: error.message })),
    sdk.public.publicBets.getSellUnlockLiquidity(duelId).catch((error) => ({ error: error.message })),
    sdk.public.analytics.getPlatformReport().catch((error) => ({ error: error.message })),
    sdk.public.protocolStats.getSummary().catch((error) => ({ error: error.message })),
  ]);
  return { analytics: { duelId, yesPercentageSnapshots, sellUnlockLiquidity, platformReport, protocolSummary } };
}

export async function fetchBentoUserShares({ token, duelId }) {
  if (!token) throw httpError(401, "Bento login is required");
  if (!duelId) throw httpError(400, "duelId is required");
  const sdk = createUserBentoSdk(token);
  return { shares: await sdk.user.bets.getUserShares({ duelId }) };
}

export async function estimateBentoSell({ token, ...body }) {
  if (!token) throw httpError(401, "Bento login is required");
  if (!body.duelId) throw httpError(400, "duelId is required");
  const sdk = createUserBentoSdk(token);
  return sdk.user.bets.estimateSell(normalizeSellBetNumbers(body));
}

export async function sellBentoBet({ token, idempotencyKey, sell }) {
  if (!token) throw httpError(401, "Bento login is required");
  if (!sell?.duelId) throw httpError(400, "duelId is required");
  const sdk = createUserBentoSdk(token);
  return sdk.user.bets.sellBet(normalizeSellBetNumbers(sell), idempotencyKey ? { idempotencyKey } : undefined);
}

export async function fetchBentoMarket(duelId) {
  if (!duelId) throw httpError(400, "duelId is required");

  const sdk = createPublicBentoSdk();
  const payload = await sdk.public.getDuelById({ duelId });
  return {
    raw: payload,
    market: normalizeBentoMarket(payload?.data ?? payload?.market ?? payload?.duel ?? payload),
  };
}

export async function loginBentoUser({ address, signature, timestamp, username, inviteCode }) {
  if (!address) throw httpError(400, "address is required");
  if (!signature) throw httpError(400, "signature is required");
  if (!timestamp) throw httpError(400, "timestamp is required");

  const sdk = createPublicBentoSdk();
  const login = await sdk.public.auth.eoaLogin({ address, signature, timestamp });
  const token = login?.token || login?.data?.token;
  const exists = login?.exists ?? login?.data?.exists;
  if (token || exists !== false) return login;

  const safeUsername = usernameFrom(username || address);
  const registerPayload = {
    address,
    signature,
    timestamp,
    ...(inviteCode || process.env.BENTO_INVITE_CODE ? { inviteCode: inviteCode || process.env.BENTO_INVITE_CODE } : {}),
  };

  try {
    return await sdk.public.auth.eoaRegister({ ...registerPayload, username: safeUsername });
  } catch (error) {
    if ((error.sdkError?.status || error.statusCode || error.status) !== 409) throw error;
    return sdk.public.auth.eoaRegister({
      ...registerPayload,
      username: usernameFrom(`${safeUsername}-${String(address).slice(2, 10)}`),
    });
  }
}

export async function createBentoExternalLink({ returnUrl, state }) {
  if (!returnUrl) throw httpError(400, "returnUrl is required");
  const sdk = createPublicBentoSdk();
  return sdk.public.externalLink.getLinkUrl({ returnUrl, state });
}

export async function exchangeBentoExternalLink({ code }) {
  if (!code) throw httpError(400, "code is required");
  const sdk = createPublicBentoSdk();
  return sdk.public.externalLink.exchange({ code });
}

export async function estimateBentoBet({ token, duelId, optionIndex, betAmountUsdc, slippageBps = 100 }) {
  if (!token) throw httpError(401, "Bento login is required");
  if (!duelId) throw httpError(400, "duelId is required");
  if (optionIndex === undefined || optionIndex === null) throw httpError(400, "optionIndex is required");
  if (!betAmountUsdc) throw httpError(400, "betAmountUsdc is required");

  const sdk = createUserBentoSdk(token);
  return sdk.user.bets.estimateBuy({
    duelId,
    optionIndex: Number(optionIndex),
    betAmountUsdc,
    slippageBps: Number(slippageBps),
  });
}

export async function placeBentoBet({ token, idempotencyKey, bet }) {
  if (!token) throw httpError(401, "Bento login is required");
  if (!bet?.duelId) throw httpError(400, "duelId is required");

  const sdk = createUserBentoSdk(token);
  if (bet.estimate) {
    return sdk.user.bets.placeBetFromEstimate(bet, idempotencyKey ? { idempotencyKey } : undefined);
  }
  return sdk.user.bets.placeBet(normalizePlaceBetNumbers(bet), idempotencyKey ? { idempotencyKey } : undefined);
}

export async function fetchBentoPortfolio({ token, account }) {
  if (!token && !account) throw httpError(401, "Bento login or account is required");

  const sdk = token ? createUserBentoSdk(token) : createPublicBentoSdk();
  const client = token ? sdk.user.portfolio : sdk.public.portfolio;
  const params = account ? { account } : {};
  const [details, positions] = await Promise.all([
    client.getAccountDetails(params).catch((error) => ({ error: error.message })),
    client.getPositions(params).catch((error) => ({ error: error.message })),
  ]);

  return { details, positions };
}

export function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

export async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw httpError(400, "Request body must be valid JSON", true);
  }
}

export function handleApiError(response, error) {
  const statusCode = error.statusCode || error.status || error.sdkError?.status || 500;
  const requestId = error.sdkError?.requestId;
  const message = error.sdkError?.message || error.message;
  sendJson(response, statusCode, {
    error: {
      message: error.expose || statusCode < 500 ? message : "Bento request failed",
      statusCode,
      ...(requestId ? { requestId } : {}),
    },
  });
}

function createPublicBentoSdk() {
  const config = requireConfiguredBento();
  return createBentoSdk({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    tournamentsBaseUrl: config.tournamentsBaseUrl || undefined,
    auth: walletAuthProvider(() => ({})),
  });
}

function createUserBentoSdk(token) {
  const config = requireConfiguredBento();
  return createBentoSdk({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    tournamentsBaseUrl: config.tournamentsBaseUrl || undefined,
    auth: walletAuthProvider(() => ({ Authorization: `Bearer ${token}` })),
    tournamentsAuth: jwtAuthProvider({ getAccessToken: () => token }),
  });
}

async function resolveTournamentForSlug(slug, token) {
  if (!slug) throw httpError(400, "Tournament slug is required", true);
  const sdk = token ? createUserBentoSdk(token) : createPublicBentoSdk();
  if (!sdk.tournaments) throw httpError(503, "Tournament details require the tournaments host", true);
  const payload = await sdk.tournaments.tournaments.list({ limit: 100, offset: 0 });
  const tournaments = Array.isArray(payload?.tournaments) ? payload.tournaments : [];
  const source = resolveTournamentSlug(tournaments, slug);
  if (!source) throw httpError(404, "Verified tournament not found", true);
  const isF1 = String(source.gameType || "").toUpperCase() === "F1_GRID_PREDICTOR"
    || /^formula\s*1$/i.test(String(source.sport || ""));
  return { sdk, source, isF1 };
}

function requireConfiguredBento() {
  const config = getBentoServerConfig();
  if (!config.configured) {
    throw httpError(503, `Missing backend env: ${config.missing.join(", ")}`, true);
  }
  return config;
}

export function normalizeBentoMarket(item = {}) {
  const duelId = item.duelId ?? item.duel_id ?? item.marketId ?? item.id;
  const optionA = item.optionA ?? item.option_a ?? item.options?.[0] ?? item.outcomes?.[0];
  const optionB = item.optionB ?? item.option_b ?? item.options?.[1] ?? item.outcomes?.[1];
  const scoreInfo = scoreFrom(item);
  const score = scoreInfo.value;
  const winner = item.winner ?? item.result?.winner ?? item.outcome ?? item.result?.outcome ?? "";
  const rawTitle =
    item.title ??
    item.question ??
    item.betString ??
    item.bet_string ??
    item.name ??
    item.description;
  const category = item.category ?? item.sport ?? item.type ?? "";
  const endTime = item.endTime ?? item.endsAt ?? item.expiry ?? item.closeTime;
  const fieldCompleteness = {
    title: hasMeaningfulValue(rawTitle),
    optionA: hasMeaningfulValue(optionA),
    optionB: hasMeaningfulValue(optionB),
    category: hasMeaningfulValue(category),
    endTime: hasMeaningfulValue(endTime),
  };

  return {
    id: item.id ?? duelId,
    duelId: duelId ? String(duelId) : "",
    title: rawTitle ? String(rawTitle) : "",
    category: category ? String(category) : "",
    status: item.status ?? item.state ?? item.marketStatus ?? "listed",
    optionA: labelFrom(optionA, ""),
    optionB: labelFrom(optionB, ""),
    winner: winnerFrom(winner, optionA, optionB),
    homeScore: numberOrNull(score.home ?? score.a ?? score.optionA ?? item.homeScore ?? item.home_score),
    awayScore: numberOrNull(score.away ?? score.b ?? score.optionB ?? item.awayScore ?? item.away_score),
    resultSource: scoreInfo.source,
    fieldCompleteness,
    tokenDecimals: tokenDecimalsFromMarket(item),
    liquidity: item.liquidity ?? item.pool ?? item.totalLiquidity ?? item.volume,
    endTime,
    raw: item,
  };
}

function labelFrom(value, fallback) {
  if (typeof value === "string") return value;
  return value?.label ?? value?.name ?? value?.title ?? value?.text ?? fallback;
}

function listFrom(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.markets)) return value.markets;
  if (Array.isArray(value.duels)) return value.duels;
  return [value];
}

function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function winnerFrom(winner, optionA, optionB) {
  if (typeof winner === "number") return winner === 0 ? labelFrom(optionA, "") : labelFrom(optionB, "");
  if (typeof winner === "string") return winner.trim();
  if (winner && typeof winner === "object") {
    return winner.name || winner.label || winner.title || winner.option || "";
  }
  return "";
}

function scoreFrom(item = {}) {
  if (item.result?.score) return { value: item.result.score, source: "result.score.home-away" };
  if (item.result?.scores) return { value: item.result.scores, source: "result.scores.home-away" };
  if (item.raw?.score) return { value: item.raw.score, source: "raw.score.home-away" };
  if (item.raw?.scores) return { value: item.raw.scores, source: "raw.scores.home-away" };
  if (item.score) return { value: item.score, source: scoreHasHomeAway(item.score) ? "score.home-away" : "ambiguous" };
  if (item.scores) return { value: item.scores, source: scoreHasHomeAway(item.scores) ? "scores.home-away" : "ambiguous" };
  if (item.homeScore !== undefined || item.home_score !== undefined || item.awayScore !== undefined || item.away_score !== undefined) {
    return { value: {}, source: "home-away-fields" };
  }
  return { value: {}, source: "" };
}

function scoreHasHomeAway(score = {}) {
  return (score.home !== undefined || score.away !== undefined) && score.optionA === undefined && score.optionB === undefined;
}

function tokenDecimalsFromMarket(item = {}) {
  const explicit = Number(item.tokenDecimals ?? item.token_decimals ?? item.raw?.tokenDecimals ?? item.raw?.token_decimals);
  if (Number.isInteger(explicit) && explicit >= 0 && explicit <= 30) return explicit;
  const collateral = String(item.collateralMode ?? item.collateral_mode ?? item.raw?.collateralMode ?? item.raw?.collateral_mode ?? "").toLowerCase();
  const chain = String(item.chain ?? item.network ?? item.raw?.chain ?? item.raw?.network ?? "").toLowerCase();
  if (collateral === "credits") return 18;
  if (collateral === "usdc" && chain === "base") return 6;
  return 18;
}

function hasValue(value) {
  return Boolean(value && !String(value).startsWith("replace_with"));
}

function hasMeaningfulValue(value) {
  if (value === undefined || value === null || value === "") return false;
  if (typeof value === "object") return Boolean(labelFrom(value, ""));
  return true;
}

function httpError(statusCode, message, expose = statusCode < 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = expose;
  return error;
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/$/, "");
}

function displayMissingKey(key) {
  if (key.includes("BUILDER_API_KEY")) return "builder api key";
  return key.replace("BENTO_", "").toLowerCase().replaceAll("_", " ");
}

function usernameFrom(value) {
  const slug = String(value || "haramball")
    .toLowerCase()
    .replace(/[^a-z0-9_ -]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24)
    .replace(/^-|-$/g, "");
  return slug || "haramball-player";
}

function normalizePlaceBetNumbers(bet) {
  return {
    ...bet,
    optionIndex: Number(bet.optionIndex),
    sharesOut: numberFrom(bet.sharesOut),
    minSharesOut: numberFrom(bet.minSharesOut),
    quoteTimestamp: bet.quoteTimestamp === undefined ? undefined : Number(bet.quoteTimestamp),
    slippageBps: Number(bet.slippageBps ?? 100),
  };
}

function normalizeSellBetNumbers(sell) {
  return {
    ...sell,
    optionIndex: sell.optionIndex === undefined ? undefined : Number(sell.optionIndex),
    sharesIn: numberFrom(sell.sharesIn),
    minAmountOut: numberFrom(sell.minAmountOut),
    slippageBps: sell.slippageBps === undefined ? undefined : Number(sell.slippageBps),
  };
}

function numberFrom(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}
