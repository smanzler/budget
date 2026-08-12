import { useTRPC } from "@/lib/trpc";
import { useMutation } from "@tanstack/react-query";

export const useRegisterPushToken = () => {
  const trpc = useTRPC();
  return useMutation(trpc.notifications.pushTokens.register.mutationOptions());
};
