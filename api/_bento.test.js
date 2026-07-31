import assert from "node:assert/strict";
import test from "node:test";
import { bentoReadinessPayload, fetchBentoExplorer, getBentoServerConfig, normalizeBentoMarket } from "./_bento.js";

test("Bento readiness reports missing builder key without exposing secrets", () => {
  const previousKey = process.env.BENTO_BUILDER_API_KEY;
  const previousAlias = process.env.BUILDER_API_KEY;
  delete process.env.BENTO_BUILDER_API_KEY;
  delete process.env.BUILDER_API_KEY;

  const readiness = bentoReadinessPayload();

  assert.equal(readiness.configured, false);
  assert.deepEqual(readiness.missing, ["builder api key"]);
  assert.equal("apiKey" in readiness, false);

  restoreEnv("BENTO_BUILDER_API_KEY", previousKey);
  restoreEnv("BUILDER_API_KEY", previousAlias);
});

test("Bento server config uses documented hackathon hosts and env aliases", () => {
  const previousUrl = process.env.BENTO_URL;
  const previousKey = process.env.BENTO_BUILDER_API_KEY;
  const previousAlias = process.env.BUILDER_API_KEY;
  const previousTournaments = process.env.PARLAY_TOURNMENT_URL;
  delete process.env.BENTO_URL;
  delete process.env.BENTO_BUILDER_API_KEY;
  process.env.BUILDER_API_KEY = "bnt_test";
  process.env.PARLAY_TOURNMENT_URL = "https://bento-fun-tournaments-backend-3nku.onrender.com/";

  const config = getBentoServerConfig();

  assert.equal(config.baseUrl, "https://internal-server.bento.fun");
  assert.equal(config.tournamentsBaseUrl, "https://bento-fun-tournaments-backend-3nku.onrender.com");
  assert.equal(config.configured, true);
  assert.equal(config.apiKey, "bnt_test");

  restoreEnv("BENTO_URL", previousUrl);
  restoreEnv("BENTO_BUILDER_API_KEY", previousKey);
  restoreEnv("BUILDER_API_KEY", previousAlias);
  restoreEnv("PARLAY_TOURNMENT_URL", previousTournaments);
});

test("normalizes Bento market list rows around duelId and option labels", () => {
  assert.deepEqual(
    normalizeBentoMarket({
      id: "row-1",
      duelId: "duel-42",
      question: "Will Bento grow this week?",
      category: "Growth",
      options: [{ label: "YES" }, { label: "NO" }],
      score: { home: 3, away: 1 },
      winner: "YES",
      totalLiquidity: "1000000000000000000",
    }),
    {
      id: "row-1",
      duelId: "duel-42",
      title: "Will Bento grow this week?",
      category: "Growth",
      status: "listed",
      optionA: "YES",
      optionB: "NO",
      winner: "YES",
      homeScore: 3,
      awayScore: 1,
      resultSource: "score.home-away",
      fieldCompleteness: {
        title: true,
        optionA: true,
        optionB: true,
        category: true,
        endTime: false,
      },
      tokenDecimals: 18,
      liquidity: "1000000000000000000",
      endTime: undefined,
      raw: {
        id: "row-1",
        duelId: "duel-42",
        question: "Will Bento grow this week?",
        category: "Growth",
        options: [{ label: "YES" }, { label: "NO" }],
        score: { home: 3, away: 1 },
        winner: "YES",
        totalLiquidity: "1000000000000000000",
      },
    },
  );
});

test("normalizes Bento markets with provenance instead of hiding missing fields", () => {
  const market = normalizeBentoMarket({
    duelId: "duel-missing",
    options: [{ label: "Home" }],
    collateralMode: "credits",
  });

  assert.deepEqual(market.fieldCompleteness, {
    title: false,
    optionA: true,
    optionB: false,
    category: false,
    endTime: false,
  });
  assert.equal(market.title, "");
  assert.equal(market.optionA, "Home");
  assert.equal(market.optionB, "");
  assert.equal(market.category, "");
  assert.equal(market.tokenDecimals, 18);
});

test("marks confidently sourced score results separately from ambiguous aliases", () => {
  assert.equal(
    normalizeBentoMarket({ duelId: "a", optionA: "YES", optionB: "NO", result: { score: { home: 1, away: 0 } } }).resultSource,
    "result.score.home-away",
  );
  assert.equal(
    normalizeBentoMarket({ duelId: "b", optionA: "YES", optionB: "NO", score: { optionA: 1, optionB: 0 } }).resultSource,
    "ambiguous",
  );
});

test("Explorer requires a configured tournaments host without returning fallback data", async () => {
  const previousKey = process.env.BENTO_BUILDER_API_KEY;
  const previousTournaments = process.env.PARLAY_TOURNMENT_URL;
  process.env.BENTO_BUILDER_API_KEY = "bnt_test";
  delete process.env.PARLAY_TOURNMENT_URL;

  await assert.rejects(
    fetchBentoExplorer(),
    (error) => error.statusCode === 503 && /tournaments host/i.test(error.message),
  );

  restoreEnv("BENTO_BUILDER_API_KEY", previousKey);
  restoreEnv("PARLAY_TOURNMENT_URL", previousTournaments);
});

function restoreEnv(key, value) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
