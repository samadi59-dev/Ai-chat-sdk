import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing. Copy .env.example to .env.local and add your Neon connection string.");
}

const sql = neon(databaseUrl);
export const db = drizzle({ client: sql });
