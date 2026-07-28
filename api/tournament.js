import { fetchBentoTournament, handleApiError, sendJson } from "./_bento.js";

export function createTournamentHandler(fetchTournament = fetchBentoTournament) {
  return async function tournamentHandler(request, response) {
    try {
      const searchParams = new URL(request.url, "http://localhost").searchParams;
      const slug = searchParams.get("slug");
      if (!slug) {
        const error = new Error("Tournament slug is required");
        error.statusCode = 400;
        error.expose = true;
        throw error;
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

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

export default createTournamentHandler();
