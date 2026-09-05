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
import { authClient } from "@/lib/auth-client";
import { useState } from "react";

type EditNameDialogProps = {
  currentName: string;
  /** Whatever opens the dialog — rendered as the trigger. */
  children: React.ReactNode;
};

export function EditNameDialog({ currentName, children }: EditNameDialogProps) {
  const { refetch: refetchSession } = authClient.useSession();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const { error } = await authClient.updateUser({ name: trimmedName });

      if (error) throw error;

      await refetchSession();
      setOpen(false);
    } catch (caught) {
      console.error(caught);
      setError("Couldn't save your name. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Reopening should start from the saved name, not whatever was
        // half-typed and abandoned last time.
        if (next) setName(currentName);
        setError(null);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your name</DialogTitle>
        </DialogHeader>

        <Input
          value={name}
          onChangeText={setName}
          autoFocus
          autoCapitalize="words"
          autoComplete="name"
          maxLength={60}
          returnKeyType="done"
        />

        {error && <Text className="text-destructive text-sm">{error}</Text>}

        <DialogFooter>
          <Button
            disabled={trimmedName.length === 0 || saving}
            onPress={handleSave}
          >
            {saving && <Spinner className="text-secondary" />}
            <Text>Save</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
