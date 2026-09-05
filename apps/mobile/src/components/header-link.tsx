import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "expo-router";
import type { Href } from "expo-router";
import type { LucideIcon } from "lucide-react-native";

export function HeaderLink({
  icon,
  label,
  href,
}: {
  icon: LucideIcon;
  label: string;
  href: Href;
}) {
  return (
    <Link href={href} asChild>
      <Button variant="ghost" size="icon" accessibilityLabel={label}>
        <Icon as={icon} />
      </Button>
    </Link>
  );
}
