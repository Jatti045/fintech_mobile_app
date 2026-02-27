import { Request, Response } from "express";
import asyncHandler from "../middleware/asyncHandler";
import { prisma } from "../server";
import logger from "../utils/logger";
import { log } from "winston";

export const getTransactions = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const {
        page = 1,
        limit = 10,
        type,
        category,
        currentMonth,
        currentYear,
        startDate,
        endDate,
        budgetId,
        goalId,
        searchQuery,
      } = req.query;

      // Get userId from authenticated user
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      // Validate pagination parameters
      const pageNum = Math.max(1, Number(page) || 1);
      const limitNum = Math.min(10, Math.max(1, Number(limit) || 10)); // Max 10 items per page

      // Validate transaction type if provided
      if (type && !["INCOME", "EXPENSE"].includes(type as string)) {
        return res.status(400).json({
          success: false,
          message: "Invalid transaction type. Must be either INCOME or EXPENSE",
        });
      }

      // Build filter conditions
      const where: any = {
        userId: userId,
      };

      // Add optional filters with validation
      if (type && type !== "") {
        where.type = type;
      }

      if (category && category !== "") {
        where.category = category;
      }

      if (budgetId && budgetId !== "") {
        where.budgetId = budgetId;
      }

      if (goalId && goalId !== "") {
        where.goalId = goalId;
      }

      // Support filtering by currentMonth/currentYear
      // Only apply date filter if both currentMonth and currentYear are valid
      if (currentMonth !== undefined && currentYear !== undefined) {
        const month = Number(currentMonth);
        const year = Number(currentYear);

        // Validate that month and year are valid numbers
        if (
          !isNaN(month) &&
          !isNaN(year) &&
          month >= 0 &&
          month <= 11 &&
          year > 0
        ) {
          where.date = {
            gte: new Date(year, month, 1),
            lt: new Date(year, month + 1, 1),
          };
        }
      }

      /* if (startDate || endDate) {
        where.date = {};

        if (startDate) {
          const startDateObj = new Date(startDate as string);
          if (isNaN(startDateObj.getTime())) {
            return res.status(400).json({
              success: false,
              message: "Invalid startDate format",
            });
          }
          where.date.gte = startDateObj;
        }

        if (endDate) {
          const endDateObj = new Date(endDate as string);
          if (isNaN(endDateObj.getTime())) {
            return res.status(400).json({
              success: false,
              message: "Invalid endDate format",
            });
          }
          where.date.lte = endDateObj;
        }

        // Validate date range
        if (startDate && endDate) {
          const startDateObj = new Date(startDate as string);
          const endDateObj = new Date(endDate as string);
          if (startDateObj > endDateObj) {
            return res.status(400).json({
              success: false,
              message: "startDate cannot be later than endDate",
            });
          }
        }
      } */

      if (searchQuery && searchQuery !== "") {
        where.OR = [
          { name: { contains: searchQuery as string, mode: "insensitive" } },
          {
            description: {
              contains: searchQuery as string,
              mode: "insensitive",
            },
          },
        ];
      }

      // Calculate pagination
      const skip = (pageNum - 1) * limitNum;
      const take = limitNum;

      // Get transactions with related data
      const [transaction, totalCount, aggregateData] = await Promise.all([
        prisma.transaction.findMany({
          where,
          include: {
            budget: {
              select: {
                id: true,
                category: true,
                limit: true,
                spent: true,
              },
            },
            goal: {
              select: {
                id: true,
                target: true,
                progress: true,
              },
            },
          },
          orderBy: {
            date: "desc",
          },
          skip,
          take,
        }),
        prisma.transaction.count({ where }),
        prisma.transaction.aggregate({
          where: {
            ...where,
            type: "EXPENSE", // Only sum EXPENSE transactions for the summary
          },
          _sum: {
            amount: true,
          },
        }),
      ]);

      // Calculate pagination info
      const totalPages = Math.ceil(totalCount / take);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      logger.info(
        `Retrieved ${transaction.length} transactions for user ${userId}, page ${pageNum}/${totalPages}`,
      );

      res.status(200).json({
        success: true,
        message: "Transactions retrieved successfully",
        data: {
          transaction,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalCount,
            hasNextPage,
            hasPrevPage,
            limit: limitNum,
          },
          summary: {
            totalAmount: aggregateData._sum.amount || 0,
          },
          filters: {
            type: type || null,
            category: category || null,
            startDate: startDate || null,
            endDate: endDate || null,
            budgetId: budgetId || null,
            goalId: goalId || null,
          },
        },
      });
    } catch (error) {
      logger.error("Error in getTransactions:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: process.env.NODE_ENV === "development" ? error : undefined,
      });
    }
  },
);

