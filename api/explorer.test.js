import assert from "node:assert/strict";
import test from "node:test";
import { createExplorerHandler } from "./explorer.js";

test("Explorer route returns a no-store items payload", async () => {
  const response = responseRecorder();
  const handler = createExplorerHandler(async () => ({ items: [{ id: "verified" }] }));

  await handler({ url: "/api/explorer" }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.deepEqual(JSON.parse(response.body), { items: [{ id: "verified" }] });
});

test("Explorer route returns upstream errors without fallback records", async () => {
  const response = responseRecorder();
  const handler = createExplorerHandler(async () => {
    const error = new Error("Tournament Explorer is unavailable");
    error.statusCode = 503;
    error.expose = true;
    throw error;
  });

  await handler({ url: "/api/explorer" }, response);

  assert.equal(response.statusCode, 503);
  const payload = JSON.parse(response.body);
  assert.equal(payload.error.message, "Tournament Explorer is unavailable");
  assert.equal("items" in payload, false);
});

function responseRecorder() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(value) {
      this.body = value;
    },
  };
}
