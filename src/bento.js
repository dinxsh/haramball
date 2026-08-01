const DEFAULT_TOKEN_DECIMALS = 18;
const WEI_PER_TOKEN = 10n ** BigInt(DEFAULT_TOKEN_DECIMALS);

export const initialBentoReadiness = {
  baseUrl: "https://internal-server.bento.fun",
  tournamentsBaseUrl: null,
  configured: false,
  hasBuilderApiKey: false,
  missing: ["builder api key"],
};

export async function fetchBentoReadiness() {
  try {
    return await fetchJson("/api/bento?route=readiness");
  } catch {
    return initialBentoReadiness;
  }
}

export async function fetchBentoMarkets({ page = 1, limit = 20 } = {}) {
  const payload = await fetchJson(`/api/bento?route=markets&page=${page}&limit=${limit}`);
  return payload.markets || [];
}

export async function fetchBentoMarket(duelId) {
  const payload = await fetchJson(`/api/bento?route=market&duelId=${encodeURIComponent(duelId)}`);
  return payload.market;
}

export async function fetchBentoMarketAnalytics(duelId) {
  return fetchJson(`/api/bento?route=market-analytics&duelId=${encodeURIComponent(duelId)}`);
}

export async function fetchBentoUserShares({ token, duelId }) {
  return fetchJson(`/api/bento?route=user-shares&duelId=${encodeURIComponent(duelId)}`, token);
}

export function marketIndexFromDuelId(markets = [], duelId = "") {
  const index = markets.findIndex((market) => String(market?.duelId) === String(duelId));
  return index >= 0 ? index : 0;
}

export function fixtureFromMarket(market) {
  const apiFixture = fixtureFromApiMarket(market);
  if (apiFixture) {
    const home = apiFixture.home || "Live";
    const away = apiFixture.away || "Market";
    return { home, away, label: `${home} vs ${away}`, source: "bento", inferred: false };
  }

  const title = String(market?.title || "");
  const versus = title.match(/\(([^()]+?)\s+(?:vs\.?|v\.?)\s+([^()]+?)\)\s*$/i)
    || title.match(/^(.+?)\s+(?:vs\.?|v\.?|beat|defeat)\s+(.+?)(?:\s+in\s+|\?|$)/i);
  if (versus) {
    const home = cleanTeamName(versus[1]);
    const away = cleanTeamName(versus[2]);
    return { home, away, label: `${home} vs ${away}`, source: "title-inferred", inferred: true };
  }

  const home = market ? market.optionA || "Home" : "Team X";
  const away = market ? market.optionB || "Away" : "Team Y";
  return { home, away, label: `${home} vs ${away}`, source: "option-fallback", inferred: true };
}

function fixtureFromApiMarket(market = {}) {
  const raw = market?.raw || {};
  const teams = raw.teams || raw.match?.teams || raw.fixture?.teams || raw.game?.teams;
  const home = labelFromFixtureValue(
    raw.home ||
    raw.homeTeam ||
    raw.home_team ||
    raw.teamA ||
    raw.team_a ||
    raw.match?.home ||
    raw.match?.homeTeam ||
    raw.fixture?.home ||
    raw.fixture?.homeTeam ||
    (Array.isArray(teams) ? teams[0] : teams?.home),
  );
  const away = labelFromFixtureValue(
    raw.away ||
    raw.awayTeam ||
    raw.away_team ||
    raw.teamB ||
    raw.team_b ||
    raw.match?.away ||
    raw.match?.awayTeam ||
    raw.fixture?.away ||
    raw.fixture?.awayTeam ||
    (Array.isArray(teams) ? teams[1] : teams?.away),
  );
  return home || away ? { home, away } : null;
}

function labelFromFixtureValue(value) {
  if (typeof value === "string") return value.trim();
  return String(value?.name || value?.label || value?.title || value?.country || "").trim();
}

function cleanTeamName(value) {
  return String(value || "")
    .replace(/^will\s+/i, "")
    .replace(/\s+their\s+next.*$/i, "")
    .trim();
}

export async function loginBentoWallet({ address, signature, timestamp, username }) {
  return postJson("/api/bento?route=login", { address, signature, timestamp, username });
}

export async function createBentoWalletLink({ returnUrl, state }) {
  return postJson("/api/bento?route=link", { returnUrl, state });
}

export async function exchangeBentoWalletCode({ code }) {
  return postJson("/api/bento?route=exchange", { code });
}

