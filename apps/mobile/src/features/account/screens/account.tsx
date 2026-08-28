import {
  Section,
  SectionContent,
  SectionItem,
  SectionItemContent,
  SectionItemTitle,
} from "@/components/section";
import { BodyScrollView } from "@/components/ui/body-scroll-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { authClient } from "@/lib/auth-client";

export function Account() {
  const { data: session } = authClient.useSession();

  return (
    <BodyScrollView>
      <Section>
        <SectionContent>
          <SectionItem>
            <SectionItemTitle>Signed in as</SectionItemTitle>
            <SectionItemContent>
              <Text className="text-muted-foreground text-sm">
                {session?.user.email}
              </Text>
            </SectionItemContent>
          </SectionItem>
        </SectionContent>
      </Section>

      <Button variant="outline" onPress={() => authClient.signOut()}>
        <Text>Sign out</Text>
      </Button>
    </BodyScrollView>
  );
}
