import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { useTRPC } from "@/lib/trpc";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Share, View } from "react-native";

type InviteDialogProps = {
  groupId: string;
  groupName: string;
  /** Whatever opens the dialog — rendered as the trigger. */
  children: React.ReactNode;
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
export function InviteDialog({
  groupId,
  groupName,
  children,
}: InviteDialogProps) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);

  const createInvite = useMutation(
    trpc.groups.invites.create.mutationOptions(),
  );

  const invite = createInvite.data;

  function shareCode(code: string) {
    setOpen(false);

    Share.share({
      message: `Join "${groupName}" on settle with the code ${code}`,
    }).catch(() => {});
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // `mutate` puts the state back to pending, so a stale code or error
        // from the last time never shows.
        if (next) createInvite.mutate({ groupId });
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>

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

        {/* Hold the height of the code, so the spinner does not move it. */}
        <View className="h-9 items-center justify-center">
          {invite ? (
            <Text className="text-3xl font-semibold tracking-widest">
              {invite.code}
            </Text>
          ) : (
            !createInvite.error && <Spinner />
          )}
        </View>

        {createInvite.error && (
          <Text className="text-destructive text-center text-sm">
            {createInvite.error.message}
          </Text>
        )}

        <DialogFooter>
          <Button
            disabled={!invite}
            onPress={() => invite && shareCode(invite.code)}
          >
            <Text>Share code</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
