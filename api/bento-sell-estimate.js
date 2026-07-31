import { estimateBentoSell, handleApiError, readJsonBody, sendJson } from "./_bento.js";

export function createBentoSellEstimateHandler(estimateSell = estimateBentoSell) {
  return async function bentoSellEstimateHandler(request, response) {
    try {
      const body = await readJsonBody(request);
      const payload = await estimateSell({ ...body, token: bearerToken(request) || body.token });
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

export default createBentoSellEstimateHandler();
