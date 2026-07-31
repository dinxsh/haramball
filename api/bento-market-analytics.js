import { fetchBentoMarketAnalytics, handleApiError, sendJson } from "./_bento.js";

export function createBentoMarketAnalyticsHandler(fetchAnalytics = fetchBentoMarketAnalytics) {
  return async function bentoMarketAnalyticsHandler(request, response) {
    try {
      const duelId = new URL(request.url, "http://localhost").searchParams.get("duelId");
      if (!duelId) {
        const error = new Error("duelId is required");
        error.statusCode = 400;
        error.expose = true;
        throw error;
      }
      const payload = await fetchAnalytics(duelId);
      sendJson(response, 200, payload);
    } catch (error) {
      handleApiError(response, error);
    }
  };
}

export default createBentoMarketAnalyticsHandler();