export const createTransaction = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      logger.info("Create transaction endpoint hit...");

      // Get userId from authenticated user
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const {
        name,
        month,
        year,
        date,
        category,
        type,
        amount,
        icon,
        description,
        budgetId,
        goalId,
        originalCurrency,
        originalAmount,
      } = req.body;

      // Validation
      if (!name || !date || !category || !type || amount === undefined) {
        return res.status(400).json({
          success: false,
          message:
            "Missing required fields: name, date, category, type, and amount are required",
        });
      }

      // Validate transaction type
      if (!["INCOME", "EXPENSE"].includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid transaction type. Must be either INCOME or EXPENSE",
        });
      }

      // Validate amount
      if (typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Amount must be a positive number",
        });
      }

      // Validate date format
      const transactionDate = new Date(date);
      if (isNaN(transactionDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format",
        });
      }

      // Validate budget exists by budgetId and get budget Icon
      let budgetIcon: string | null = null;
      if (budgetId && budgetId.trim() !== "") {
        const budget = await prisma.budget.findFirst({
          where: {
            id: budgetId,
            userId: userId,
            date: {
              gte: new Date(year, month, 1),
              lt: new Date(year, month + 1, 1),
            },
          },
        });

        if (!budget) {
          return res.status(404).json({
            success: false,
            message: "Budget not found or doesn't belong to user",
          });
        }

        budgetIcon = budget.icon;
      }

      /* // Optional: Validate goal exists if goalId is provided
      if (goalId && goalId.trim() !== "") {
        const goal = await prisma.goal.findFirst({
          where: {
            id: goalId,
            userId: userId,
          },
        });

        if (!goal) {
          return res.status(404).json({
            success: false,
            message: "Goal not found or doesn't belong to user",
          });
        }
      } */

      // Create the transaction
      const transaction = await prisma.transaction.create({
        data: {
          name,
          date: transactionDate,
          category,
          icon: budgetIcon,
          type,
          amount,
          originalCurrency: originalCurrency || null,
          originalAmount:
            originalAmount != null ? Number(originalAmount) : null,
          description: description?.trim() || null,
          userId,
          budgetId: budgetId && budgetId.trim() !== "" ? budgetId : null,
          goalId: goalId && goalId.trim() !== "" ? goalId : null,
        },
        include: {
          budget: {
            select: {
              id: true,
              category: true,
              limit: true,
              spent: true,
            },
          },
          /*   goal: {
            select: {
              id: true,
              target: true,
              progress: true,
            },
          }, */
        },
      });

      // Update budget spent amount if this is an expense linked to a budget
      if (budgetId && type === "EXPENSE") {
        await prisma.budget.update({
          where: { id: budgetId },
          data: {
            spent: {
              increment: amount,
            },
          },
        });
      }

      /*       // Update goal progress if this is income linked to a goal
      if (goalId && type === "INCOME") {
        await prisma.goal.update({
          where: { id: goalId },
          data: {
            progress: {
              increment: amount,
            },
          },
        });
      } */

      logger.info(
        `Transaction created successfully for user ${userId}: ${transaction.id}`,
      );

      res.status(201).json({
        success: true,
        message: "Transaction created successfully",
        data: {
          transaction,
        },
      });
    } catch (error) {
      logger.error("Error in createTransaction:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: process.env.NODE_ENV === "development" ? error : undefined,
      });
    }
  },
);

