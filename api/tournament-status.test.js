import assert from "node:assert/strict";
import test from "node:test";
import { createTournamentEnterHandler } from "./tournament-enter.js";
import { createTournamentStatusHandler } from "./tournament-status.js";

test("tournament status route requires a slug", async () => {
  const response = responseRecorder();
  const handler = createTournamentStatusHandler(async () => ({}));

  await handler({ headers: {}, url: "/api/tournament-status" }, response);

  assert.equal(response.statusCode, 400);
  assert.match(JSON.parse(response.body).error.message, /slug is required/i);
});

test("tournament status route forwards bearer token, wallet, and slug", async () => {
  const response = responseRecorder();
  let received;
  const handler = createTournamentStatusHandler(async (options) => {
    received = options;
    return { status: { hasEntry: true } };
  });

  await handler({
    headers: { authorization: "Bearer jwt-token" },
    url: "/api/tournament-status?slug=world-cup-c774b2e1&wallet=0xabc",
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(received, { slug: "world-cup-c774b2e1", token: "jwt-token", wallet: "0xabc" });
  assert.deepEqual(JSON.parse(response.body), { status: { hasEntry: true } });
});

test("tournament enter route posts token and body to Bento wrapper", async () => {
  const response = responseRecorder();
  let received;
  const handler = createTournamentEnterHandler(async (options) => {
    received = options;
    return { entry: { pending: true } };
  });

  await handler({
    headers: { authorization: "Bearer jwt-token" },
    url: "/api/tournament-enter",
    [Symbol.asyncIterator]: async function* body() {
      yield Buffer.from(JSON.stringify({ slug: "f1-12345678", wallet: "0xabc", stakeAsset: "credits" }));
    },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(received, { slug: "f1-12345678", token: "jwt-token", wallet: "0xabc", stakeAsset: "credits" });
  assert.deepEqual(JSON.parse(response.body), { entry: { pending: true } });
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
