import fs from "node:fs/promises";
import path from "node:path";

const GROUPS_FILE = path.join(process.cwd(), "data", "groups.json");
const TOURNAMENTS_FILE = path.join(process.cwd(), "data", "tournaments.json");
const IS_VERCEL = process.env.VERCEL === "1";
let vercelGroupsCache = null;
let vercelTournamentsCache = null;

export default async function handler(request, response) {
  try {
    const url = new URL(request.url, "http://localhost");
    if (url.searchParams.get("scope") === "tournaments") {
      await handleTournaments(request, response);
      return;
    }

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

async function handleTournaments(request, response) {
  if (request.method === "GET") {
    sendJson(response, 200, { tournaments: await readTournaments() });
    return;
  }

  if (request.method === "POST" || request.method === "PATCH") {
    const body = await readJsonBody(request);
    const action = String(body.action || (request.method === "PATCH" ? "update" : "create")).toLowerCase();
    const tournaments = await readTournaments();

    if (action === "create") {
      const tournament = normalizeTournament({
        ...body.tournament,
        id: body.tournament?.id || `tournament-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (!tournament.name) return sendJson(response, 400, { error: { message: "tournament name is required", statusCode: 400 } });
      const nextTournaments = [tournament, ...tournaments.filter((item) => item.id !== tournament.id)];
      await writeTournaments(nextTournaments);
      sendJson(response, 200, { tournament, tournaments: nextTournaments });
      return;
    }

    if (action === "update") {
      const patch = normalizeTournament({ ...body.tournament, id: body.id || body.tournament?.id, updatedAt: new Date().toISOString() });
      const nextTournaments = tournaments.map((item) => item.id === patch.id ? normalizeTournament({ ...item, ...patch }) : item);
      const tournament = nextTournaments.find((item) => item.id === patch.id);
      if (!tournament) return sendJson(response, 404, { error: { message: "tournament not found", statusCode: 404 } });
      await writeTournaments(nextTournaments);
      sendJson(response, 200, { tournament, tournaments: nextTournaments });
      return;
    }

    if (action === "delete") {
      const id = String(body.id || body.tournament?.id || "");
      const tournament = tournaments.find((item) => item.id === id);
      if (!tournament) return sendJson(response, 404, { error: { message: "tournament not found", statusCode: 404 } });
      const nextTournaments = tournaments.filter((item) => item.id !== id);
      await writeTournaments(nextTournaments);
      sendJson(response, 200, { tournament, tournaments: nextTournaments });
      return;
    }

    sendJson(response, 400, { error: { message: "unknown tournament action", statusCode: 400 } });
    return;
  }

  response.setHeader("Allow", "GET, POST, PATCH");
  sendJson(response, 405, { error: { message: "Method not allowed", statusCode: 405 } });
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

async function readTournaments() {
  if (IS_VERCEL) {
    if (!vercelTournamentsCache) vercelTournamentsCache = await readBundledTournaments();
    return vercelTournamentsCache;
  }

  await ensureTournamentsFile();
  const raw = await fs.readFile(TOURNAMENTS_FILE, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.tournaments) ? parsed.tournaments.map(normalizeTournament).filter((item) => item.id && item.name) : [];
}

async function writeTournaments(tournaments) {
  const normalized = tournaments.map(normalizeTournament);
  if (IS_VERCEL) {
    vercelTournamentsCache = normalized;
    return;
  }

  await fs.mkdir(path.dirname(TOURNAMENTS_FILE), { recursive: true });
  await fs.writeFile(TOURNAMENTS_FILE, `${JSON.stringify({ tournaments: normalized }, null, 2)}\n`);
}

async function readBundledTournaments() {
  try {
    const raw = await fs.readFile(TOURNAMENTS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.tournaments) ? parsed.tournaments.map(normalizeTournament) : [];
  } catch {
    return [];
  }
}

async function ensureTournamentsFile() {
  try {
    await fs.access(TOURNAMENTS_FILE);
  } catch {
    await writeTournaments([]);
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

function normalizeTournament(value = {}) {
  const members = Array.isArray(value.members) ? value.members : [];
  const teams = Array.isArray(value.teams) ? value.teams : [];
  const status = String(value.status || "upcoming").toLowerCase();
  const sport = String(value.sport || "Football");
  return {
    id: String(value.id || `tournament-${Date.now()}`),
    name: String(value.name || "").trim(),
    sport,
    format: String(value.format || "Group + Knockout").trim(),
    status: ["live", "upcoming", "settled"].includes(status) ? status : "upcoming",
    entryFee: numberFrom(value.entryFee, 10),
    prizePool: numberFrom(value.prizePool, 0),
    code: String(value.code || codeFrom(value.name || sport)).toUpperCase(),
    owner: normalizeMember(value.owner),
    members: dedupeMembers(members.map(normalizeMember).filter((member) => member.username || member.email || member.name)),
    teams: dedupeTeams(teams.map(normalizeTeam).filter((team) => team.name)),
    coverImageUrl: String(value.coverImageUrl || ""),
    createdAt: String(value.createdAt || new Date().toISOString()),
    updatedAt: String(value.updatedAt || value.createdAt || new Date().toISOString()),
  };
}

function normalizeTeam(value = {}) {
  return {
    id: String(value.id || codeFrom(value.name || `team-${Date.now()}`)),
    name: String(value.name || "").trim(),
    color: String(value.color || "#ff4b2b"),
    captain: normalizeMember(value.captain),
    members: dedupeMembers((Array.isArray(value.members) ? value.members : []).map(normalizeMember)),
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

function dedupeMembers(items) {
  const seen = new Map();
  for (const member of items) {
    const key = member.username || member.email || member.id || member.name;
    if (key) seen.set(String(key).toLowerCase(), member);
  }
  return [...seen.values()];
}

function dedupeTeams(items) {
  const seen = new Map();
  for (const team of items) {
    if (team.name) seen.set(team.id || team.name.toLowerCase(), team);
  }
  return [...seen.values()];
}

function numberFrom(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function codeFrom(value) {
  return String(value || "tournament")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 8) || "tourney";
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
