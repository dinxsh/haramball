import { enterBentoTournament, handleApiError, readJsonBody, sendJson } from "./_bento.js";

export function createTournamentEnterHandler(enterTournament = enterBentoTournament) {
  return async function tournamentEnterHandler(request, response) {
    try {
      const body = await readJsonBody(request);
      const token = bearerToken(request) || body.token;
      const payload = await enterTournament({ ...body, token });
      sendJson(response, 200, payload);
    } catch (error) {
      handleApiError(response, error);
    }
  };
}

function bearerToken(request) {
  const header = request.headers.authorization || request.headers.Authorization || "";
  return String(header).startsWith("Bearer ") ? String(header).slice(7) : "";
}

export default createTournamentEnterHandler();
