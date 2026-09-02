import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env file if DATABASE_URL is not already set
try {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(__dir, "../.env");
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  // .env not found - rely on environment variables set externally
}

import app from "./app";
import { logger } from "./lib/logger";
import { ensureSeedData } from "./lib/seed";

const rawPort = process.env["PORT"] || "5000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

ensureSeedData()
  .then(() => {
    logger.info("Database seed checked successfully");
  })
  .catch((err: unknown) => {
    logger.warn({ err }, "Database seed skipped (PostgreSQL offline or unreachable)");
  })
  .finally(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  });
