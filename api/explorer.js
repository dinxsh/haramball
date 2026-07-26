import { fetchBentoExplorer, handleApiError, sendJson } from "./_bento.js";

export function createExplorerHandler(fetchCatalog = fetchBentoExplorer) {
  return async function explorerHandler(_request, response) {
    try {
      sendJson(response, 200, await fetchCatalog());
    } catch (error) {
      handleApiError(response, error);
    }
  };
}

export default createExplorerHandler();
