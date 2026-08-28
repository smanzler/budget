import { cn } from "@/lib/utils";
import * as AvatarPrimitive from "@rn-primitives/avatar";
import { Image } from "expo-image";
import { User } from "lucide-react-native";
import { withUniwind } from "uniwind";
import { Icon } from "./icon";

// LOCAL: images render through expo-image for disk caching and a fade-in.
const StyledImage = withUniwind(Image);

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className,
      )}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image asChild {...props}>
      <StyledImage
        className={cn("aspect-square size-full", className)}
        cachePolicy="memory-disk"
        transition={150}
      />
    </AvatarPrimitive.Image>
  );
}

function AvatarFallback({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        "bg-muted flex size-full flex-row items-center justify-center rounded-full",
        className,
      )}
      {...props}
    >
      {/* LOCAL: a person icon when no initials are supplied. */}
      {children ?? <Icon as={User} className="text-muted-foreground" />}
    </AvatarPrimitive.Fallback>
  );
}

export { Avatar, AvatarFallback, AvatarImage };