export async function estimateBentoBet({ token, duelId, optionIndex, amountWei, slippageBps = 100 }) {
  return postJson(
    "/api/bento?route=estimate",
    { duelId, optionIndex, betAmountUsdc: amountWei, slippageBps },
    token,
  );
}

export async function placeBentoBet({ token, idempotencyKey, bet }) {
  return postJson("/api/bento?route=place-bet", { idempotencyKey, bet }, token);
}

export async function fetchBentoPortfolio({ token, account } = {}) {
  return postJson("/api/bento?route=portfolio", { account }, token);
}

export async function estimateBentoSell({ token, ...body }) {
  return postJson("/api/bento?route=sell-estimate", body, token);
}

export async function sellBentoBet({ token, idempotencyKey, sell }) {
  return postJson("/api/bento?route=sell", { idempotencyKey, sell }, token);
}

export async function createBentoMarketDraft({ token, requestId, market }) {
  const payload = await postJson("/api/bento?route=create-market", { requestId, ...market }, token);
  return payload.creation || payload;
}

export async function fetchLeaderboardUsers() {
  const payload = await fetchJson("/api/users");
  return payload.users || [];
}

export async function fetchPrivateGroups() {
  const payload = await fetchJson("/api/groups");
  return payload.groups || [];
}

export async function createPrivateGroup({ name, owner }) {
  const payload = await postJson("/api/groups", { action: "create", name, owner });
  return payload.group;
}

export async function invitePrivateGroup({ groupId, code, target }) {
  const payload = await postJson("/api/groups", { action: "invite", groupId, code, invite: { target } });
  return payload.group;
}

export async function joinPrivateGroup({ code, member }) {
  const payload = await postJson("/api/groups", { action: "join", code, member });
  return payload.group;
}

const TERMINAL_MARKET_STATUSES = new Set([
  "cancelled",
  "canceled",
  "closed",
  "complete",
  "completed",
  "ended",
  "expired",
  "final",
  "finalized",
  "finished",
  "resolved",
  "settled",
]);

export function isBentoMarketEnded(market, now = Date.now()) {
  if (!market) return false;

  const status = String(market.status || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (TERMINAL_MARKET_STATUSES.has(status)) return true;

  const rawEndTime = market.endTime;
  if (rawEndTime === undefined || rawEndTime === null || rawEndTime === "") return false;

  const numericEndTime = Number(rawEndTime);
  const endTime = Number.isFinite(numericEndTime)
    ? numericEndTime < 1e12 ? numericEndTime * 1000 : numericEndTime
    : Date.parse(rawEndTime);

  return Number.isFinite(endTime) && endTime <= now;
}

export function marketResultSummary(market = {}) {
  market ||= {};
  const rawWinner = displayOutcome(market?.winner);
  const fixture = fixtureFromMarket(market);
  const scoreWinner = displayScoreWinnerLabel(market, fixture);
  const winner = scoreWinner || displayWinnerLabel(market, rawWinner);
  const hasSpecificWinner = winner && !/^(yes|no)$/i.test(winner);
  const match = hasSpecificFixture(fixture, market) ? fixture.label : "";
  const score = scoreLabel(market);
  if (!winner || !hasSpecificWinner) {
    const summary = {
      eyebrow: "Bento final result",
      title: "Match final",
      detail: [match, score ? `Final score ${score}` : ""].filter(Boolean).join(" - ") || "Bento has marked this market final.",
      winner: "",
    };
    if (match) summary.match = match;
    if (score) summary.score = score;
    return {
      ...summary,
      ...(match || score ? {} : { title: "Final result pending" }),
    };
  }

  const scoreDetail = scoreWinner && score ? `${winner} won ${score}` : "";
  const summary = {
    eyebrow: "Bento final result",
    title: `Winner: ${winner}`,
    detail: [match, scoreDetail].filter(Boolean).join(" - ") || "Finalized from Bento result data.",
    winner,
  };
  if (match) summary.match = match;
  if (score) summary.score = score;
  return summary;
}

function displayOutcome(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (/^yes$/i.test(normalized)) return "Yes";
  if (/^no$/i.test(normalized)) return "No";
  return normalized;
}

function displayWinnerLabel(market = {}, winner = "") {
  if (!winner) return "";
  if (/^yes$/i.test(winner)) {
    const option = displayOutcome(market.optionA);
    return isSpecificOutcomeLabel(option) ? option : winner;
  }
  if (/^no$/i.test(winner)) {
    const option = displayOutcome(market.optionB);
    return isSpecificOutcomeLabel(option) ? option : winner;
  }
  return winner;
}

function isSpecificOutcomeLabel(value) {
  return Boolean(value && !/^(yes|no)$/i.test(value));
}

function displayScoreWinnerLabel(market = {}, fixture = {}) {
  if (!hasReliableHomeAwayScore(market) || !hasSpecificFixture(fixture, market)) return "";
  if (market.homeScore === market.awayScore) return "";
  return market.homeScore > market.awayScore ? fixture.home : fixture.away;
}

function hasReliableHomeAwayScore(market = {}) {
  return /^(.+\.)?score\.home-away$|^home-away-fields$/i.test(String(market.resultSource || ""))
    && Number.isFinite(market.homeScore)
    && Number.isFinite(market.awayScore);
}

function scoreLabel(market = {}) {
  return Number.isFinite(market.homeScore) && Number.isFinite(market.awayScore)
    ? `${market.homeScore}-${market.awayScore}`
    : "";
}

function hasSpecificFixture(fixture, market = {}) {
  if (!fixture?.label) return false;
  if (fixture.source !== "option-fallback") return true;
  return isSpecificOutcomeLabel(market.optionA) && isSpecificOutcomeLabel(market.optionB);
}

export async function saveLeaderboardUser(user) {
  const payload = await postJson("/api/users", user);
  return payload.user;
}

export async function recordLeaderboardResult({ id, result = "win" }) {
  const response = await fetch("/api/users", {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id, result }),
  });
  return parseResponse(response);
}

