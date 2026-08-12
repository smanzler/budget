import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { authClient } from "@/lib/auth-client";
import { View } from "react-native";

export default function Home() {
  const { data: session } = authClient.useSession();

  return (
    <View className="flex-1 items-center justify-center gap-4 p-6">
      <Text className="text-muted-foreground">
        Signed in as {session?.user.email}
      </Text>
      <Button variant="outline" onPress={() => authClient.signOut()}>
        <Text>Sign out</Text>
      </Button>
    </View>
  );
}
