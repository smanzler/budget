import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, View } from "react-native";
import { AuthCard } from "../components/auth-card";

export function SignIn() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });

      if (error) {
        throw error;
      }

      router.push({ pathname: "/verify-otp", params: { email } });
    } catch (caught) {
      console.error(caught);
      const { code, status } = caught as { code?: string; status?: number };
      if (code === "INVALID_EMAIL") {
        setError("Please enter a valid email address.");
      } else if (status === 429) {
        setError("Too many attempts. Please wait a moment and try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView className="flex-1">
      <View className="flex-1 flex flex-col justify-center p-6">
        <AuthCard title="Sign in" description="Enter your email to continue">
          <FieldGroup>
            <Field className="gap-1">
              <FieldLabel>Email</FieldLabel>
              <Input
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setError(null);
                }}
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
              />
            </Field>
          </FieldGroup>

          {error && (
            <Text className="text-destructive text-center text-sm">
              {error}
            </Text>
          )}

          <Button onPress={handleSubmit} disabled={submitting || !email}>
            {submitting && <Spinner className="text-secondary" />}
            <Text>Continue</Text>
          </Button>
        </AuthCard>
      </View>
    </KeyboardAvoidingView>
  );
}
