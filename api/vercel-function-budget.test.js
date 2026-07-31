import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import test from "node:test";

test("keeps deployable Vercel serverless functions within Hobby plan budget", () => {
  const deployableFunctions = readdirSync(new URL(".", import.meta.url))
    .filter((file) => file.endsWith(".js"))
    .filter((file) => !file.startsWith("_"))
    .filter((file) => !file.endsWith(".test.js"));

  assert.ok(
    deployableFunctions.length <= 12,
    `expected no more than 12 API functions, found ${deployableFunctions.length}: ${deployableFunctions.join(", ")}`,
  );
});
