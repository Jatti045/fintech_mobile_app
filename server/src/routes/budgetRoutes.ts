import express from "express";
import {
  createBudget,
  getBudgets,
  deleteBudget,
  updateBudget,
} from "../controllers/budgetController";
import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

// Protected routes
router.post("/", authMiddleware, createBudget);
router.get("/", authMiddleware, getBudgets);
router.put("/:budgetId", authMiddleware, updateBudget);
router.delete("/:budgetId", authMiddleware, deleteBudget);

export default router;
