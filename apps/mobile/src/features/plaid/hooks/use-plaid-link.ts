import { useTRPC } from "@/lib/trpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Platform } from "react-native";
import {
  createPlaidLinkSession,
  type LinkExit,
  type LinkSuccess,
  type PlaidLinkSession,
} from "react-native-plaid-link-sdk";

type Status = "idle" | "pending" | "error";

/**
 * Wraps the native Link flow.
 *
 * The client never sees an access token: it hands the one-time public token
 * straight back to the API, which does the exchange server-side.
 */
export const usePlaidLink = ({ onLinked }: { onLinked?: () => void } = {}) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // v13 removed `destroy()`, so each open gets a fresh session. Holding it in a
  // ref keeps it from being collected while Link is on screen.
  const sessionRef = useRef<PlaidLinkSession | null>(null);

  const createLinkToken = useMutation(
    trpc.plaid.createLinkToken.mutationOptions(),
  );
  const exchangePublicToken = useMutation(
    trpc.plaid.exchangePublicToken.mutationOptions(),
  );

  const finish = () => {
    sessionRef.current = null;
    setStatus("idle");
  };

  const handleSuccess = async (success: LinkSuccess) => {
    try {
      await exchangePublicToken.mutateAsync({
        publicToken: success.publicToken,
      });

      // pathFilter, not queryFilter: the transaction list is an *infinite*
      // query, and a `type: "query"` filter silently matches nothing.
      await Promise.all([
        queryClient.invalidateQueries(trpc.plaid.pathFilter()),
        queryClient.invalidateQueries(trpc.transactions.list.pathFilter()),
      ]);

      onLinked?.();
      finish();
    } catch (caught) {
      console.error(caught);
      setError("We couldn't finish connecting that account.");
      setStatus("error");
      sessionRef.current = null;
    }
  };

  const handleExit = (exit: LinkExit) => {
    // No error means the user backed out on purpose. Saying anything here is a
    // classic bug — they know what they did.
    if (exit.error) {
      console.error(exit.error);
      setError(exit.error.displayMessage ?? "Something went wrong in Plaid.");
      setStatus("error");
    } else {
      setStatus("idle");
    }

    sessionRef.current = null;
  };

  /** Pass an `itemId` to re-authenticate an existing connection. */
  const open = async (itemId?: string) => {
    setStatus("pending");
    setError(null);

    try {
      // Fetched on press, never prefetched: link tokens are short-lived,
      // single-session, and update mode needs a specific item.
      const { linkToken } = await createLinkToken.mutateAsync({
        ...(itemId ? { itemId } : {}),
        platform: Platform.OS === "android" ? "android" : "ios",
      });

      const session = await createPlaidLinkSession({
        token: linkToken,
        onSuccess: (success) => void handleSuccess(success),
        onExit: handleExit,
        // Required by the type even when we don't need the telemetry.
        onEvent: () => {},
      });

      sessionRef.current = session;

      // Resolves when Link is *presented*, not when it finishes — so status
      // stays pending until onSuccess or onExit fires.
      await session.open();
    } catch (caught) {
      console.error(caught);
      setError("We couldn't open Plaid. Please try again.");
      setStatus("error");
      sessionRef.current = null;
    }
  };

  return {
    open,
    error,
    isPending: status === "pending" || exchangePublicToken.isPending,
  };
};
