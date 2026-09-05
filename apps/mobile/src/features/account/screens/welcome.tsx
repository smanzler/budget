import { AuthCard } from "@/features/auth/components/auth-card";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { authClient } from "@/lib/auth-client";
import { useState } from "react";
import { KeyboardAvoidingView, View } from "react-native";

/**
 * Sign-in by OTP leaves the name empty, so ask for one before the group list.
 * The layout keeps this screen up until the name lands.
 */
export function Welcome() {
  const { refetch: refetchSession } = authClient.useSession();

  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();

  const handleSubmit = async () => {
    if (!trimmedName) return;

    setSubmitting(true);
    setError(null);
    try {
      const { error } = await authClient.updateUser({ name: trimmedName });

      if (error) throw error;

      await refetchSession();
    } catch (caught) {
      console.error(caught);
      setError("Couldn't save your name. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView className="flex-1">
      <View className="flex-1 flex flex-col justify-center p-6">
        <AuthCard
          title="What should we call you?"
          description="The people you share costs with see this name."
        >
          <FieldGroup>
            <Field className="gap-1">
              <FieldLabel>Name</FieldLabel>
              <Input
                autoFocus
                autoCapitalize="words"
                autoComplete="name"
                maxLength={60}
                returnKeyType="done"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  setError(null);
                }}
                onSubmitEditing={handleSubmit}
              />
            </Field>
          </FieldGroup>

          {error && (
            <Text className="text-destructive text-center text-sm">
              {error}
            </Text>
          )}

          <Button onPress={handleSubmit} disabled={submitting || !trimmedName}>
            {submitting && <Spinner className="text-secondary" />}
            <Text>Continue</Text>
          </Button>
        </AuthCard>
      </View>
    </KeyboardAvoidingView>
  );
}
