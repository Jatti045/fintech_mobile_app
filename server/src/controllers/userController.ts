import { Request, Response } from "express";
import asyncHandler from "../middleware/asyncHandler";
import logger from "../utils/logger";
import { prisma } from "../server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env";
import { uploadToCloudinary, deleteFromCloudinary } from "../utils/cloudinary";
import sendEmail from "../utils/sendEmail";

export const signup = asyncHandler(async (req: Request, res: Response) => {
  logger.info("Signup endpoint hit...");
  const { username, email: rawEmail, password, confirmPassword } = req.body;
  const email =
    typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : rawEmail;

  // Basic validation
  if (!username || !email || !password || !confirmPassword) {
    return res
      .status(400)
      .json({ success: false, message: "All fields are required." });
  }

  if (password !== confirmPassword) {
    return res
      .status(400)
      .json({ success: false, message: "Passwords do not match." });
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return res
      .status(400)
      .json({ success: false, message: "User already exists." });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user
  const newUser = await prisma.user.create({
    data: {
      username,
      email,
      password: hashedPassword,
    },
  });

  res.status(201).json({
    success: true,
    message: "User created successfully.",
    data: newUser,
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  logger.info("Login endpoint hit...");
  const { email: rawEmail, password } = req.body;
  const email =
    typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : rawEmail;

  // Basic validation
  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Email and password are required." });
  }

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: `User with email ${email} does not exist. Please sign up first.`,
    });
  }

  // Compare passwords
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid credentials." });
  }

  // Generate JWT
  const token = jwt.sign(
    { username: user.username, email: user.email, userId: user.id },
    ENV.JWT_SECRET_KEY as string
  );

  res.status(200).json({
    success: true,
    message: "Login successful.",
    data: {
      user,
      token,
    },
  });
});

export const deleteAccount = asyncHandler(
  async (req: Request, res: Response) => {
    logger.info("Delete account endpoint hit...");
    try {
      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required in route params.",
        });
      }

      // Fetch user first (so we can remove profile image from Cloudinary)
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { profilePic: true },
      });

      if (!existingUser) {
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      }

      // Delete dependent records first to avoid FK constraint errors.
      // Order: transactions -> budgets -> goals -> user
      await prisma.$transaction([
        prisma.transaction.deleteMany({ where: { userId } }),
        prisma.budget.deleteMany({ where: { userId } }),
        prisma.goal.deleteMany({ where: { userId } }),
        prisma.user.delete({ where: { id: userId } }),
      ]);

      // Attempt to remove profile picture from Cloudinary (best-effort)
      if (existingUser.profilePic) {
        try {
          const urlParts = existingUser.profilePic.split("/");
          const fileNameWithExtension = urlParts[urlParts.length - 1];
          const fileName = fileNameWithExtension.split(".")[0];
          const publicId = `profile-pictures/${fileName}`;
          await deleteFromCloudinary(publicId);
        } catch (e) {
          // Log but don't fail the request because DB deletion succeeded
          logger.warn("Failed to delete profile picture from Cloudinary:", e);
        }
      }

      res.status(200).json({
        success: true,
        message: "User account and related data deleted successfully.",
      });
    } catch (error) {
      logger.error("Error deleting user account:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Server Error";
      res.status(500).json({
        success: false,
        message: errorMessage,
      });
    }
  }
);

export const uploadProfilePicture = asyncHandler(
  async (req: Request, res: Response) => {
    logger.info("Upload profile picture endpoint hit...");

    try {
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded.",
        });
      }

      // Get userId from route params
      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required in route params.",
        });
      }

      // Get current user to check if they have an existing profile picture
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { profilePic: true },
      });

      if (!currentUser) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      // If user has an existing profile picture, extract the public ID to delete it later
      let oldPublicId = null;
      if (currentUser.profilePic) {
        // Extract public ID from Cloudinary URL
        const urlParts = currentUser.profilePic.split("/");
        const fileNameWithExtension = urlParts[urlParts.length - 1];
        const fileName = fileNameWithExtension.split(".")[0];
        oldPublicId = `profile-pictures/${fileName}`;
      }

      // Upload new image to Cloudinary
      const { url: profilePicUrl, publicId } = await uploadToCloudinary(
        req.file.buffer,
        req.file.originalname,
        "profile-pictures"
      );

      // Update user's profile picture in database
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { profilePic: profilePicUrl },
        select: {
          id: true,
          username: true,
          email: true,
          profilePic: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Delete old profile picture from Cloudinary (if it exists)
      if (oldPublicId) {
        await deleteFromCloudinary(oldPublicId);
      }

      logger.info(`Profile picture uploaded successfully for user: ${userId}`);

      res.status(200).json({
        success: true,
        message: "Profile picture uploaded successfully.",
        data: updatedUser,
      });
    } catch (error) {
      logger.error("Error uploading profile picture:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Server Error";
      res.status(500).json({
        success: false,
        message: errorMessage,
      });
    }
  }
);

