import { drizzle } from "drizzle-orm/node-postgres";
import "dotenv/config";
import { relations } from "./relations";
import { env } from "../env";

const db = drizzle(env.DATABASE_URL, { relations });

export default db;
