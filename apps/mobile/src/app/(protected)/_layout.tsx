import { usePushNotificationRegistration } from "@/features/notifications/hooks/use-push-notification-registration";
import { Stack } from "expo-router";

export default function Layout() {
  usePushNotificationRegistration();

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Home" }} />
    </Stack>
  );
}
