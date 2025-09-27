import { Request, Response, NextFunction } from "express";
import { ENV } from "../config/env";
import logger from "../utils/logger";

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log the full error on the server for diagnostics
  logger.error("Error: ", error);

  // Send a normalized JSON response to the client.
  // Shape: { success: boolean, message: string, stack?: string }
  // statusCode may be attached to the error by upstream middleware.
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Internal server error",
    // Only include stack trace in development to avoid leaking internals
    stack: ENV.NODE_ENV === "development" ? error.stack : undefined,
  });
};
