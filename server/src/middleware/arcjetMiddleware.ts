import arcjet, { shield, detectBot, tokenBucket } from "@arcjet/node";
import { isSpoofedBot } from "@arcjet/inspect";
import { ENV } from "../config/env";
import logger from "../utils/logger";

// Build a configured arcjet middleware. This returns an Express-compatible
// middleware. If Arcjet is not configured, we return a no-op middleware.
export function createArcjetMiddleware() {
  const MODE = ((ENV.ARCJET_MODE as string) || "LIVE").toUpperCase(); // LIVE | DRY_RUN | OFF

  if (!ENV.ARCJET_KEY || MODE === "OFF") {
    if (!ENV.ARCJET_KEY) {
      logger.warn(
        "Arcjet key not provided - Arcjet middleware will be a no-op."
      );
    } else {
      logger.info("Arcjet disabled via ARCJET_MODE=OFF");
    }
    return (_req: any, _res: any, next: any) => next();
  }

  const arc = arcjet({
    key: ENV.ARCJET_KEY as string,
    rules: [
      shield({ mode: MODE as any }),
      detectBot({ mode: MODE as any, allow: ["CATEGORY:SEARCH_ENGINE"] }),
      tokenBucket({
        mode: MODE as any,
        refillRate: Number(ENV.ARCJET_REFILL_RATE || 5),
        interval: Number(ENV.ARCJET_INTERVAL || 10),
        capacity: Number(ENV.ARCJET_CAPACITY || 10),
      }),
    ],
  }) as any;

  // Wrapped middleware ensures health probes and obvious spoofed bots are
  // allowed through and that errors from Arcjet don't take down the app.
  return async (req: any, res: any, next: any) => {
    try {
      const url = req.originalUrl || req.url || "";
      if (url.startsWith("/health") || url.startsWith("/static")) {
        return next();
      }

      const ua = req.headers?.["user-agent"] || "";
      // isSpoofedBot from @arcjet/inspect expects the raw UA string in some
      // versions, so we pass the UA directly; adjust if your version differs.
      if (isSpoofedBot(ua as any)) {
        logger.warn("Detected spoofed bot UA, allowing through and logging");
        return next();
      }

      // arc is the Arcjet middleware instance (callable in runtime)
      return arc(req, res, next);
    } catch (e) {
      logger.warn("Arcjet middleware error - failing open:", e);
      return next();
    }
  };
}

export default createArcjetMiddleware();
