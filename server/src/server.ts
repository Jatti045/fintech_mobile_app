import express, { Request, Response } from "express";
import logger from "./utils/logger";
import transactionRouter from "./routes/transactionRoutes";
import userRouter from "./routes/userRoutes";
import budgetRouter from "./routes/budgetRoutes";
import { PrismaClient } from "@prisma/client";
import { ENV } from "./config/env";
import helmet from "helmet";
import cors from "cors";
import arcjetMiddleware from "./middleware/arcjetMiddleware";

const app = express();
const PORT = (ENV.PORT || 3000) as number;
const HOST = ENV.HOST || "0.0.0.0";

export const prisma = new PrismaClient();

// Background cleanup: delete expired password reset tokens
let cleanupInterval: NodeJS.Timeout | null = null;

async function deleteExpiredResetTokens() {
  try {
    const now = new Date();
    const result = await prisma.passwordResetToken.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    });
    if (result && typeof result.count === "number") {
      logger.info(`Deleted ${result.count} expired password reset tokens.`);
    }
  } catch (err) {
    logger.warn("Failed to delete expired password reset tokens:", err);
  }
}

// Run cleanup immediately and then every minute
async function startCleanupJob() {
  try {
    await deleteExpiredResetTokens();
    cleanupInterval = setInterval(() => {
      deleteExpiredResetTokens().catch((e) =>
        logger.warn("Error in scheduled deleteExpiredResetTokens:", e)
      );
    }, 60 * 1000); // every 60 seconds
    logger.info("Started expired password reset token cleanup job.");
  } catch (e) {
    logger.warn("Failed to start cleanup job:", e);
  }
}

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Set trust proxy when running behind a proxy (Render, Heroku).
if (ENV.TRUST_PROXY) {
  const trust =
    ENV.TRUST_PROXY === "1" || ENV.TRUST_PROXY.toLowerCase() === "true";
  if (trust) app.set("trust proxy", 1);
}

app.use(helmet());

// Configure CORS from ALLOWED_ORIGINS (comma separated). Defaults to allow all origins in dev.
const allowed = (ENV.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const corsOptions =
  allowed.length === 0 || allowed.includes("*")
    ? undefined
    : { origin: allowed };
app.use(cors(corsOptions));

// Routes
// Mount Arcjet middleware on /api to protect API endpoints (health remains public)
app.use("/api", arcjetMiddleware);

app.use("/api/transaction", transactionRouter);
app.use("/api/user", userRouter);
app.use("/api/budget", budgetRouter);

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

const server = app.listen(PORT, HOST, () => {
  logger.info(`Server is running on http://${HOST}:${PORT}`);
  // start background cleanup when the server is ready
  startCleanupJob().catch((e) => logger.warn("startCleanupJob error:", e));
});

function shutdown(signal: string) {
  return async () => {
    logger.info(`Received ${signal}. Shutting down...`);

    // Stop cleanup interval
    try {
      if (cleanupInterval) {
        clearInterval(cleanupInterval as unknown as number);
        cleanupInterval = null;
      }
    } catch (e) {
      logger.warn("Error clearing cleanup interval:", e);
    }

    try {
      await prisma.$disconnect();
    } catch (e) {
      logger.warn("Error disconnecting prisma:", e);
    }

    server.close(() => process.exit(0));
  };
}

process.on("SIGINT", shutdown("SIGINT"));
process.on("SIGTERM", shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  logger.warn("Unhandled Rejection:", reason);
  // attempt a graceful shutdown
  shutdown("unhandledRejection")();
});