export function humanToWei(value) {
  return humanToBaseUnits(value, DEFAULT_TOKEN_DECIMALS);
}

export function humanToBaseUnits(value, decimals = DEFAULT_TOKEN_DECIMALS) {
  const normalized = String(value ?? "").trim();
  if (!/^\d*(\.\d*)?$/.test(normalized)) return "0";
  const safeDecimals = Math.max(0, Math.min(30, Number.parseInt(decimals, 10) || DEFAULT_TOKEN_DECIMALS));

  const [wholeRaw, fractionRaw = ""] = normalized.split(".");
  const whole = BigInt(wholeRaw || "0");
  const base = 10n ** BigInt(safeDecimals);
  const fraction = BigInt((fractionRaw.replace(/\D/g, "").slice(0, safeDecimals).padEnd(safeDecimals, "0")) || "0");
  return String(whole * base + fraction);
}

export function weiToHuman(value) {
  try {
    const wei = BigInt(String(value || "0"));
    const whole = wei / WEI_PER_TOKEN;
    const fraction = String(wei % WEI_PER_TOKEN).padStart(18, "0").replace(/0+$/, "");
    return fraction ? `${whole}.${fraction.slice(0, 4)}` : String(whole);
  } catch {
    return "0";
  }
}

export function tokenDecimalsFromMarket(market = {}) {
  market ||= {};
  const explicit = Number(market.tokenDecimals ?? market.raw?.tokenDecimals ?? market.raw?.token_decimals);
  if (Number.isInteger(explicit) && explicit >= 0 && explicit <= 30) return explicit;
  const collateral = String(market.collateralMode ?? market.raw?.collateralMode ?? market.raw?.collateral_mode ?? "").toLowerCase();
  const chain = String(market.chain ?? market.network ?? market.raw?.chain ?? market.raw?.network ?? "").toLowerCase();
  if (collateral === "credits") return 18;
  if (collateral === "usdc" && chain === "base") return 6;
  return DEFAULT_TOKEN_DECIMALS;
}

export function normalizeBentoLogin(payload = {}) {
  const token = payload.token || payload.accessToken || payload.jwt || payload.data?.token;
  const managedAccount =
    payload.accountAddress ||
    payload.managedAccount ||
    payload.account?.address ||
    payload.user?.accountAddress ||
    payload.data?.accountAddress ||
    payload.data?.user?.accountAddress;

  return {
    token,
    managedAccount,
    raw: payload,
  };
}

export function extractEstimate(payload = {}) {
  const estimate = payload.estimate || payload.data?.estimate || payload.data || payload;
  return {
    success: payload.success ?? estimate.success ?? true,
    quoteId: estimate.quote_id || estimate.quoteId,
    sharesOut: estimate.shares_out || estimate.sharesOut,
    minSharesOut: estimate.min_shares_out || estimate.minSharesOut,
    raw: payload,
  };
}

