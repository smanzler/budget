import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import db from "../../db";
import { BankAccounts, Transactions } from "../../db/schema";
import { protectedProcedure, router } from "../../lib/trpc";

const CURSOR_SEPARATOR = "|";

/**
 * Keyset cursors carry **both** sort keys. Encoding only the date would drop or
 * duplicate rows whenever a page boundary lands inside a busy day.
 */
const encodeCursor = (row: { date: string; id: string }) =>
  `${row.date}${CURSOR_SEPARATOR}${row.id}`;

const decodeCursor = (cursor: string) => {
  const [date, id] = cursor.split(CURSOR_SEPARATOR);
  return date && id ? { date, id } : null;
};

export const transactionsRouter = router({
  list: protectedProcedure
    // Deliberately a plain object, not `z.strictObject`: the tanstack-react-query
    // integration injects `direction` into the input on every infinite fetch,
    // and a strict schema would reject it.
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
        accountId: z.uuid().optional(),
      }),
    )
    .query(async (opts) => {
      const { user } = opts.ctx;
      const { limit, cursor, accountId } = opts.input;

      const keyset = cursor ? decodeCursor(cursor) : null;

      const rows = await db
        .select({
          id: Transactions.id,
          amount: Transactions.amount,
          isoCurrencyCode: Transactions.isoCurrencyCode,
          date: Transactions.date,
          name: Transactions.name,
          merchantName: Transactions.merchantName,
          category: Transactions.category,
          categoryDetailed: Transactions.categoryDetailed,
          pending: Transactions.pending,
          logoUrl: Transactions.logoUrl,
          bankAccountId: Transactions.bankAccountId,
          accountName: BankAccounts.name,
          accountMask: BankAccounts.mask,
        })
        .from(Transactions)
        .innerJoin(
          BankAccounts,
          eq(BankAccounts.id, Transactions.bankAccountId),
        )
        .where(
          and(
            eq(Transactions.userId, user.id),
            accountId ? eq(Transactions.bankAccountId, accountId) : undefined,
            keyset
              ? // Row-wise comparison, so it rides the (user_id, date desc,
                // id desc) index in a single pass.
                sql`(${Transactions.date}, ${Transactions.id}) < (${keyset.date}::date, ${keyset.id}::uuid)`
              : undefined,
          ),
        )
        .orderBy(desc(Transactions.date), desc(Transactions.id))
        .limit(limit + 1);

      // Fetching one extra row is how we know there's a next page without a count.
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const last = items.at(-1);

      return {
        items,
        // Must be null, never "" — an empty string makes getNextPageParam loop.
        nextCursor: hasMore && last ? encodeCursor(last) : null,
      };
    }),
});
