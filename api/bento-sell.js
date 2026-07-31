import { handleApiError, readJsonBody, sellBentoBet, sendJson } from "./_bento.js";

export function createBentoSellHandler(sellBet = sellBentoBet) {
  return async function bentoSellHandler(request, response) {
    try {
      const body = await readJsonBody(request);
      const payload = await sellBet({ ...body, token: bearerToken(request) || body.token });
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

export default createBentoSellHandler();
