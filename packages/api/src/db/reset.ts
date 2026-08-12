import { reset } from "drizzle-seed";
import * as schema from "./schema";
import db from "./index";

async function main() {
  await reset(db, schema);
}

main();
