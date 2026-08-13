import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { View } from "react-native";
import { usePlaidLink } from "../hooks/use-plaid-link";

/**
 * Opens Plaid Link. Plaid presents its own full-screen native UI, which is why
 * there is no connect *route* anywhere in the app.
 */
export function ConnectBankButton({
  label = "Connect a bank",
  itemId,
  variant = "default",
  onLinked,
}: {
  label?: string;
  /** Set for the reconnect path — mints an update-mode token for this item. */
  itemId?: string;
  variant?: "default" | "outline" | "secondary";
  onLinked?: () => void;
}) {
  const link = usePlaidLink({ ...(onLinked ? { onLinked } : {}) });

  // The default button is dark, the others are light — a fixed spinner color
  // would be invisible on one of them.
  const spinnerClass =
    variant === "default" ? "text-primary-foreground" : "text-foreground";

  return (
    <View className="w-full gap-2">
      <Button
        variant={variant}
        disabled={link.isPending}
        onPress={() => void link.open(itemId)}
      >
        {link.isPending ? <Spinner className={spinnerClass} /> : null}
        <Text>{label}</Text>
      </Button>

      {link.error ? (
        <Text className="text-destructive text-center text-sm">
          {link.error}
        </Text>
      ) : null}
    </View>
  );
}
