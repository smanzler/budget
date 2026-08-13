import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { CountryCode, Products } from "plaid";
import { z } from "zod";
import db from "../../db";
import { PlaidItems } from "../../db/schema";
import { encrypt, decrypt } from "../../lib/crypto";
import { env } from "../../env";
import { plaid } from "../../lib/plaid";
import { enqueuePlaidSync } from "../../lib/plaid-queue";
import { syncItemAccounts, syncItemTransactions } from "../../lib/plaid-sync";
import { protectedProcedure, router } from "../../lib/trpc";

const CLIENT_NAME = "Budget";
const COUNTRY_CODES = [CountryCode.Us];
/** 24 months. Must be requested at Link time — it cannot be raised later. */
const DAYS_REQUESTED = 730;

/** A sync that outruns this keeps going in the background; we just stop waiting. */
const SYNC_NOW_TIMEOUT_MS = 20_000;

/** The mobile client has no transformer, so a `Date` would lie about its type. */
const toIso = (value: Date | null) => value?.toISOString() ?? null;

const ownedItem = async (itemId: string, userId: string) => {
  const item = await db.query.PlaidItems.findFirst({
    where: { id: itemId, userId },
  });

  if (!item)
    throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });

  return item;
};

export const plaidRouter = router({
  /**
   * Mints the short-lived token that Plaid Link opens with. Passing an
   * `itemId` produces an update-mode token — the reconnect path for an item
   * whose credentials expired.
   */
  createLinkToken: protectedProcedure
    .input(
      z.object({
        itemId: z.uuid().optional(),
        // Reserved for OAuth institutions, which need `android_package_name`
        // on Android and a universal-link `redirect_uri` on iOS. Taking it now
        // means the signature does not change when OAuth lands.
        platform: z.enum(["ios", "android"]),
      }),
    )
    .mutation(async (opts) => {
      const { user } = opts.ctx;
      const { itemId } = opts.input;

      const updateFor = itemId ? await ownedItem(itemId, user.id) : null;

      const { data } = await plaid.linkTokenCreate({
        client_name: CLIENT_NAME,
        language: "en",
        country_codes: COUNTRY_CODES,
        user: { client_user_id: user.id },
        ...(env.PLAID_WEBHOOK_URL ? { webhook: env.PLAID_WEBHOOK_URL } : {}),
        ...(updateFor
          ? // Update mode: no `products`, Plaid re-authenticates the existing item.
            { access_token: decrypt(updateFor.accessToken) }
          : {
              products: [Products.Transactions],
              transactions: { days_requested: DAYS_REQUESTED },
            }),
      });

      return { linkToken: data.link_token };
    }),

  /**
   * Trades the device's one-time public token for a permanent access token.
   * The access token is encrypted before it touches the database and is never
   * returned to the client.
   */
  exchangePublicToken: protectedProcedure
    .input(z.object({ publicToken: z.string() }))
    .mutation(async (opts) => {
      const { user } = opts.ctx;

      const { data: exchange } = await plaid.itemPublicTokenExchange({
        public_token: opts.input.publicToken,
      });

      const institution = await fetchInstitution(exchange.access_token);
      const accessToken = encrypt(exchange.access_token);

      const [item] = await db
        .insert(PlaidItems)
        .values({
          userId: user.id,
          plaidItemId: exchange.item_id,
          accessToken,
          status: "syncing",
          ...institution,
        })
        .onConflictDoUpdate({
          target: PlaidItems.plaidItemId,
          set: {
            accessToken,
            status: "syncing",
            ...institution,
          },
          // Scoped to the owner so re-exchanging cannot transfer an item — a
          // double-tap updates your own row and nothing else.
          setWhere: eq(PlaidItems.userId, user.id),
        })
        .returning({ id: PlaidItems.id });

      if (!item) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This bank connection belongs to another account",
        });
      }

      // Accounts first — transactions reference them.
      await syncItemAccounts(item.id);
      await enqueuePlaidSync(item.id);

      return { itemId: item.id };
    }),

  items: router({
    /** Items with their accounts nested, so the screen is one query. */
    list: protectedProcedure.query(async (opts) => {
      const items = await db.query.PlaidItems.findMany({
        where: { userId: opts.ctx.user.id },
        // Explicit columns — `accessToken` must never reach the client.
        columns: {
          id: true,
          institutionName: true,
          institutionLogoUrl: true,
          status: true,
          lastSyncedAt: true,
        },
        with: {
          accounts: {
            columns: {
              id: true,
              name: true,
              officialName: true,
              type: true,
              subtype: true,
              mask: true,
              currentBalance: true,
              availableBalance: true,
              isoCurrencyCode: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      return items.map((item) => ({
        ...item,
        lastSyncedAt: toIso(item.lastSyncedAt),
      }));
    }),

    /** Revokes at Plaid first, then deletes — cascading accounts and transactions. */
    remove: protectedProcedure
      .input(z.object({ itemId: z.uuid() }))
      .mutation(async (opts) => {
        const { user } = opts.ctx;
        const item = await ownedItem(opts.input.itemId, user.id);

        try {
          await plaid.itemRemove({ access_token: decrypt(item.accessToken) });
        } catch (err) {
          // Already gone at Plaid (or unrecoverable) — still drop our copy,
          // otherwise the user is stuck with a row they cannot delete.
          console.error("plaid.itemRemove failed:", err);
        }

        await db
          .delete(PlaidItems)
          .where(
            and(eq(PlaidItems.id, item.id), eq(PlaidItems.userId, user.id)),
          );

        return { itemId: item.id };
      }),
  }),

  /**
   * Awaited on purpose: this backs pull-to-refresh, and a fire-and-forget
   * enqueue would resolve instantly and show the user unchanged data.
   */
  syncNow: protectedProcedure
    .input(z.object({ itemId: z.uuid().optional() }).optional())
    .mutation(async (opts) => {
      const { user } = opts.ctx;
      const itemId = opts.input?.itemId;

      const items = itemId
        ? [await ownedItem(itemId, user.id)]
        : await db.query.PlaidItems.findMany({
            where: { userId: user.id },
            columns: { id: true },
          });

      const totals = { added: 0, modified: 0, removed: 0 };
      let failure: unknown;

      // The catch is attached eagerly: if a sync fails *after* the timeout has
      // already won the race, an unattached rejection would crash the process.
      const work = Promise.all(
        items.map(async (item) => {
          const result = await syncItemTransactions(item.id);
          totals.added += result.added;
          totals.modified += result.modified;
          totals.removed += result.removed;
        }),
      ).catch((err: unknown) => {
        failure = err;
      });

      let timer: NodeJS.Timeout | undefined;
      await Promise.race([
        work,
        new Promise((resolve) => {
          timer = setTimeout(resolve, SYNC_NOW_TIMEOUT_MS);
        }),
      ]);
      clearTimeout(timer);

      if (failure) {
        console.error("syncNow failed:", failure);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Sync failed",
        });
      }

      // On timeout the sync keeps running and its next result lands via the
      // normal query invalidation; the partial totals here are honest.
      return totals;
    }),
});

/** Best-effort branding for the connected institution — never fatal. */
const fetchInstitution = async (accessToken: string) => {
  try {
    const { data: itemData } = await plaid.itemGet({
      access_token: accessToken,
    });

    const institutionId = itemData.item.institution_id;
    if (!institutionId) return {};

    const { data } = await plaid.institutionsGetById({
      institution_id: institutionId,
      country_codes: COUNTRY_CODES,
      options: { include_optional_metadata: true },
    });

    return {
      institutionId,
      institutionName: data.institution.name,
      // Plaid returns a base64 PNG, not a URL. Wrapping it as a data URI keeps
      // the column a single "something an <Image> can render".
      institutionLogoUrl: data.institution.logo
        ? `data:image/png;base64,${data.institution.logo}`
        : null,
    };
  } catch (err) {
    console.error("Failed to fetch institution metadata:", err);
    return {};
  }
};
