import { LoadError, LoadingBlock } from "@/components/query-state";
import { RefetchScroll } from "@/components/refetch-scroll";
import {
  Section,
  SectionDescription,
  SectionHeader,
  SectionTitle,
} from "@/components/section";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { UsersRound } from "lucide-react-native";
import { useState } from "react";
import { InviteSheet } from "../components/invite-sheet";
import { MemberList } from "../components/member-list";
import {
  useHousehold,
  useRemoveMember,
  type Member,
} from "../hooks/use-household";
import { apiErrorMessage, outstandingBalanceRefusal } from "../lib/errors";

export function Household() {
  const household = useHousehold();
  const removeMember = useRemoveMember();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [pending, setPending] = useState<Member | null>(null);
  /** The server's sentence naming what they still owe; set only after it refuses. */
  const [outstanding, setOutstanding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const closeRemove = () => {
    setPending(null);
    setOutstanding(null);
    setError(null);
  };

  const handleRemove = async (writeOffBalance: boolean) => {
    if (!pending) return;

    setError(null);

    try {
      await removeMember.mutateAsync({
        memberId: pending.id,
        ...(writeOffBalance ? { writeOffBalance: true } : {}),
      });

      closeRemove();
    } catch (caught) {
      const refusal = outstandingBalanceRefusal(caught);

      // Not a failure yet — they owe money, so the same removal is offered
      // again with the write-off attached.
      if (refusal) {
        setOutstanding(refusal);
        return;
      }

      console.error(caught);
      setError(apiErrorMessage(caught, "Couldn't remove them. Try again."));
    }
  };

  if (household.isError) {
    return (
      <RefetchScroll
        refetch={household.refetch}
        isEmpty
        empty={
          <LoadError
            title="Couldn't load your household"
            onRetry={() => void household.refetch()}
          />
        }
      />
    );
  }

  return (
    <>
      <RefetchScroll
        refetch={household.refetch}
        isLoading={household.isPending}
        loading={<LoadingBlock />}
        // Nothing about a household is worth showing to someone who is in it
        // alone — the only thing on offer is the person they're missing.
        isEmpty={!household.isShared}
        empty={
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon as={UsersRound} className="text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle>Just you in here</EmptyTitle>
              <EmptyDescription>
                Invite the person you share money with and every account can be
                split between you.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onPress={() => setInviteOpen(true)}>
                <Text>Split with someone</Text>
              </Button>
            </EmptyContent>
          </Empty>
        }
      >
        <Section>
          <SectionHeader>
            <SectionTitle>Members</SectionTitle>
            <SectionDescription>
              Everyone here can see and be assigned a share of shared
              transactions.
            </SectionDescription>
          </SectionHeader>

          <MemberList
            onRemove={(member) => {
              setOutstanding(null);
              setError(null);
              setPending(member);
            }}
            onInvite={() => setInviteOpen(true)}
          />
        </Section>
      </RefetchScroll>

      {/* Outside RefetchScroll, like every other dialog in the app: on iOS
          DialogOverlay wraps itself in a FullWindowOverlay. */}
      <InviteSheet open={inviteOpen} onOpenChange={setInviteOpen} />

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) closeRemove();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {outstanding
                ? `Write off ${pending?.displayName}'s balance?`
                : `Remove ${pending?.displayName}?`}
            </DialogTitle>
            <DialogDescription>
              {outstanding
                ? `${outstanding} Removing them cancels it for good — the ledger keeps the history, but nobody is chasing that money again.`
                : "They lose access to this household. Their share of past transactions stays on the ledger."}
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <Text className="text-destructive text-sm">{error}</Text>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={removeMember.isPending}
              onPress={closeRemove}
            >
              <Text>Cancel</Text>
            </Button>
            <Button
              variant="destructive"
              disabled={removeMember.isPending}
              onPress={() => void handleRemove(outstanding !== null)}
            >
              {removeMember.isPending ? (
                <Spinner className="text-white" />
              ) : null}
              <Text>{outstanding ? "Write off & remove" : "Remove"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
