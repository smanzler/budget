import { BodyScrollView } from "@/components/ui/body-scroll-view";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { useTRPC } from "@/lib/trpc";
import { DEFAULT_CURRENCY, type CurrencyCode } from "@budget/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView } from "react-native";
import { CurrencyPicker } from "../components/currency-picker";

export function NewGroup() {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);

  const createGroup = useMutation(
    trpc.groups.create.mutationOptions({
      onSuccess: async (group) => {
        await queryClient.invalidateQueries({
          queryKey: trpc.groups.list.queryKey(),
        });

        router.replace({
          pathname: "/groups/[groupId]",
          params: { groupId: group.id },
        });
      },
    }),
  );

  const trimmedName = name.trim();

  return (
    <KeyboardAvoidingView className="flex-1">
      <BodyScrollView contentContainerClassName="gap-6">
        <FieldGroup>
          <Field className="gap-1">
            <FieldLabel>Group name</FieldLabel>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="Lisbon trip"
              autoFocus
              maxLength={60}
              returnKeyType="done"
            />
          </Field>

          <Field className="gap-2">
            <FieldLabel>Currency</FieldLabel>
            <CurrencyPicker
              value={currency}
              onChange={setCurrency}
              disabled={createGroup.isPending}
            />
            <FieldDescription>
              Every expense in this group is in {currency}. This can&apos;t be
              changed later.
            </FieldDescription>
          </Field>
        </FieldGroup>

        {createGroup.error && (
          <Text className="text-destructive text-sm text-center">
            {createGroup.error.message}
          </Text>
        )}

        <Button
          disabled={trimmedName.length === 0 || createGroup.isPending}
          onPress={() => createGroup.mutate({ name: trimmedName, currency })}
        >
          {createGroup.isPending && <Spinner className="text-secondary" />}
          <Text>Create group</Text>
        </Button>
      </BodyScrollView>
    </KeyboardAvoidingView>
  );
}
