import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;


// if (!process.env.DATABASE_URL) {
//   throw new Error(
//     "DATABASE_URL must be set. Did you forget to provision a database?",
//   );
// }

export const pool = new Pool({ connectionString: "postgresql://neondb_owner:npg_Yi6oazJuZQL9@ep-damp-queen-a18f9rv2-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" });
export const db = drizzle(pool, { schema });
