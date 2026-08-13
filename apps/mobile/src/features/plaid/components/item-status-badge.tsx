import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import type { RouterOutputs } from "@/lib/trpc";

type Status = RouterOutputs["plaid"]["items"]["list"][number]["status"];

const LABELS: Record<
  Status,
  { text: string; variant: "secondary" | "destructive" }
> = {
  syncing: { text: "Syncing", variant: "secondary" },
  active: { text: "Connected", variant: "secondary" },
  login_required: { text: "Reconnect needed", variant: "destructive" },
  error: { text: "Error", variant: "destructive" },
};

export function ItemStatusBadge({ status }: { status: Status }) {
  const { text, variant } = LABELS[status];

  return (
    <Badge variant={variant}>
      <Text>{text}</Text>
    </Badge>
  );
}
