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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";

type LeaveGroupDialogProps = {
  groupId: string;
  groupName: string;
  /** Whatever opens the dialog — rendered as the trigger. */
  children: React.ReactNode;
};

export function LeaveGroupDialog({
  groupId,
  groupName,
  children,
}: LeaveGroupDialogProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);

  const leaveGroup = useMutation(
    trpc.groups.leave.mutationOptions({
      onSuccess: async () => {
        setOpen(false);
        await queryClient.invalidateQueries({
          queryKey: trpc.groups.list.queryKey(),
        });

        // The group is gone from under this screen, so go back to the list.
        router.replace("/");
      },
    }),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        leaveGroup.reset();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave {groupName}?</DialogTitle>
          <DialogDescription>
            You&apos;ll stop seeing this group. Anyone in it can invite you
            back.
          </DialogDescription>
        </DialogHeader>

        {leaveGroup.error && (
          <Text className="text-destructive text-sm">
            {leaveGroup.error.message}
          </Text>
        )}

        <DialogFooter>
          <Button
            variant="destructive"
            disabled={leaveGroup.isPending}
            onPress={() => leaveGroup.mutate({ groupId })}
          >
            {leaveGroup.isPending && <Spinner />}
            <Text>Leave group</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
