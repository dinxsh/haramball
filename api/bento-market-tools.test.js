import assert from "node:assert/strict";
import test from "node:test";
import {
  createBentoHandler,
  createBentoCreateMarketHandler,
  createBentoFeedsHandler,
  createBentoMarketAnalyticsHandler,
  createBentoSellEstimateHandler,
  createBentoSellHandler,
  createBentoUserSharesHandler,
} from "./bento.js";

test("consolidated Bento route rejects unknown subroutes", async () => {
  const response = responseRecorder();

  await createBentoHandler()({ headers: {}, url: "/api/bento?route=missing" }, response);

  assert.equal(response.statusCode, 404);
  assert.match(JSON.parse(response.body).error.message, /unknown bento route/i);
});

test("market analytics route requires duelId and forwards query", async () => {
  const missing = responseRecorder();
  await createBentoMarketAnalyticsHandler(async () => ({}))({ headers: {}, url: "/api/bento?route=market-analytics" }, missing);
  assert.equal(missing.statusCode, 400);

  const response = responseRecorder();
  let received;
  const handler = createBentoMarketAnalyticsHandler(async (duelId) => {
    received = duelId;
    return { analytics: { duelId } };
  });
  await handler({ headers: {}, url: "/api/bento?route=market-analytics&duelId=duel-1" }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(received, "duel-1");
  assert.deepEqual(JSON.parse(response.body), { analytics: { duelId: "duel-1" } });
});

test("user shares route forwards bearer token and duelId", async () => {
  const response = responseRecorder();
  let received;
  const handler = createBentoUserSharesHandler(async (options) => {
    received = options;
    return { shares: [{ side: 0 }] };
  });

  await handler({ headers: { authorization: "Bearer jwt" }, url: "/api/bento?route=user-shares&duelId=duel-1" }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(received, { token: "jwt", duelId: "duel-1" });
});

test("sell estimate and sell routes forward idempotent JSON bodies", async () => {
  const estimateResponse = responseRecorder();
  let estimateBody;
  await createBentoSellEstimateHandler(async (body) => {
    estimateBody = body;
    return { estimate: { ok: true } };
  })({
    headers: { authorization: "Bearer jwt" },
    url: "/api/bento?route=sell-estimate",
    [Symbol.asyncIterator]: async function* body() {
      yield Buffer.from(JSON.stringify({ duelId: "duel-1", sharesIn: "10" }));
    },
  }, estimateResponse);

  assert.equal(estimateResponse.statusCode, 200);
  assert.deepEqual(estimateBody, { token: "jwt", duelId: "duel-1", sharesIn: "10" });

  const sellResponse = responseRecorder();
  let sellBody;
  await createBentoSellHandler(async (body) => {
    sellBody = body;
    return { accepted: true };
  })({
    headers: { authorization: "Bearer jwt" },
    url: "/api/bento?route=sell",
    [Symbol.asyncIterator]: async function* body() {
      yield Buffer.from(JSON.stringify({ idempotencyKey: "idem", sell: { duelId: "duel-1" } }));
    },
  }, sellResponse);

  assert.equal(sellResponse.statusCode, 200);
  assert.deepEqual(sellBody, { token: "jwt", idempotencyKey: "idem", sell: { duelId: "duel-1" } });
});

test("create market route forwards bearer token and draft body", async () => {
  const response = responseRecorder();
  let received;
  await createBentoCreateMarketHandler(async (body) => {
    received = body;
    return { creation: { kind: "accepted" } };
  })({
    headers: { authorization: "Bearer jwt" },
    url: "/api/bento?route=create-market",
    [Symbol.asyncIterator]: async function* body() {
      yield Buffer.from(JSON.stringify({ requestId: "req-1", question: "Will it ship?", category: "Football" }));
    },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(received, {
    token: "jwt",
    requestId: "req-1",
    question: "Will it ship?",
    category: "Football",
  });
  assert.deepEqual(JSON.parse(response.body), { creation: { kind: "accepted" } });
});

test("feeds route forwards sport, league, and limit filters", async () => {
  const response = responseRecorder();
  let received;
  await createBentoFeedsHandler(async (options) => {
    received = options;
    return { feeds: { fixtures: [{ id: "fixture-1" }] } };
  })({ headers: {}, url: "/api/bento?route=feeds&sport=football&league=EPL&limit=12" }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(received, { sport: "football", league: "EPL", limit: "12" });
  assert.deepEqual(JSON.parse(response.body), { feeds: { fixtures: [{ id: "fixture-1" }] } });
});

function responseRecorder() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = value; },
  };
}
