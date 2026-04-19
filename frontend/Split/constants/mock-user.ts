export type User = {
  id: string;
  name: string;
};

export const CURRENT_USER: User = {
  id: "me",
  name: "You",
};

/**
 * Real backend user id for the currently signed-in user. Used while we
 * gradually migrate screens off the mock data layer onto the FastAPI
 * backend at `BACKEND_BASE_URL`.
 */
export const CURRENT_USER_BACKEND_ID = "69e4816bee8858a7cbcea39e";
