import assert from "node:assert/strict";
import test from "node:test";
import * as bentoModule from "./bento.js";
import { extractEstimate, humanToWei, isBentoMarketEnded, normalizeBentoLogin, weiToHuman } from "./bento.js";

test("converts human USDC amounts to Bento base units", () => {
  assert.equal(humanToWei("1"), "1000000000000000000");
  assert.equal(humanToWei("2.5"), "2500000000000000000");
  assert.equal(humanToWei("0.000000000000000001"), "1");
});

test("keeps partial or invalid stake input from crashing render", () => {
  assert.equal(humanToWei(""), "0");
  assert.equal(humanToWei("."), "0");
  assert.equal(humanToWei("1e2"), "0");
});

test("formats Bento base units for compact display", () => {
  assert.equal(weiToHuman("1000000000000000000"), "1");
  assert.equal(weiToHuman("1234500000000000000"), "1.2345");
});

test("normalizes Bento login token and managed account variants", () => {
  assert.deepEqual(
    normalizeBentoLogin({
      data: { token: "jwt" },
      account: { address: "0xmanaged" },
    }),
    {
      token: "jwt",
      managedAccount: "0xmanaged",
      raw: {
        data: { token: "jwt" },
        account: { address: "0xmanaged" },
      },
    },
  );
});

test("extracts quote fields from Bento estimate response variants", () => {
  assert.deepEqual(
    extractEstimate({
      success: true,
      estimate: {
        quote_id: "quote-1",
        shares_out: "2000000000000000000",
        min_shares_out: "1900000000000000000",
      },
    }),
    {
      success: true,
      quoteId: "quote-1",
      sharesOut: "2000000000000000000",
      minSharesOut: "1900000000000000000",
      raw: {
        success: true,
        estimate: {
          quote_id: "quote-1",
          shares_out: "2000000000000000000",
          min_shares_out: "1900000000000000000",
        },
      },
    },
  );
});

test("treats terminal Bento market statuses as ended", () => {
  for (const status of ["ended", "CLOSED", "resolved", "settled", "completed", "finished", "cancelled", "expired"]) {
    assert.equal(isBentoMarketEnded({ status }), true, status);
  }

  assert.equal(isBentoMarketEnded({ status: "live" }), false);
  assert.equal(isBentoMarketEnded({ status: "listed" }), false);
});

test("treats a market past its API end time as ended", () => {
  const now = Date.parse("2026-07-27T12:00:00.000Z");

  assert.equal(isBentoMarketEnded({ status: "live", endTime: "2026-07-27T11:59:59.000Z" }, now), true);
  assert.equal(isBentoMarketEnded({ status: "live", endTime: "2026-07-27T12:00:01.000Z" }, now), false);
  assert.equal(isBentoMarketEnded({ status: "live", endTime: Math.floor((now - 1000) / 1000) }, now), true);
});

test("extracts a trailing parenthesized matchup for the hero", () => {
  assert.equal(typeof bentoModule.fixtureFromMarket, "function");
  assert.deepEqual(
    bentoModule.fixtureFromMarket({
      title: "Will a red card be shown in the next 5 minutes? (Portugal vs Spain)",
      optionA: "Yes",
      optionB: "No",
    }),
    {
      home: "Portugal",
      away: "Spain",
      label: "Portugal vs Spain",
    },
  );
});

test("resolves a switched market by duel id and falls back safely", () => {
  assert.equal(typeof bentoModule.marketIndexFromDuelId, "function");
  const markets = [{ duelId: "first" }, { duelId: "second" }];

  assert.equal(bentoModule.marketIndexFromDuelId(markets, "second"), 1);
  assert.equal(bentoModule.marketIndexFromDuelId(markets, "missing"), 0);
});
