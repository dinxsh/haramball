import assert from "node:assert/strict";
import test from "node:test";
import { createTournamentEnterHandler, createTournamentHandler, createTournamentStatusHandler } from "./tournament.js";

test("tournament status route requires a slug", async () => {
  const response = responseRecorder();
  const handler = createTournamentStatusHandler(async () => ({}));

  await handler({ headers: {}, url: "/api/tournament?route=status" }, response);

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
    url: "/api/tournament?route=status&slug=world-cup-c774b2e1&wallet=0xabc",
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
    url: "/api/tournament?route=enter",
    [Symbol.asyncIterator]: async function* body() {
      yield Buffer.from(JSON.stringify({ slug: "f1-12345678", wallet: "0xabc", stakeAsset: "credits" }));
    },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(received, { slug: "f1-12345678", token: "jwt-token", wallet: "0xabc", stakeAsset: "credits" });
  assert.deepEqual(JSON.parse(response.body), { entry: { pending: true } });
});

test("consolidated tournament route dispatches status requests", async () => {
  const response = responseRecorder();
  let received;
  const handler = createTournamentHandler(async () => {
    throw new Error("detail route should not run");
  }, {
    statusHandler: async (request, routedResponse) => {
      received = request.url;
      routedResponse.statusCode = 200;
      routedResponse.end(JSON.stringify({ status: { route: "status" } }));
    },
  });

  await handler({
    headers: { authorization: "Bearer jwt-token" },
    url: "/api/tournament?route=status&slug=world-cup-c774b2e1",
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(received, "/api/tournament?route=status&slug=world-cup-c774b2e1");
  assert.deepEqual(JSON.parse(response.body), { status: { route: "status" } });
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
