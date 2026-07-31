import { fetchBentoUserShares, handleApiError, sendJson } from "./_bento.js";

export function createBentoUserSharesHandler(fetchShares = fetchBentoUserShares) {
  return async function bentoUserSharesHandler(request, response) {
    try {
      const searchParams = new URL(request.url, "http://localhost").searchParams;
      const payload = await fetchShares({
        token: bearerToken(request),
        duelId: searchParams.get("duelId"),
      });
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

export default createBentoUserSharesHandler();
