import { Icon } from "@/components/ui/icon";
import { usePushNotificationRegistration } from "@/features/notifications/hooks/use-push-notification-registration";
import { Link, Stack } from "expo-router";
import { Landmark } from "lucide-react-native";
import { Pressable } from "react-native";

export default function Layout() {
  usePushNotificationRegistration();

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Transactions",
          headerRight: () => (
            <Link href="/accounts" asChild>
              <Pressable hitSlop={12} accessibilityLabel="Accounts">
                <Icon as={Landmark} />
              </Pressable>
            </Link>
          ),
        }}
      />
      <Stack.Screen name="accounts" options={{ title: "Accounts" }} />
    </Stack>
  );
}
