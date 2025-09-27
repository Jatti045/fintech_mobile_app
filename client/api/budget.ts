import { IBudget } from "@/store/slices/budgetSlice";
import BaseAPI, { IApiResponse } from "./base";

export interface IBudgetData {
  category: string;
  limit: number;
  month: number;
  year: number;
}

class BudgetAPI extends BaseAPI {
  async create(budgetData: IBudgetData): Promise<IApiResponse<IBudget>> {
    try {
      const response = await this.makeRequest<IBudget>("/budget", {
        method: "POST",
        data: budgetData,
      });
      return response;
    } catch (error: any) {
      console.error("Failed to create budget:", error.message);
      throw error;
    }
  }

  async fetchAll({
    currentMonth,
    currentYear,
  }: {
    currentMonth: number;
    currentYear: number;
  }): Promise<IApiResponse<IBudget[]>> {
    try {
      const response = await this.makeRequest<IBudget[]>("/budget", {
        method: "GET",
        params: {
          month: currentMonth,
          year: currentYear,
        },
      });
      return response;
    } catch (error: any) {
      console.error("Failed to fetch budgets:", error.message);
      throw error;
    }
  }

  async delete(budgetId: string): Promise<IApiResponse<null>> {
    try {
      const response = await this.makeRequest<null>(`/budget/${budgetId}`, {
        method: "DELETE",
      });
      return response;
    } catch (error: any) {
      console.error("Failed to delete budget:", error.message);
      throw error;
    }
  }

  async update(
    budgetId: string,
    updates: Partial<
      IBudgetData & { category?: string; limit?: number; icon?: string }
    >
  ): Promise<IApiResponse<any>> {
    try {
      const response = await this.makeRequest<any>(`/budget/${budgetId}`, {
        method: "PUT",
        data: updates,
      });
      return response;
    } catch (error: any) {
      console.error("Failed to update budget:", error.message);
      throw error;
    }
  }
}

export const budgetAPI = new BudgetAPI();
export default budgetAPI;