export const deleteTransaction = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      logger.info("Delete transaction endpoint hit...");

      // Get userId from authenticated user
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const { id } = req.params;

      // Validate transaction ID
      if (!id || id.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Transaction ID is required",
        });
      }

      // Find the transaction to ensure it exists and belongs to the user
      const existingTransaction = await prisma.transaction.findFirst({
        where: {
          id: id,
          userId: userId,
        },
        include: {
          budget: true,
          goal: true,
        },
      });

      if (!existingTransaction) {
        return res.status(404).json({
          success: false,
          message: "Transaction not found or doesn't belong to user",
        });
      }

      // Update related budget/goal before deleting transaction
      const updatePromises: Promise<any>[] = [];

      // If transaction was linked to a budget and was an expense, subtract from spent amount
      if (
        existingTransaction.budgetId &&
        existingTransaction.type === "EXPENSE"
      ) {
        updatePromises.push(
          prisma.budget.update({
            where: { id: existingTransaction.budgetId },
            data: {
              spent: {
                decrement: existingTransaction.amount,
              },
            },
          }),
        );
      }

      // If transaction was linked to a goal and was income, subtract from progress
      if (existingTransaction.goalId && existingTransaction.type === "INCOME") {
        updatePromises.push(
          prisma.goal.update({
            where: { id: existingTransaction.goalId },
            data: {
              progress: {
                decrement: existingTransaction.amount,
              },
            },
          }),
        );
      }

      // Execute updates and deletion in a transaction
      await prisma.$transaction(async (tx) => {
        // Update related entities first
        await Promise.all(updatePromises);

        // Delete the transaction
        await tx.transaction.delete({
          where: {
            id: id,
            userId: userId, // Double-check ownership
          },
        });
      });

      logger.info(`Transaction deleted successfully for user ${userId}: ${id}`);

      res.status(200).json({
        success: true,
        message: "Transaction deleted successfully",
        data: {
          deletedTransactionId: id,
          restoredBudget: existingTransaction.budgetId
            ? {
                budgetId: existingTransaction.budgetId,
                amountRestored:
                  existingTransaction.type === "EXPENSE"
                    ? existingTransaction.amount
                    : 0,
              }
            : null,
          restoredGoal: existingTransaction.goalId
            ? {
                goalId: existingTransaction.goalId,
                amountRestored:
                  existingTransaction.type === "INCOME"
                    ? existingTransaction.amount
                    : 0,
              }
            : null,
        },
      });
    } catch (error) {
      logger.error("Error in deleteTransaction:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: process.env.NODE_ENV === "development" ? error : undefined,
      });
    }
  },
);

