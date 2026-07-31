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

test("explorer modal owns the long-page scroll surface", () => {
  const modalRule = cssRule(".explorer-modal");
  const resultsRule = cssRule(".explorer-results");
  const selectedRule = cssRule(".explorer-selected-panel");

  assert.match(modalRule, /overflow-y:\s*auto\s*;/);
  assert.match(resultsRule, /overflow:\s*visible\s*;/);
  assert.match(selectedRule, /max-height:\s*none\s*;/);
  assert.match(selectedRule, /overflow:\s*visible\s*;/);
});
