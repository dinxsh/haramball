import assert from "node:assert/strict";
import test from "node:test";

test("groups API tournament scope supports create, update, and delete", async () => {
  const previousVercel = process.env.VERCEL;
  process.env.VERCEL = "1";

  try {
    const { default: groupsHandler } = await import(`./groups.js?scope-test=${Date.now()}`);
    const createResponse = responseRecorder();
    await groupsHandler(request("POST", "/api/groups?scope=tournaments", {
      action: "create",
      tournament: {
        name: "Friends League",
        sport: "Football",
        members: [{ username: "dinesh" }],
        teams: [{ name: "Red" }],
      },
    }), createResponse);

    assert.equal(createResponse.statusCode, 200);
    const created = JSON.parse(createResponse.body).tournament;
    assert.equal(created.name, "Friends League");
    assert.equal(created.members.length, 1);
    assert.equal(created.teams[0].name, "Red");

    const updateResponse = responseRecorder();
    await groupsHandler(request("POST", "/api/groups?scope=tournaments", {
      action: "update",
      id: created.id,
      tournament: { ...created, status: "live", teams: [{ name: "Blue" }] },
    }), updateResponse);

    assert.equal(updateResponse.statusCode, 200);
    const updated = JSON.parse(updateResponse.body).tournament;
    assert.equal(updated.status, "live");
    assert.equal(updated.teams[0].name, "Blue");

    const deleteResponse = responseRecorder();
    await groupsHandler(request("POST", "/api/groups?scope=tournaments", { action: "delete", id: created.id }), deleteResponse);

    assert.equal(deleteResponse.statusCode, 200);
    assert.equal(JSON.parse(deleteResponse.body).tournaments.some((item) => item.id === created.id), false);
  } finally {
    if (previousVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previousVercel;
  }
});

function request(method, url, body = {}) {
  return {
    method,
    url,
    [Symbol.asyncIterator]: async function* readBody() {
      yield Buffer.from(JSON.stringify(body));
    },
  };
}

function responseRecorder() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = value; },
  };
}
