import BaseAPI from "./base";

export enum TransactionType {
  INCOME = "INCOME",
  EXPENSE = "EXPENSE",
}

export interface ITransaction {
  id?: string;
  name: string;
  month: number;
  year: number;
  category: string;
  amount: number;
  date: string;
  type: TransactionType;
  icon?: string;
  createdAt?: string;
  updatedAt?: string;
  budgetId?: string | null;
  goalId?: string | null;
}

export interface ITransactionPagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  limit: number;
}

export interface ITransactionFilter {
  type?: TransactionType;
  category?: string;
  startDate?: string;
  endDate?: string;
  budgetId?: string;
  goalId?: string;
}

export interface ITransactionResponse<T> {
  success: boolean;
  message: string;
  data: {
    transaction: T;
    pagination?: ITransactionPagination;
    filters?: ITransactionFilter;
  };
}

class TransactionAPI extends BaseAPI {
  async fetchAll({
    searchQuery,
    currentMonth,
    currentYear,
    startDate,
    endDate,
    budgetId,
  }: {
    searchQuery: string;
    currentMonth: number;
    currentYear: number;
    startDate?: string | null;
    endDate?: string | null;
    budgetId?: string | null;
  }): Promise<ITransactionResponse<ITransaction[]>> {
    const params: any = { searchQuery };
    if (currentMonth) params.currentMonth = currentMonth;
    if (currentYear) params.currentYear = currentYear;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (budgetId) params.budgetId = budgetId;
    return this.makeRequest("/transaction", {
      method: "GET",
      params,
    });
  }

  async create(
    transaction: ITransaction
  ): Promise<ITransactionResponse<ITransaction>> {
    return this.makeRequest("/transaction", {
      method: "POST",
      data: transaction,
    });
  }

  async update(
    id: string,
    updates: Partial<ITransaction>
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
