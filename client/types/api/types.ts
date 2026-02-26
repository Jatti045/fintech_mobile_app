// ─── API Base Types ─────────────────────────────────────────────────────────

/** Standard envelope returned by every API call via BaseAPI.makeRequest. */
export interface IApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
