import apiClient from "../config/apiClient";
import { AxiosRequestConfig } from "axios";

export type { IApiResponse } from "@/types/api/types";
import type { IApiResponse } from "@/types/api/types";

export default class BaseAPI {
  protected async makeRequest<T>(
    endpoint: string,
    options: AxiosRequestConfig = {},
  ): Promise<IApiResponse<T>> {
    try {
      const response = await apiClient({
        url: endpoint,
        ...options,
      });
      return response.data;
    } catch (error: any) {
      console.error(`API Error [${endpoint}]:`, error.message);

      // Handle axios error structure
      if (error.response) {
        const errorMessage =
          error.response.data?.message ||
          `HTTP ${error.response.status}: ${error.response.statusText}`;
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error("Network error: No response from server");
      } else {
        throw new Error(error.message || "Request failed");
      }
    }
  }
}
