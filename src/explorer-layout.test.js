import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

function cssRule(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return styles.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

test("explorer results preserve natural card height instead of clipping content", () => {
  const rule = cssRule(".explorer-results");

  assert.match(rule, /grid-auto-rows:\s*max-content\s*;/);
  assert.match(rule, /align-content:\s*start\s*;/);
});

test("archived selected schedules cannot collapse the explorer card list", () => {
  const rule = cssRule(".explorer-selected-panel");

  assert.match(rule, /max-height:\s*min\(420px,\s*45vh\)\s*;/);
  assert.match(rule, /overflow-y:\s*auto\s*;/);
});
