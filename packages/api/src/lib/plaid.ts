import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { env } from "../env";

// PlaidEnvironments is declared with an index signature, so the lookup is
// `string | undefined` — narrow it once here rather than asserting.
const basePath = PlaidEnvironments[env.PLAID_ENV];
if (!basePath) throw new Error(`Unknown PLAID_ENV: ${env.PLAID_ENV}`);

export const plaid = new PlaidApi(
  new Configuration({
    basePath,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": env.PLAID_CLIENT_ID,
        "PLAID-SECRET": env.PLAID_SECRET,
      },
    },
  }),
);

/**
 * Plaid errors arrive as axios errors with the useful part buried in
 * `response.data`. Returns the Plaid `error_code` (e.g. `ITEM_LOGIN_REQUIRED`)
 * or null if this wasn't a Plaid API error.
 */
export const plaidErrorCode = (err: unknown): string | null => {
  if (typeof err !== "object" || err === null) return null;

  const data = (err as { response?: { data?: unknown } }).response?.data;
  if (typeof data !== "object" || data === null) return null;

  const code = (data as { error_code?: unknown }).error_code;
  return typeof code === "string" ? code : null;
};
