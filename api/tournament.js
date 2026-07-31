import {
  enterBentoTournament,
  fetchBentoTournament,
  fetchBentoTournamentStatus,
  handleApiError,
  readJsonBody,
  sendJson,
} from "./_bento.js";

export function createTournamentHandler(fetchTournament = fetchBentoTournament, {
  statusHandler = createTournamentStatusHandler(),
  enterHandler = createTournamentEnterHandler(),
} = {}) {
  return async function tournamentHandler(request, response) {
    try {
      const searchParams = new URL(request.url, "http://localhost").searchParams;
      const route = searchParams.get("route");
      if (route === "status") return statusHandler(request, response);
      if (route === "enter") return enterHandler(request, response);

      const slug = searchParams.get("slug");
      if (!slug) {
        throw exposedError(400, "Tournament slug is required");
      }
      sendJson(response, 200, await fetchTournament(slug, {
        leaderboardPage: boundedInteger(searchParams.get("leaderboardPage"), 1, 1, Number.MAX_SAFE_INTEGER),
        leaderboardPageSize: boundedInteger(searchParams.get("leaderboardPageSize"), 10, 1, 50),
      }));
    } catch (error) {
      handleApiError(response, error);
    }
  };
}

export function createTournamentStatusHandler(fetchStatus = fetchBentoTournamentStatus) {
  return async function tournamentStatusHandler(request, response) {
    try {
      const searchParams = new URL(request.url, "http://localhost").searchParams;
      const slug = searchParams.get("slug");
      if (!slug) throw exposedError(400, "Tournament slug is required");
      sendJson(response, 200, await fetchStatus({
        slug,
        token: bearerToken(request),
        wallet: searchParams.get("wallet") || "",
      }));
    } catch (error) {
      handleApiError(response, error);
    }
  };
}

export function createTournamentEnterHandler(enterTournament = enterBentoTournament) {
  return async function tournamentEnterHandler(request, response) {
    try {
      const body = await readJsonBody(request);
      sendJson(response, 200, await enterTournament({ ...body, token: bearerToken(request) || body.token }));
    } catch (error) {
      handleApiError(response, error);
    }
  };
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function bearerToken(request) {
  const header = request.headers.authorization || request.headers.Authorization || "";
  return String(header).startsWith("Bearer ") ? String(header).slice(7) : "";
}

function exposedError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

export default createTournamentHandler();
