import {
  bentoReadinessPayload,
  createBentoExternalLink,
  createBentoMarket,
  estimateBentoBet,
  estimateBentoSell,
  exchangeBentoExternalLink,
  fetchBentoMarket,
  fetchBentoMarketAnalytics,
  fetchBentoMarkets,
  fetchBentoPortfolio,
  fetchBentoUserShares,
  handleApiError,
  loginBentoUser,
  placeBentoBet,
  readJsonBody,
  sellBentoBet,
  sendJson,
} from "./_bento.js";

const ROUTES = {
  readiness: "readiness",
  markets: "markets",
  market: "market",
  "market-analytics": "market-analytics",
  "user-shares": "user-shares",
  login: "login",
  link: "link",
  exchange: "exchange",
  estimate: "estimate",
  "place-bet": "place-bet",
  portfolio: "portfolio",
  "sell-estimate": "sell-estimate",
  sell: "sell",
  "create-market": "create-market",
};

export function createBentoMarketAnalyticsHandler(fetchAnalytics = fetchBentoMarketAnalytics) {
  return async function bentoMarketAnalyticsHandler(request, response) {
    try {
      const duelId = new URL(request.url, "http://localhost").searchParams.get("duelId");
      if (!duelId) throw exposedError(400, "duelId is required");
      sendJson(response, 200, await fetchAnalytics(duelId));
    } catch (error) {
      handleApiError(response, error);
    }
  };
}

export function createBentoUserSharesHandler(fetchShares = fetchBentoUserShares) {
  return async function bentoUserSharesHandler(request, response) {
    try {
      const searchParams = new URL(request.url, "http://localhost").searchParams;
      sendJson(response, 200, await fetchShares({
        token: bearerToken(request),
        duelId: searchParams.get("duelId"),
      }));
    } catch (error) {
      handleApiError(response, error);
    }
  };
}

export function createBentoSellEstimateHandler(estimateSell = estimateBentoSell) {
  return async function bentoSellEstimateHandler(request, response) {
    try {
      const body = await readJsonBody(request);
      sendJson(response, 200, await estimateSell({ ...body, token: bearerToken(request) || body.token }));
    } catch (error) {
      handleApiError(response, error);
    }
  };
}

export function createBentoSellHandler(sellBet = sellBentoBet) {
  return async function bentoSellHandler(request, response) {
    try {
      const body = await readJsonBody(request);
      sendJson(response, 200, await sellBet({ ...body, token: bearerToken(request) || body.token }));
    } catch (error) {
      handleApiError(response, error);
    }
  };
}

export function createBentoCreateMarketHandler(createMarket = createBentoMarket) {
  return async function bentoCreateMarketHandler(request, response) {
    try {
      const body = await readJsonBody(request);
      sendJson(response, 200, await createMarket({ ...body, token: bearerToken(request) || body.token }));
    } catch (error) {
      handleApiError(response, error);
    }
  };
}

export function createBentoHandler() {
  return async function bentoHandler(request, response) {
    try {
      const url = new URL(request.url, "http://localhost");
      const route = url.searchParams.get("route");

      switch (route) {
        case ROUTES.readiness:
          return sendJson(response, 200, bentoReadinessPayload());
        case ROUTES.markets:
          return sendJson(response, 200, await fetchBentoMarkets({
            page: url.searchParams.get("page") || 1,
            limit: url.searchParams.get("limit") || 20,
          }));
        case ROUTES.market:
          return sendJson(response, 200, await fetchBentoMarket(url.searchParams.get("duelId")));
        case ROUTES["market-analytics"]:
          return createBentoMarketAnalyticsHandler()(request, response);
        case ROUTES["user-shares"]:
          return createBentoUserSharesHandler()(request, response);
        case ROUTES.login:
          return sendJson(response, 200, await loginBentoUser(await readJsonBody(request)));
        case ROUTES.link:
          return sendJson(response, 200, await createBentoExternalLink(await readJsonBody(request)));
        case ROUTES.exchange:
          return sendJson(response, 200, await exchangeBentoExternalLink(await readJsonBody(request)));
        case ROUTES.estimate: {
          const body = await readJsonBody(request);
          return sendJson(response, 200, await estimateBentoBet({ ...body, token: bearerToken(request) || body.token }));
        }
        case ROUTES["place-bet"]: {
          const body = await readJsonBody(request);
          return sendJson(response, 200, await placeBentoBet({ ...body, token: bearerToken(request) || body.token }));
        }
        case ROUTES.portfolio: {
          const body = request.method === "POST" ? await readJsonBody(request) : {};
          return sendJson(response, 200, await fetchBentoPortfolio({
            token: bearerToken(request) || body.token,
            account: body.account || url.searchParams.get("account"),
          }));
        }
        case ROUTES["sell-estimate"]:
          return createBentoSellEstimateHandler()(request, response);
        case ROUTES.sell:
          return createBentoSellHandler()(request, response);
        case ROUTES["create-market"]:
          return createBentoCreateMarketHandler()(request, response);
        default:
          throw exposedError(404, "Unknown Bento route");
      }
    } catch (error) {
      handleApiError(response, error);
    }
  };
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

export default createBentoHandler();
