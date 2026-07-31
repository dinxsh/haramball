import { fetchBentoTournamentStatus, handleApiError, sendJson } from "./_bento.js";

export function createTournamentStatusHandler(fetchStatus = fetchBentoTournamentStatus) {
  return async function tournamentStatusHandler(request, response) {
    try {
      const searchParams = new URL(request.url, "http://localhost").searchParams;
      const slug = searchParams.get("slug");
      if (!slug) {
        const error = new Error("Tournament slug is required");
        error.statusCode = 400;
        error.expose = true;
        throw error;
      }
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

function bearerToken(request) {
  const header = request.headers.authorization || request.headers.Authorization || "";
  return String(header).startsWith("Bearer ") ? String(header).slice(7) : "";
}

export default createTournamentStatusHandler();
