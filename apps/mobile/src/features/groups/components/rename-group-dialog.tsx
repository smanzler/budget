import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { useTRPC } from "@/lib/trpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type RenameGroupDialogProps = {
  groupId: string;
  currentName: string;
  /** Whatever opens the dialog — rendered as the trigger. */
  children: React.ReactNode;
};

export function RenameGroupDialog({
  groupId,
  currentName,
  children,
}: RenameGroupDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);

  const renameGroup = useMutation(
    trpc.groups.rename.mutationOptions({
      onSuccess: async () => {
        setOpen(false);
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.groups.get.queryKey({ groupId }),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.groups.list.queryKey(),
          }),
        ]);
      },
    }),
  );

  const trimmedName = name.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Reopening should start from the group's current name, not whatever
        // was half-typed and abandoned last time.
        if (next) setName(currentName);
        renameGroup.reset();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename group</DialogTitle>
        </DialogHeader>

        <Input
          value={name}
          onChangeText={setName}
          autoFocus
          maxLength={60}
          returnKeyType="done"
        />

        {renameGroup.error && (
          <Text className="text-destructive text-sm">
            {renameGroup.error.message}
          </Text>
        )}

        <DialogFooter>
          <Button
            disabled={trimmedName.length === 0 || renameGroup.isPending}
            onPress={() => renameGroup.mutate({ groupId, name: trimmedName })}
          >
            {renameGroup.isPending && <Spinner className="text-secondary" />}
            <Text>Save</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
