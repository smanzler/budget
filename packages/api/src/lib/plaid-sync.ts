import { eq, inArray, sql } from "drizzle-orm";
import type { Transaction as PlaidTransaction } from "plaid";
import db from "../db";
import { BankAccounts, PlaidItems, Transactions } from "../db/schema";
import { decrypt } from "./crypto";
import { notify } from "./notify";
import { plaid, plaidErrorCode } from "./plaid";

/** Keeps a single insert well under Postgres' 65535 bound-parameter limit. */
const WRITE_CHUNK = 500;

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
};

/** `excluded.<column>` — the value the failed INSERT tried to write. */
const sqlExcluded = (column: string) => sql`excluded.${sql.identifier(column)}`;

/** Plaid returns JSON numbers; `numeric` columns take strings. */
const toNumeric = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? String(value) : null;

const loadItem = async (itemId: string) => {
  const item = await db.query.PlaidItems.findFirst({
    where: { id: itemId },
  });

  if (!item) throw new Error(`Plaid item not found: ${itemId}`);

  return { item, accessToken: decrypt(item.accessToken) };
};

/**
 * The connection expired. Flag it so the UI can offer a Reconnect button, and
 * tell the user once — `dedupeKey` keeps a retry storm from spamming them.
 */
export const markLoginRequired = async (item: {
  id: string;
  userId: string;
  status: string;
  institutionName: string | null;
}) => {
  if (item.status === "login_required") return;

  await db
    .update(PlaidItems)
    .set({ status: "login_required" })
    .where(eq(PlaidItems.id, item.id));

  await notify({
    userId: item.userId,
    payload: {
      type: "bank_login_required",
      data: { itemId: item.id, institutionName: item.institutionName },
    },
    dedupeKey: `bank_login_required:${item.id}`,
  });
};

/** Upserts the item's accounts and refreshes their balances. */
export const syncItemAccounts = async (itemId: string) => {
  const { item, accessToken } = await loadItem(itemId);

  const { data } = await plaid.accountsGet({ access_token: accessToken });

  if (data.accounts.length === 0) return [];

  const rows = data.accounts.map((account) => ({
    userId: item.userId,
    plaidItemId: item.id,
    plaidAccountId: account.account_id,
    name: account.name,
    officialName: account.official_name,
    type: account.type as string,
    subtype: account.subtype as string | null,
    mask: account.mask,
    currentBalance: toNumeric(account.balances.current),
    availableBalance: toNumeric(account.balances.available),
    isoCurrencyCode: account.balances.iso_currency_code,
  }));

  return db
    .insert(BankAccounts)
    .values(rows)
    .onConflictDoUpdate({
      target: BankAccounts.plaidAccountId,
      set: {
        name: sqlExcluded("name"),
        officialName: sqlExcluded("official_name"),
        type: sqlExcluded("type"),
        subtype: sqlExcluded("subtype"),
        mask: sqlExcluded("mask"),
        currentBalance: sqlExcluded("current_balance"),
        availableBalance: sqlExcluded("available_balance"),
        isoCurrencyCode: sqlExcluded("iso_currency_code"),
        updatedAt: new Date(),
      },
    })
    .returning();
};

/**
 * The single place transactions enter the database.
 *
 * Pulls every page of `/transactions/sync`, then writes the whole delta and the
 * new cursor in one transaction — the cursor only advances once the rows it
 * describes are durable, so a crash mid-sync replays instead of losing data.
 */
export const syncItemTransactions = async (itemId: string) => {
  const { item, accessToken } = await loadItem(itemId);

  const added: PlaidTransaction[] = [];
  const modified: PlaidTransaction[] = [];
  const removed: string[] = [];

  let cursor = item.cursor ?? undefined;
  let hasMore = true;

  try {
    while (hasMore) {
      const { data } = await plaid.transactionsSync({
        access_token: accessToken,
        // Omitted entirely on a first sync — Plaid rejects an explicit null.
        ...(cursor ? { cursor } : {}),
      });

      added.push(...data.added);
      modified.push(...data.modified);
      removed.push(...data.removed.map((r) => r.transaction_id));

      cursor = data.next_cursor;
      hasMore = data.has_more;
    }
  } catch (err) {
    if (plaidErrorCode(err) === "ITEM_LOGIN_REQUIRED") {
      await markLoginRequired(item);
      return { added: 0, modified: 0, removed: 0 };
    }

    await db
      .update(PlaidItems)
      .set({ status: "error" })
      .where(eq(PlaidItems.id, item.id));

    throw err;
  }

  const upserts = [...added, ...modified];
  let accountIds = await accountIdMap(item.id);

  // A new account can appear at the institution between syncs; its transactions
  // arrive before we've ever seen the account, so refresh once and retry.
  if (upserts.some((t) => !accountIds.has(t.account_id))) {
    await syncItemAccounts(item.id);
    accountIds = await accountIdMap(item.id);
  }

  const rows = upserts.flatMap((t) => {
    const bankAccountId = accountIds.get(t.account_id);
    if (!bankAccountId) return []; // account Plaid never returned — skip

    return [
      {
        userId: item.userId,
        bankAccountId,
        plaidTransactionId: t.transaction_id,
        // Verbatim from Plaid: positive means money LEFT the account.
        amount: String(t.amount),
        isoCurrencyCode: t.iso_currency_code,
        date: t.date,
        authorizedDate: t.authorized_date,
        name: t.name,
        merchantName: t.merchant_name ?? null,
        category: t.personal_finance_category?.primary ?? null,
        categoryDetailed: t.personal_finance_category?.detailed ?? null,
        paymentChannel: t.payment_channel as string,
        pending: t.pending,
        logoUrl: t.logo_url ?? null,
      },
    ];
  });

  await db.transaction(async (tx) => {
    for (const batch of chunk(rows, WRITE_CHUNK)) {
      // Upsert, not insert: `modified` is how a pending charge becomes posted,
      // and it must update in place rather than duplicate.
      await tx
        .insert(Transactions)
        .values(batch)
        .onConflictDoUpdate({
          target: Transactions.plaidTransactionId,
          set: {
            bankAccountId: sqlExcluded("bank_account_id"),
            amount: sqlExcluded("amount"),
            isoCurrencyCode: sqlExcluded("iso_currency_code"),
            date: sqlExcluded("date"),
            authorizedDate: sqlExcluded("authorized_date"),
            name: sqlExcluded("name"),
            merchantName: sqlExcluded("merchant_name"),
            category: sqlExcluded("category"),
            categoryDetailed: sqlExcluded("category_detailed"),
            paymentChannel: sqlExcluded("payment_channel"),
            pending: sqlExcluded("pending"),
            logoUrl: sqlExcluded("logo_url"),
            updatedAt: new Date(),
          },
        });
    }

    for (const batch of chunk(removed, WRITE_CHUNK)) {
      await tx
        .delete(Transactions)
        .where(inArray(Transactions.plaidTransactionId, batch));
    }

    await tx
      .update(PlaidItems)
      .set({
        cursor,
        lastSyncedAt: new Date(),
        status: "active",
      })
      .where(eq(PlaidItems.id, item.id));
  });

  return {
    added: added.length,
    modified: modified.length,
    removed: removed.length,
  };
};

const accountIdMap = async (plaidItemId: string) => {
  const accounts = await db
    .select({
      id: BankAccounts.id,
      plaidAccountId: BankAccounts.plaidAccountId,
    })
    .from(BankAccounts)
    .where(eq(BankAccounts.plaidItemId, plaidItemId));

  return new Map(accounts.map((a) => [a.plaidAccountId, a.id]));
};
