import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(connectionString);
export const db = drizzle(client, { schema });
export type Database = typeof db;
/** The handle passed to a `db.transaction()` callback — shares the query builder API with `Database` but lacks `$client`. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
