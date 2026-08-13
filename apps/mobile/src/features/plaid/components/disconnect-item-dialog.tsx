import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { useRemovePlaidItem } from "../hooks/use-remove-plaid-item";

export function DisconnectItemDialog({
  itemId,
  institutionName,
  open,
  onOpenChange,
}: {
  itemId: string | null;
  institutionName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const remove = useRemovePlaidItem();

  const handleConfirm = async () => {
    if (!itemId) return;

    try {
      await remove.mutateAsync({ itemId });
      onOpenChange(false);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Disconnect {institutionName ?? "this bank"}?
          </DialogTitle>
          <DialogDescription>
            Its accounts and every transaction we&apos;ve synced will be
            removed. You can reconnect at any time.
          </DialogDescription>
        </DialogHeader>

        {remove.isError ? (
          <Text className="text-destructive text-sm">
            Couldn&apos;t disconnect. Please try again.
          </Text>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            disabled={remove.isPending}
            onPress={() => onOpenChange(false)}
          >
            <Text>Cancel</Text>
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onPress={() => void handleConfirm()}
          >
            {remove.isPending ? <Spinner className="text-white" /> : null}
            <Text>Disconnect</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
