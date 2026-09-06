import { HeaderLink } from "@/components/header-link";
import { usePushNotificationRegistration } from "@/features/notifications/hooks/use-push-notification-registration";
import { authClient } from "@/lib/auth-client";
import { Stack } from "expo-router";
import { CircleUserRound, Plus } from "lucide-react-native";

export default function Layout() {
  usePushNotificationRegistration();

  const { data: session } = authClient.useSession();

  // Sign-in by OTP creates the user without a name. Everyone else sees that
  // name, so nothing else opens until it is set.
  const needsName = !session?.user.name.trim();

  return (
    <Stack>
      <Stack.Protected guard={needsName}>
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={!needsName}>
        <Stack.Screen
          name="index"
          options={{
            title: "Groups",
            headerLeft: () => (
              <HeaderLink
                icon={CircleUserRound}
                label="Account"
                href="/account"
              />
            ),
            headerRight: () => (
              <HeaderLink icon={Plus} label="New group" href="/groups/new" />
            ),
          }}
        />
        <Stack.Screen name="account" options={{ title: "Account" }} />
        <Stack.Screen name="groups/new" options={{ title: "New group" }} />
        <Stack.Screen
          name="groups/join"
          options={{
            // A short form, so it comes up as a bottom sheet over the list; the
            // screen draws its own title since the sheet has no header.
            presentation: "formSheet",
            headerShown: false,
            sheetAllowedDetents: [0.5, 0.9],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            sheetExpandsWhenScrolledToEdge: false,
          }}
        />
        {/* Title comes from the group itself once it has loaded. */}
        <Stack.Screen
          name="groups/[groupId]/index"
          options={{ title: "Group" }}
        />
        <Stack.Screen
          name="groups/[groupId]/expenses/new"
          options={{ title: "Add expense" }}
        />
        <Stack.Screen
          name="groups/[groupId]/settle"
          options={{ title: "Record a payment" }}
        />
        <Stack.Screen
          name="groups/[groupId]/settings"
          options={{ title: "Settings" }}
        />
      </Stack.Protected>
    </Stack>
  );
}
