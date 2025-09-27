import express from "express";
import {
  createTransaction,
  deleteTransaction,
  getTransactions,
  updateTransaction,
} from "../controllers/transactionController";
import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

// Protected routes
router.get("/", authMiddleware, getTransactions);
router.post("/", authMiddleware, createTransaction);
router.delete("/:id", authMiddleware, deleteTransaction);
router.put("/:id", authMiddleware, updateTransaction);

export default router;
