import { Request, Response } from "express";
import asyncHandler from "../middleware/asyncHandler";
import logger from "../utils/logger";
import { prisma } from "../server";

export const createBudget = asyncHandler(
  async (req: Request, res: Response) => {
    logger.info("Creating budget endpoint hit...");
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const { category, limit, month, year } = req.body;

      // Check if budget with same category exists for user
      const existingBudget = await prisma.budget.findFirst({
        where: {
          userId,
          category,
          date: {
            gte: new Date(year, month, 1),
            lt: new Date(year, month + 1, 1),
          },
        },
      });

      if (existingBudget) {
        return res.status(400).json({
          success: false,
          message: "Budget for this category already exists",
        });
      }

      if (!category || limit === undefined) {
        return res
          .status(400)
          .json({ success: false, message: "Category and limit are required" });
      }

      const newBudget = await prisma.budget.create({
        data: {
          userId,
          category,
          limit,
          date: new Date(year, month, 1),
        },
      });

      res.status(201).json({
        success: true,
        message: "Budget created successfully",
        data: newBudget,
      });
    } catch (error) {
      logger.error("Error creating budget:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

export const getBudgets = asyncHandler(async (req: Request, res: Response) => {
  logger.info("Getting budgets endpoint hit...");
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { month, year } = req.query;
    if (month === undefined || year === undefined) {
      return res.status(400).json({
        success: false,
        message: "Month and year query parameters are required",
      });
    }

    const budgets = await prisma.budget.findMany({
      where: {
        userId,
        date: {
          gte: new Date(Number(year), Number(month), 1),
          lt: new Date(Number(year), Number(month) + 1, 1),
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Budgets retrieved successfully",
      data: budgets,
    });
  } catch (error) {
    logger.error("Error getting budgets:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export const deleteBudget = asyncHandler(
  async (req: Request, res: Response) => {
    logger.info("Deleting budget endpoint hit...");
    try {
      const userId = req.user?.userId;
      const { budgetId } = req.params;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const budget = await prisma.budget.findUnique({
        where: {
          id: budgetId,
          userId,
        },
      });

      if (!budget) {
        return res.status(404).json({
          success: false,
          message: "Budget not found",
        });
      }

      // Prevent deletion if there are transactions attached to this budget
      const attachedCount = await prisma.transaction.count({
        where: {
          budgetId: budgetId,
          userId,
        },
      });

      if (attachedCount > 0) {
        return res.status(400).json({
          success: false,
          message:
            "Cannot delete budget: there are transactions attached to this budget. Remove or reassign those transactions first.",
        });
      }

      await prisma.budget.delete({
        where: {
          id: budgetId,
        },
      });

      res.status(200).json({
        success: true,
        message: "Budget deleted successfully",
        data: budgetId,
      });
    } catch (error) {
      logger.error("Error deleting budget:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

export const updateBudget = asyncHandler(
  async (req: Request, res: Response) => {
    logger.info("Updating budget endpoint hit...");
    try {
      const userId = req.user?.userId;
      const { budgetId } = req.params;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      if (!budgetId) {
        return res
          .status(400)
          .json({ success: false, message: "budgetId is required" });
      }

      const existing = await prisma.budget.findUnique({
        where: { id: budgetId },
      });
      if (!existing || existing.userId !== userId) {
        return res
          .status(404)
          .json({
            success: false,
            message: "Budget not found or doesn't belong to user",
          });
      }

      const { category, limit, month, year, icon } = req.body;

      // If attempting to change category or month/year, ensure uniqueness for that user-month
      const newMonth =
        typeof month !== "undefined" ? Number(month) : existing.date.getMonth();
      const newYear =
        typeof year !== "undefined"
          ? Number(year)
          : existing.date.getFullYear();
      const newCategory =
        typeof category !== "undefined" ? String(category) : existing.category;

      // If category or date changed, make sure no other budget exists for same category/month/year
      if (
        newCategory !== existing.category ||
        newMonth !== existing.date.getMonth() ||
        newYear !== existing.date.getFullYear()
      ) {
        const conflict = await prisma.budget.findFirst({
          where: {
            userId,
            category: newCategory,
            date: {
              gte: new Date(newYear, newMonth, 1),
              lt: new Date(newYear, newMonth + 1, 1),
            },
            id: { not: budgetId },
          },
        });

        if (conflict) {
          return res
            .status(400)
            .json({
              success: false,
              message:
                "Another budget with this category exists for the same month",
            });
        }
      }

      // Validate limit
      if (typeof limit !== "undefined") {
        const numLimit = Number(limit);
        if (isNaN(numLimit) || numLimit < 0) {
          return res
            .status(400)
            .json({
              success: false,
              message: "Limit must be a non-negative number",
            });
        }

        // Ensure limit not below already spent amount
        if (numLimit < existing.spent) {
          return res
            .status(400)
            .json({
              success: false,
              message:
                "Limit cannot be less than current spent amount. Adjust transactions before reducing the limit.",
            });
        }
      }

      const updateData: any = {};
      if (typeof category !== "undefined") updateData.category = category;
      if (typeof limit !== "undefined") updateData.limit = Number(limit);
      if (typeof icon !== "undefined")
        updateData.icon =
          icon && String(icon).trim() !== "" ? String(icon).trim() : null;
      if (typeof month !== "undefined" || typeof year !== "undefined")
        updateData.date = new Date(newYear, newMonth, 1);

      const updated = await prisma.budget.update({
        where: { id: budgetId },
        data: updateData,
      });

      res
        .status(200)
        .json({
          success: true,
          message: "Budget updated successfully",
          data: updated,
        });
    } catch (error) {
      logger.error("Error updating budget:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);
