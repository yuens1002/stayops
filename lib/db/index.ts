import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Neon HTTP driver — no connection pool to manage in Fluid Compute functions.
const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });
