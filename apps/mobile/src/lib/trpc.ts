import { createTRPCContext } from "@trpc/tanstack-react-query";
import { type AppRouter } from "@settle/api";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { authClient } from "./auth-client";
import { env } from "@/env";

export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<AppRouter>();

export function createLinks() {
  return [
    httpBatchLink({
      url: env.EXPO_PUBLIC_API_URL + "/trpc",
      headers() {
        const cookies = authClient.getCookie();
        return cookies ? { Cookie: cookies } : {};
      },
    }),
  ];
}

export const vanillaTrpc = createTRPCClient<AppRouter>({
  links: createLinks(),
});