export const deleteProfilePicture = asyncHandler(
  async (req: Request, res: Response) => {
    logger.info("Delete profile picture endpoint hit...");
    try {
      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required in route params.",
        });
      }

      // Fetch current user to see if they have a profile picture
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { profilePic: true },
      });
      if (!currentUser) {
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      }

      if (currentUser.profilePic) {
        // Extract public ID like in upload handler
        const urlParts = currentUser.profilePic.split("/");
        const fileNameWithExtension = urlParts[urlParts.length - 1];
        const fileName = fileNameWithExtension.split(".")[0];
        const publicId = `profile-pictures/${fileName}`;

        // Attempt to delete from Cloudinary (best-effort)
        await deleteFromCloudinary(publicId);
      }

      // Update DB to remove profilePic reference
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { profilePic: null },
        select: {
          id: true,
          username: true,
          email: true,
          profilePic: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.status(200).json({
        success: true,
        message: "Profile picture deleted.",
        data: updatedUser,
      });
    } catch (error) {
      logger.error("Error deleting profile picture:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Server Error";
      res.status(500).json({ success: false, message: errorMessage });
    }
  }
);

export const changePassword = asyncHandler(
  async (req: Request, res: Response) => {
    logger.info("Change password endpoint hit...");
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const { currentPassword, newPassword, confirmPassword } = req.body;
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: "All password fields are required.",
        });
      }

      if (newPassword !== confirmPassword) {
        return res
          .status(400)
          .json({ success: false, message: "New passwords do not match." });
      }

      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
      });
      if (!existingUser) {
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      }

      const match = await bcrypt.compare(
        currentPassword,
        existingUser.password
      );
      if (!match) {
        return res
          .status(400)
          .json({ success: false, message: "Current password is incorrect." });
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashed },
      });

      res
        .status(200)
        .json({ success: true, message: "Password changed successfully." });
    } catch (error) {
      logger.error("Error changing password:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

export const forgotPassword = asyncHandler(
  async (req: Request, res: Response) => {
    logger.info("Forgot password endpoint hit...");
    try {
      const { email: rawEmail } = req.body;
      const email =
        typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : rawEmail;
      if (!email) {
        return res
          .status(400)
          .json({ success: false, message: "Email is required." });
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        // As requested, verify user exists and return not found
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      }

      // generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // hash OTP before storing
      const hashedOtp = await bcrypt.hash(otp, 10);

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Store hashed token in PasswordResetToken table.
      // Note: earlier versions of the schema used different field names
      // (`tokenHash` vs `token`). The generated Prisma client may expose
      // fields differently depending on the migration history. We write
      // to the `token` field here and coerce with `as any` to avoid
      // TypeScript issues across branches. If you change the schema,
      // update this line accordingly.
      await prisma.passwordResetToken.create({
        data: {
          token: hashedOtp as any,
          userId: user.id,
          expiresAt,
        } as any,
      });

      // send email with OTP
      const subject = "Your password reset code";
      const text = `Your password reset code is: ${otp}. It will expire in 15 minutes.`;
      await sendEmail(user.email, subject, text);

      res
        .status(200)
        .json({ success: true, message: "Reset code sent to email." });
    } catch (error) {
      logger.error("Error in forgotPassword:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

export const resetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const {
        email: rawEmail,
        otp,
        newPassword,
        confirmPassword,
        verifyOnly,
      } = req.body;
      const email =
        typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : rawEmail;

      if (!email || !otp) {
        return res
          .status(400)
          .json({ success: false, message: "Email and code are required." });
      }

      if (!verifyOnly) {
        if (!newPassword || !confirmPassword) {
          return res
            .status(400)
            .json({ success: false, message: "New passwords are required." });
        }

        if (newPassword !== confirmPassword) {
          return res
            .status(400)
            .json({ success: false, message: "Passwords do not match." });
        }
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      }

      // Find the most recent token for this user
      const tokenRecord = await prisma.passwordResetToken.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });

      if (!tokenRecord) {
        return res.status(400).json({
          success: false,
          message: "No reset token found. Please request a new code.",
        });
      }

      // Check expiry
      if (
        tokenRecord.expiresAt &&
        tokenRecord.expiresAt.getTime() < Date.now()
      ) {
        return res.status(400).json({
          success: false,
          message: "Reset token has expired. Please request a new code.",
        });
      }

      // The token may be in `tokenHash` or `token` depending on past
      // migrations. Normalize by checking both.
      const storedHash =
        (tokenRecord as any).tokenHash || (tokenRecord as any).token;

      const isValid = await bcrypt.compare(otp, storedHash);
      if (!isValid) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid reset code." });
      }

      if (verifyOnly) {
        return res
          .status(200)
          .json({ success: true, message: "Code verified." });
      }

      // All good — update password and remove tokens for this user
      const hashed = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashed },
      });

      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id },
      });

      res
        .status(200)
        .json({ success: true, message: "Password reset successful." });
    } catch (error) {
      logger.error("Error in resetPassword:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);
