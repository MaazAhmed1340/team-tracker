import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import path from "path";
import fs from "fs";

// Ensure .env is loaded (covers running from different cwd too)
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  // Also try default load so tests / CI that set env vars still work
  dotenv.config();
}

console.log("cwd", process.cwd(), "DATABASE_URL=", process.env.DATABASE_URL);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const { Pool } = pg;
export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });