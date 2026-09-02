import { defineConfig } from "drizzle-kit";
import path from "path";

const url = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/camarin";

export default defineConfig({
  schema: "./src/schema/**/*.ts",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});
