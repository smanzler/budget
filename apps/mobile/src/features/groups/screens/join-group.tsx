import { BodyScrollView } from "@/components/ui/body-scroll-view";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { OtpInput } from "@/components/otp-input";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { useTRPC } from "@/lib/trpc";
import { INVITE_CODE_LENGTH } from "@budget/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView } from "react-native";

export function JoinGroup() {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [code, setCode] = useState("");

  const joinGroup = useMutation(
    trpc.groups.join.mutationOptions({
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

  return (
    <KeyboardAvoidingView className="flex-1">
      <BodyScrollView contentContainerClassName="gap-6">
        <Text variant="h4">Join a group</Text>

        <FieldGroup>
          <Field className="gap-2">
            <FieldLabel>Invite code</FieldLabel>
            <OtpInput
              numberOfDigits={INVITE_CODE_LENGTH}
              // Invite codes are base32, not digits.
              type="alphanumeric"
              autoFocus
              textInputProps={{ autoCapitalize: "characters" }}
              onTextChange={(text) => {
                setCode(text);
                joinGroup.reset();
              }}
              onFilled={(text) => joinGroup.mutate({ code: text })}
            />
            <FieldDescription>
              Ask someone in the group to share their invite code with you.
            </FieldDescription>
          </Field>
        </FieldGroup>

        {joinGroup.error && (
          <Text className="text-destructive text-sm text-center">
            {joinGroup.error.message}
          </Text>
        )}

        <Button
          disabled={code.length < INVITE_CODE_LENGTH || joinGroup.isPending}
          onPress={() => joinGroup.mutate({ code })}
        >
          {joinGroup.isPending && <Spinner className="text-secondary" />}
          <Text>Join group</Text>
        </Button>
      </BodyScrollView>
    </KeyboardAvoidingView>
  );
}
