import assert from "node:assert/strict";
import test from "node:test";
import { createTournamentHandler } from "./tournament.js";

test("tournament route requires a slug", async () => {
  const response = responseRecorder();
  const handler = createTournamentHandler(async () => ({ tournament: {} }));

  await handler({ url: "/api/tournament" }, response);

  assert.equal(response.statusCode, 400);
  assert.match(JSON.parse(response.body).error.message, /slug is required/i);
});

test("tournament route returns normalized selected details", async () => {
  const response = responseRecorder();
  const handler = createTournamentHandler(async (slug) => ({ tournament: { slug } }));

  await handler({ url: "/api/tournament?slug=world-cup-c774b2e1" }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { tournament: { slug: "world-cup-c774b2e1" } });
});

test("tournament route forwards bounded leaderboard pagination", async () => {
  const response = responseRecorder();
  let receivedOptions;
  const handler = createTournamentHandler(async (slug, options) => {
    receivedOptions = options;
    return { tournament: { slug } };
  });

  await handler({ url: "/api/tournament?slug=world-cup-c774b2e1&leaderboardPage=3&leaderboardPageSize=200" }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(receivedOptions, { leaderboardPage: 3, leaderboardPageSize: 50 });
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
