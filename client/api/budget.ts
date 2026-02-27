import type { IBudget, IBudgetData } from "@/types/budget/types";
import BaseAPI from "./base";
import type { IApiResponse } from "@/types/api/types";

export type { IBudgetData };

class BudgetAPI extends BaseAPI {
  async create(budgetData: IBudgetData): Promise<IApiResponse<IBudget>> {
    return this.makeRequest<IBudget>("/budget", {
      method: "POST",
      data: budgetData,
    });
  }

  async fetchAll({
    currentMonth,
    currentYear,
  }: {
    currentMonth: number;
    currentYear: number;
  }): Promise<IApiResponse<IBudget[]>> {
    return this.makeRequest<IBudget[]>("/budget", {
      method: "GET",
      params: { month: currentMonth, year: currentYear },
    });
  }

  async delete(budgetId: string): Promise<IApiResponse<null>> {
    return this.makeRequest<null>(`/budget/${budgetId}`, {
      method: "DELETE",
    });
  }

  async update(
    budgetId: string,
    updates: Partial<
      IBudgetData & { category?: string; limit?: number; icon?: string }
    >,
  ): Promise<IApiResponse<any>> {
    return this.makeRequest<any>(`/budget/${budgetId}`, {
      method: "PUT",
      data: updates,
    });
  }
}

export const budgetAPI = new BudgetAPI();
export default budgetAPI;
