// ─── Budget Domain Types ────────────────────────────────────────────────────

import type { ITransaction } from "@/types/transaction/types";

export interface IBudget {
  id: string;
  date: Date;
  category: string;
  icon: string;
  limit: number;
  spent: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
  transactions?: ITransaction[];
}

export interface BudgetState {
  budgets: IBudget[];
  loading: boolean;
  error: string | null;
}

export interface IBudgetData {
  category: string;
  limit: number;
  month: number;
  year: number;
}
