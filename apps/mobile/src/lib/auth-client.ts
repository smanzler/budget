import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import { emailOTPClient } from "better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";
import { env } from "@/env";

export const authClient = createAuthClient({
  baseURL: env.EXPO_PUBLIC_API_URL,
  plugins: [
    emailOTPClient(),
    expoClient({
      scheme: "com.sigh10.budget",
      storagePrefix: "budget",
      storage: SecureStore,
    }),
  ],
});
