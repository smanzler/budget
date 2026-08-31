import { AmountInput } from "@/components/amount-input";
import { BodyScrollView } from "@/components/ui/body-scroll-view";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc";
import { formatAmount } from "@/lib/money";
import { splitEqually } from "@budget/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, View } from "react-native";
import { ParticipantToggles } from "../components/participant-toggles";
import { PayerSelect } from "../components/payer-select";

function splitPreview({
  totalMinor,
  participantIds,
  paidByUserId,
  currency,
  currentUserId,
  members,
}: {
  totalMinor: number;
  participantIds: string[];
  paidByUserId: string;
  currency: string;
  currentUserId?: string;
  members: { id: string; name: string }[];
}) {
  if (totalMinor <= 0 || participantIds.length === 0) return null;

  const shares = splitEqually(totalMinor, participantIds, paidByUserId);
  const amounts = shares.map((share) => share.amountMinor);
  const lowest = Math.min(...amounts);
  const highest = Math.max(...amounts);

  if (lowest === highest) return `${formatAmount(highest, currency)} each`;

  const absorbs = shares.find((share) => share.amountMinor === highest)?.userId;
  const name =
    absorbs === currentUserId
      ? "you"
      : (members.find((member) => member.id === absorbs)?.name ?? "the payer");

  return `${formatAmount(lowest, currency)} each, ${formatAmount(highest, currency)} for ${name}`;
}

export function AddExpense() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user.id;

  const { data: group, error } = useQuery(
    trpc.groups.get.queryOptions({ groupId }),
  );

  const [description, setDescription] = useState("");
  const [totalMinor, setTotalMinor] = useState<number>();
  const [paidByUserId, setPaidByUserId] = useState<string | null>(null);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);

  const createExpense = useMutation(
    trpc.expenses.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.expenses.list.queryKey({ groupId }),
        });

        router.back();
      },
    }),
  );

  if (!group) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        {error ? (
          <Text className="text-destructive text-center text-sm">
            {error.message}
          </Text>
        ) : (
          <Spinner />
        )}
      </View>
    );
  }

  const { members, currency } = group;

  const payer = paidByUserId ?? currentUserId ?? members[0]?.id ?? "";
  const participantIds = members
    .map((member) => member.id)
    .filter((id) => !excludedIds.includes(id));

  const total = totalMinor ?? 0;

  const preview = splitPreview({
    totalMinor: total,
    participantIds,
    paidByUserId: payer,
    currency,
    currentUserId,
    members,
  });
  const trimmedDescription = description.trim();

  const canSubmit =
    trimmedDescription.length > 0 &&
    total > 0 &&
    participantIds.length > 0 &&
    payer.length > 0 &&
    !createExpense.isPending;

  return (
    <KeyboardAvoidingView className="flex-1">
      <BodyScrollView contentContainerClassName="gap-6">
        <FieldGroup>
          <Field className="gap-1">
            <FieldLabel>Description</FieldLabel>
            <Input
              value={description}
              onChangeText={setDescription}
              placeholder="Dinner"
              autoFocus
              maxLength={100}
            />
          </Field>

          <Field className="gap-1">
            <FieldLabel>Amount</FieldLabel>
            <AmountInput
              valueMinor={totalMinor}
              onChangeMinor={setTotalMinor}
              currency={currency}
              accessibilityLabel="Amount"
            />
            {preview && <FieldDescription>{preview}</FieldDescription>}
          </Field>

          <Field className="gap-1">
            <FieldLabel>Paid by</FieldLabel>
            <PayerSelect
              members={members}
              value={payer}
              onChange={setPaidByUserId}
              currentUserId={currentUserId}
              disabled={createExpense.isPending}
            />
          </Field>

          <Field className="gap-2">
            <FieldLabel>Split between</FieldLabel>
            <ParticipantToggles
              members={members}
              selectedIds={participantIds}
              currentUserId={currentUserId}
              onToggle={(userId) =>
                setExcludedIds((excluded) =>
                  excluded.includes(userId)
                    ? excluded.filter((id) => id !== userId)
                    : [...excluded, userId],
                )
              }
              onSelectAll={() => setExcludedIds([])}
            />
            {participantIds.length === 0 && (
              <FieldError>
                Pick at least one person to split this with.
              </FieldError>
            )}
          </Field>
        </FieldGroup>

        {createExpense.error && (
          <Text className="text-destructive text-center text-sm">
            {createExpense.error.message}
          </Text>
        )}

        <Button
          disabled={!canSubmit}
          onPress={() =>
            createExpense.mutate({
              groupId,
              description: trimmedDescription,
              totalMinor: total,
              paidByUserId: payer,
              participantIds,
            })
          }
        >
          {createExpense.isPending && <Spinner className="text-secondary" />}
          <Text>Add expense</Text>
        </Button>
      </BodyScrollView>
    </KeyboardAvoidingView>
  );
}
