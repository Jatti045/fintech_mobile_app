import express from "express";
import {
  signup,
  login,
  forgotPassword,
  resetPassword,
  uploadProfilePicture,
  deleteProfilePicture,
  deleteAccount,
  changePassword,
  updateCurrency,
} from "../controllers/userController";
import authMiddleware from "../middleware/authMiddleware";
import { uploadMiddleware } from "../middleware/uploadMiddleware";

const router = express.Router();

// Public routes
router.post("/signup", signup);
router.post("/login", login);
// Request a password reset (sends OTP to email)
router.post("/forgot-password", forgotPassword);
// Reset password using OTP
router.post("/reset-password", resetPassword);

// Protected routes
router.post(
  "/:userId/upload",
  authMiddleware,
  uploadMiddleware,
  uploadProfilePicture,
);

// Delete profile picture
router.delete("/:userId/profile-picture", authMiddleware, deleteProfilePicture);

// Update preferred currency
router.put("/currency", authMiddleware, updateCurrency);

// Delete account
router.delete("/delete/:userId", authMiddleware, deleteAccount);
// Change password
router.post("/change-password", authMiddleware, changePassword);
export default router;
