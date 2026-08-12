import { cn } from "@/lib/utils";
import * as AvatarPrimitive from "@rn-primitives/avatar";
import { Image } from "expo-image";
import { Icon } from "./icon";
import { User } from "lucide-react-native";
import { withUniwind } from "uniwind";

const StyledImage = withUniwind(Image);

function Avatar({
  className,
  ...props
}: AvatarPrimitive.RootProps & React.RefAttributes<AvatarPrimitive.RootRef>) {
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
}: AvatarPrimitive.ImageProps & React.RefAttributes<AvatarPrimitive.ImageRef>) {
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
}: AvatarPrimitive.FallbackProps &
  React.RefAttributes<AvatarPrimitive.FallbackRef>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        "bg-muted flex size-full flex-row items-center justify-center rounded-full",
        className,
      )}
      {...props}
    >
      {children ? (
        children
      ) : (
        <Icon as={User} className="text-muted-foreground" />
      )}
    </AvatarPrimitive.Fallback>
  );
}

export { Avatar, AvatarFallback, AvatarImage };