export const updateTransaction = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      logger.info("Update transaction endpoint hit...");

      const userId = req.user?.userId;
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "User not authenticated" });
      }

      const { id } = req.params;
      if (!id || id.trim() === "") {
        return res
          .status(400)
          .json({ success: false, message: "Transaction ID is required" });
      }

      const existingTransaction = await prisma.transaction.findFirst({
        where: { id: id, userId: userId },
        include: { budget: true, goal: true },
      });

      if (!existingTransaction) {
        return res.status(404).json({
          success: false,
          message: "Transaction not found or doesn't belong to user",
        });
      }

      // Accept partial updates
      const {
        name,
        date,
        category,
        type,
        amount,
        icon,
        description,
        budgetId: rawBudgetId,
        goalId: rawGoalId,
        originalCurrency,
        originalAmount,
      } = req.body;

      // Validate provided fields
      if (type && !["INCOME", "EXPENSE"].includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid transaction type. Must be either INCOME or EXPENSE",
        });
      }

      let newAmount = existingTransaction.amount;
      if (amount !== undefined) {
        if (typeof amount !== "number" || amount <= 0) {
          return res.status(400).json({
            success: false,
            message: "Amount must be a positive number",
          });
        }
        newAmount = amount;
      }

      let newDate = existingTransaction.date;
      if (date) {
        const d = new Date(date);
        if (isNaN(d.getTime())) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid date format" });
        }
        newDate = d;
      }

      // Determine new associations (allow clearing by sending empty string)
      const newBudgetId = req.body.hasOwnProperty("budgetId")
        ? rawBudgetId && String(rawBudgetId).trim() !== ""
          ? String(rawBudgetId)
          : null
        : existingTransaction.budgetId;

      const newGoalId = req.body.hasOwnProperty("goalId")
        ? rawGoalId && String(rawGoalId).trim() !== ""
          ? String(rawGoalId)
          : null
        : existingTransaction.goalId;

      const newType = type ? type : existingTransaction.type;

      // If a newBudgetId is provided, ensure it belongs to the user
      if (newBudgetId) {
        const budget = await prisma.budget.findFirst({
          where: { id: newBudgetId, userId },
        });
        if (!budget) {
          return res.status(404).json({
            success: false,
            message: "Budget not found or doesn't belong to user",
          });
        }
      }

      // If a newGoalId is provided, ensure it belongs to the user
      if (newGoalId) {
        const goal = await prisma.goal.findFirst({
          where: { id: newGoalId, userId },
        });
        if (!goal) {
          return res.status(404).json({
            success: false,
            message: "Goal not found or doesn't belong to user",
          });
        }
      }

      const ops: any[] = [];

      const oldAmount = Number(existingTransaction.amount || 0);
      const oldType = existingTransaction.type;
      const oldBudgetId = existingTransaction.budgetId;
      const oldGoalId = existingTransaction.goalId;

      // Budget adjustments
      // Remove/decrement old budget spent if necessary
      if (oldBudgetId && oldType === "EXPENSE") {
        // If budget removed or type changed away from EXPENSE, decrement by old amount
        if (oldBudgetId !== newBudgetId || newType !== "EXPENSE") {
          ops.push(
            prisma.budget.update({
              where: { id: oldBudgetId },
              data: { spent: { decrement: oldAmount } },
            }),
          );
        } else if (oldBudgetId === newBudgetId && newType === "EXPENSE") {
          // Same budget still used as expense -> adjust by diff
          const diff = newAmount - oldAmount;
          if (diff > 0) {
            ops.push(
              prisma.budget.update({
                where: { id: oldBudgetId },
                data: { spent: { increment: diff } },
              }),
            );
          } else if (diff < 0) {
            ops.push(
              prisma.budget.update({
                where: { id: oldBudgetId },
                data: { spent: { decrement: Math.abs(diff) } },
              }),
            );
          }
        }
      }

      // Add/increment new budget spent if necessary
      if (newBudgetId && newType === "EXPENSE") {
        if (newBudgetId !== oldBudgetId) {
          ops.push(
            prisma.budget.update({
              where: { id: newBudgetId },
              data: { spent: { increment: newAmount } },
            }),
          );
        }
        // else handled above for diff
      }

      // Goal adjustments (for INCOME)
      if (oldGoalId && oldType === "INCOME") {
        if (oldGoalId !== newGoalId || newType !== "INCOME") {
          ops.push(
            prisma.goal.update({
              where: { id: oldGoalId },
              data: { progress: { decrement: oldAmount } },
            }),
          );
        } else if (oldGoalId === newGoalId && newType === "INCOME") {
          const diff = newAmount - oldAmount;
          if (diff > 0) {
            ops.push(
              prisma.goal.update({
                where: { id: oldGoalId },
                data: { progress: { increment: diff } },
              }),
            );
          } else if (diff < 0) {
            ops.push(
              prisma.goal.update({
                where: { id: oldGoalId },
                data: { progress: { decrement: Math.abs(diff) } },
              }),
            );
          }
        }
      }

      if (newGoalId && newType === "INCOME") {
        if (newGoalId !== oldGoalId) {
          ops.push(
            prisma.goal.update({
              where: { id: newGoalId },
              data: { progress: { increment: newAmount } },
            }),
          );
        }
      }

      // Build transaction update data object (only include provided fields)
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (date !== undefined) updateData.date = newDate;
      if (category !== undefined) updateData.category = category;
      if (type !== undefined) updateData.type = type;
      if (amount !== undefined) updateData.amount = newAmount;
      if (icon !== undefined)
        updateData.icon =
          icon && String(icon).trim() !== "" ? String(icon).trim() : null;
      if (description !== undefined)
        updateData.description =
          description && String(description).trim() !== ""
            ? String(description).trim()
            : null;
      if (req.body.hasOwnProperty("originalCurrency"))
        updateData.originalCurrency = originalCurrency || null;
      if (req.body.hasOwnProperty("originalAmount"))
        updateData.originalAmount =
          originalAmount != null ? Number(originalAmount) : null;
      // set budgetId/goalId explicitly (allow null)
      if (req.body.hasOwnProperty("budgetId"))
        updateData.budgetId = newBudgetId;
      if (req.body.hasOwnProperty("goalId")) updateData.goalId = newGoalId;

      // Final update operation
      const txUpdateOp = prisma.transaction.update({
        where: { id },
        data: updateData,
        include: {
          budget: {
            select: { id: true, category: true, limit: true, spent: true },
          },
          goal: { select: { id: true, target: true, progress: true } },
        },
      });

      const allOps = [...ops, txUpdateOp];

      const results = await prisma.$transaction(allOps);

      // The updated transaction will be the last result
      const updatedTransaction = results[results.length - 1];

      logger.info(`Transaction updated for user ${userId}: ${id}`);

      res.status(200).json({
        success: true,
        message: "Transaction updated successfully",
        data: { transaction: updatedTransaction },
      });
    } catch (error) {
      logger.error("Error in updateTransaction:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: process.env.NODE_ENV === "development" ? error : undefined,
      });
    }
  },
);