export function normalizeExternalLogin(payload = {}) {
  return {
    token: payload.token || payload.data?.token,
    address: payload.address || payload.data?.address,
    username: payload.username || payload.data?.username,
    managedAccount: payload.accountAddress || payload.managedAccount || payload.data?.accountAddress,
    raw: payload,
  };
}

export function portfolioSummary(portfolio = {}) {
  const details = portfolio?.details?.data || portfolio?.details?.account || portfolio?.details || {};
  const positions = portfolioPositions(portfolio);
  const balance = firstValue(details, ["bentoBalance", "balance", "totalBalance", "usdcBalance", "availableBalance", "walletBalance"], "0");
  const totalValue = firstValue(details, ["portfolioValue", "totalValue", "accountValue", "equity", "netValue"], balance);
  const pnl = firstValue(details, ["pnl", "profitLoss", "totalPnl", "realizedPnl"], "0");

  return {
    balance: formatPortfolioAmount(balance),
    totalValue: formatPortfolioAmount(totalValue),
    pnl: formatPortfolioAmount(pnl),
    positionsCount: positions.length,
    marketsCreated: Number(firstValue(details, ["marketsCreated", "createdMarkets", "duelsCreated"], 0)) || 0,
  };
}

export function portfolioPositions(portfolio = {}) {
  const source = portfolio?.positions?.data ?? portfolio?.positions?.positions ?? portfolio?.positions?.items ?? portfolio?.positions;
  return listFrom(source).map((position, index) => {
    const market = position.market || position.duel || position.raw || {};
    const title = position.title || position.question || market.title || market.question || market.betString || `Position ${index + 1}`;
    const outcome = position.outcome || position.option || position.side || position.optionLabel || market.option || "";
    const shares = position.shares || position.shareBalance || position.amount || position.balance || "";
    const value = position.value || position.currentValue || position.usdcValue || position.notional || "";
    return {
      id: String(position.id || position.duelId || market.duelId || `${title}-${index}`),
      title: String(title),
      outcome: String(outcome || "Open"),
      shares: shares === "" ? "" : formatPortfolioAmount(shares),
      value: value === "" ? "" : formatPortfolioAmount(value),
      status: String(position.status || market.status || "open"),
    };
  });
}

export function leaderboardRows(users = []) {
  return (Array.isArray(users) ? users : []).map((user, index) => {
    const wins = Number(user.wins || 0);
    const losses = Number(user.losses || 0);
    const total = wins + losses;
    const points = Number(user.points || 0);
    const volume = Number(user.volume || user.tradeVolume || Math.max(0, points * 320 + wins * 1800));
    const pnl = Number(user.pnl ?? user.profitLoss ?? points - 1200 + wins * 120 - losses * 45);
    return {
      id: String(user.id || user.username || `leader-${index}`),
      rank: index + 1,
      name: String(user.name || user.username || "Bento trader"),
      username: String(user.username || "").replace(/^@/, ""),
      wallet: String(user.managedAccount || user.walletId || ""),
      initials: initialsFrom(user.name || user.username || "BT"),
      pnl,
      volume,
      winRate: total ? Math.round((wins / total) * 100) : Math.max(40, Math.min(72, 50 + Math.round((points - 1200) / 40))),
      points,
    };
  }).sort((a, b) => b.pnl - a.pnl || b.volume - a.volume || b.points - a.points)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export function leaderboardSummary(users = []) {
  const rows = leaderboardRows(users);
  return {
    traders: rows.length,
    totalVolume: rows.reduce((sum, row) => sum + row.volume, 0),
    totalPnl: rows.reduce((sum, row) => sum + row.pnl, 0),
  };
}

export function shortAddress(address) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
}

function firstValue(source = {}, keys = [], fallback = "") {
  for (const key of keys) {
    if (source?.[key] !== undefined && source[key] !== null && source[key] !== "") return source[key];
  }
  return fallback;
}

function listFrom(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.positions)) return value.positions;
  return [value];
}

function formatPortfolioAmount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value || "0");
  if (Math.abs(numeric) >= 1e12) return weiToHuman(String(Math.trunc(numeric)));
  return numeric.toFixed(2);
}

function initialsFrom(value) {
  return String(value || "BT")
    .split(/\s+|-/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "BT";
}

async function fetchJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return parseResponse(response);
}

async function postJson(url, body, token) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  return parseResponse(response);
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Bento returned ${response.status}`);
  }
  return payload;
}
