import { NextFunction, Request, Response } from "express";
import logger from "../utils/logger";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env";

// Extend the Request interface to include user data
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        iat: number;
        exp: number;
      };
    }
  }
}

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info("Authenticating user...");

    const authToken = req.headers.authorization;
    if (!authToken) {
      return res.status(401).json({
        success: false,
        message: "No token provided.",
      });
    }

    const token = authToken.split(" ")[1]; // Assuming Bearer token
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Invalid token format.",
      });
    }

    // Verify the token with the secret key
    if (!ENV.JWT_SECRET_KEY) {
      logger.error("JWT_SECRET_KEY is not defined in environment variables");
      return res.status(500).json({
        success: false,
        message: "Server configuration error.",
      });
    }

    const decodedToken = jwt.verify(token, ENV.JWT_SECRET_KEY) as {
      userId: string;
      email: string;
      iat: number;
      exp: number;
    };

    // Log decoded token for debugging
    logger.info("Token verified successfully.", decodedToken);

    // Additional validation
    if (!decodedToken || !decodedToken.userId || !decodedToken.email) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload.",
      });
    }

    // Attach user information to request object
    req.user = {
      userId: decodedToken.userId,
      email: decodedToken.email,
      iat: decodedToken.iat,
      exp: decodedToken.exp,
    };

    logger.info(`User authenticated successfully: ${decodedToken.email}`);
    next();
  } catch (error) {
    logger.error("Authentication error:", error);

    // Handle specific JWT errors
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: "Invalid token.",
      });
    }

    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: "Token has expired.",
      });
    }

    // Generic error
    return res.status(500).json({
      success: false,
      message: "Authentication failed.",
    });
  }
};

export default authMiddleware;
