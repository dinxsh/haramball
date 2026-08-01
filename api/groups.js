import fs from "node:fs/promises";
import path from "node:path";

const GROUPS_FILE = path.join(process.cwd(), "data", "groups.json");
const IS_VERCEL = process.env.VERCEL === "1";
let vercelGroupsCache = null;

export default async function handler(request, response) {
  try {
    if (request.method === "GET") {
      sendJson(response, 200, { groups: await readGroups() });
      return;
    }

    if (request.method === "POST") {
      const body = await readJsonBody(request);
      const action = String(body.action || "create").toLowerCase();
      const groups = await readGroups();

      if (action === "create") {
        const group = normalizeGroup({
          id: `group-${Date.now()}`,
          code: inviteCode(),
          name: body.name,
          owner: body.owner,
          members: [body.owner].filter(Boolean),
          invites: [],
        });
        const nextGroups = [...groups, group];
        await writeGroups(nextGroups);
        sendJson(response, 200, { group, groups: nextGroups });
        return;
      }

      if (action === "invite") {
        const nextGroups = groups.map((group) => {
          if (group.id !== body.groupId && group.code !== body.code) return group;
          const invite = normalizeInvite(body.invite);
          return { ...group, invites: dedupeByKey([...group.invites, invite], "target") };
        });
        const group = nextGroups.find((item) => item.id === body.groupId || item.code === body.code);
        if (!group) return sendJson(response, 404, { error: { message: "group not found", statusCode: 404 } });
        await writeGroups(nextGroups);
        sendJson(response, 200, { group, groups: nextGroups });
        return;
      }

      if (action === "join") {
        const member = normalizeMember(body.member);
        const nextGroups = groups.map((group) => {
          if (group.code !== body.code && group.id !== body.groupId) return group;
          return { ...group, members: dedupeByKey([...group.members, member], "username") };
        });
        const group = nextGroups.find((item) => item.code === body.code || item.id === body.groupId);
        if (!group) return sendJson(response, 404, { error: { message: "invite code not found", statusCode: 404 } });
        await writeGroups(nextGroups);
        sendJson(response, 200, { group, groups: nextGroups });
        return;
      }

      sendJson(response, 400, { error: { message: "unknown group action", statusCode: 400 } });
      return;
    }

    response.setHeader("Allow", "GET, POST");
    sendJson(response, 405, { error: { message: "Method not allowed", statusCode: 405 } });
  } catch (error) {
    sendJson(response, error.statusCode || 500, { error: { message: error.message, statusCode: error.statusCode || 500 } });
  }
}

async function readGroups() {
  if (IS_VERCEL) {
    if (!vercelGroupsCache) vercelGroupsCache = await readBundledGroups();
    return vercelGroupsCache;
  }

  await ensureGroupsFile();
  const raw = await fs.readFile(GROUPS_FILE, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.groups) ? parsed.groups.map(normalizeGroup).filter((group) => group.id && group.name) : [];
}

async function writeGroups(groups) {
  const normalized = groups.map(normalizeGroup);
  if (IS_VERCEL) {
    vercelGroupsCache = normalized;
    return;
  }

  await fs.mkdir(path.dirname(GROUPS_FILE), { recursive: true });
  await fs.writeFile(GROUPS_FILE, `${JSON.stringify({ groups: normalized }, null, 2)}\n`);
}

async function readBundledGroups() {
  try {
    const raw = await fs.readFile(GROUPS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.groups) ? parsed.groups.map(normalizeGroup) : [];
  } catch {
    return [];
  }
}

async function ensureGroupsFile() {
  try {
    await fs.access(GROUPS_FILE);
  } catch {
    await writeGroups([]);
  }
}

function normalizeGroup(value = {}) {
  return {
    id: String(value.id || `group-${Date.now()}`),
    code: String(value.code || inviteCode()).toUpperCase(),
    name: String(value.name || "Private group").trim(),
    owner: normalizeMember(value.owner),
    members: (Array.isArray(value.members) ? value.members : []).map(normalizeMember).filter((member) => member.username || member.email),
    invites: (Array.isArray(value.invites) ? value.invites : []).map(normalizeInvite).filter((invite) => invite.target),
    createdAt: String(value.createdAt || new Date().toISOString()),
  };
}

function normalizeInvite(value = {}) {
  const target = String(value.target || value.email || value.username || "").trim();
  return {
    target,
    type: /@/.test(target) ? "email" : "username",
    invitedAt: String(value.invitedAt || new Date().toISOString()),
  };
}

function normalizeMember(value = {}) {
  return {
    id: String(value.id || ""),
    name: String(value.name || "").trim(),
    username: usernameFrom(value.username || value.name),
    email: String(value.email || "").trim().toLowerCase(),
  };
}

function usernameFrom(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9_]+/g, "")
    .slice(0, 18);
}

function dedupeByKey(items, key) {
  const seen = new Map();
  for (const item of items) {
    const value = String(item?.[key] || item?.email || item?.username || "").toLowerCase();
    if (value) seen.set(value, item);
  }
  return [...seen.values()];
}

function inviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Request body must be valid JSON");
    error.statusCode = 400;
    throw error;
  }
}
