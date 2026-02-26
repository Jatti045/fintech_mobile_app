import BaseAPI from "./base";
import {
  TransactionType,
  ITransaction,
  ITransactionPagination,
  ITransactionFilter,
  ITransactionResponse,
} from "@/types/transaction/types";

export { TransactionType };
export type {
  ITransaction,
  ITransactionPagination,
  ITransactionFilter,
  ITransactionResponse,
};

class TransactionAPI extends BaseAPI {
  async fetchAll({
    searchQuery,
    currentMonth,
    currentYear,
    startDate,
    endDate,
    budgetId,
    page = 1,
    limit = 10,
  }: {
    searchQuery: string;
    currentMonth: number;
    currentYear: number;
    startDate?: string | null;
    endDate?: string | null;
    budgetId?: string | null;
    page?: number;
    limit?: number;
  }): Promise<ITransactionResponse<ITransaction[]>> {
    const params: any = { searchQuery, page, limit };
    if (currentMonth != null) params.currentMonth = currentMonth;
    if (currentYear != null) params.currentYear = currentYear;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (budgetId) params.budgetId = budgetId;
    return this.makeRequest("/transaction", {
      method: "GET",
      params,
    });
  }

  async create(
    transaction: ITransaction,
  ): Promise<ITransactionResponse<ITransaction>> {
    return this.makeRequest("/transaction", {
      method: "POST",
      data: transaction,
    });
  }

  async update(
    id: string,
    updates: Partial<ITransaction>,
  ): Promise<ITransactionResponse<ITransaction>> {
    return this.makeRequest(`/transaction/${id}`, {
      method: "PUT",
      data: updates,
    });
  }

  async delete(id: string): Promise<ITransactionResponse<null>> {
    return this.makeRequest(`/transaction/${id}`, {
      method: "DELETE",
    });
  }
}

export const transactionAPI = new TransactionAPI();
export default transactionAPI;
