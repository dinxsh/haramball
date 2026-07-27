import { fetchBentoTournament, handleApiError, sendJson } from "./_bento.js";

export function createTournamentHandler(fetchTournament = fetchBentoTournament) {
  return async function tournamentHandler(request, response) {
    try {
      const slug = new URL(request.url, "http://localhost").searchParams.get("slug");
      if (!slug) {
        const error = new Error("Tournament slug is required");
        error.statusCode = 400;
        error.expose = true;
        throw error;
      }
      sendJson(response, 200, await fetchTournament(slug));
    } catch (error) {
      handleApiError(response, error);
    }
  };
}

export default createTournamentHandler();
