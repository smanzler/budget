import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { useTRPC } from "@/lib/trpc";
import { useMutation } from "@tanstack/react-query";
import { UserPlus } from "lucide-react-native";
import { useState } from "react";
import { Share, View } from "react-native";

type InviteButtonProps = {
  groupId: string;
  groupName: string;
};

function formatExpiry(isoDate: string) {
  return new Date(isoDate).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
}

/**
 * Asks the API for the group's invite code and shows it. The API hands back the
 * group's existing code while it is still usable, so opening this repeatedly
 * doesn't leave a trail of live codes behind.
 */
export function InviteButton({ groupId, groupName }: InviteButtonProps) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);

  const createInvite = useMutation(
    trpc.groups.invites.create.mutationOptions({
      onSuccess: () => setOpen(true),
    }),
  );

  const invite = createInvite.data;

  return (
    <View className="gap-2">
      <Button
        variant="outline"
        disabled={createInvite.isPending}
        onPress={() => createInvite.mutate({ groupId })}
      >
        {createInvite.isPending ? <Spinner /> : <Icon as={UserPlus} />}
        <Text>Invite people</Text>
      </Button>

      {createInvite.error && (
        <Text className="text-destructive text-sm text-center">
          {createInvite.error.message}
        </Text>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite to {groupName}</DialogTitle>
            {invite && (
              <DialogDescription>
                Anyone with this code can join until{" "}
                {formatExpiry(invite.expiresAt)}.
              </DialogDescription>
            )}
          </DialogHeader>

          <Text className="text-center text-3xl font-semibold tracking-widest">
            {invite?.code}
          </Text>

          <DialogFooter>
            <Button
              onPress={() => {
                if (!invite) return;

                // A dismissed share sheet rejects on some platforms.
                Share.share({
                  message: `Join "${groupName}" on budget with the code ${invite.code}`,
                }).catch(() => {});
              }}
            >
              <Text>Share code</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}
