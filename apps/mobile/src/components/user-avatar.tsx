import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { cn, initialsOf } from "@/lib/utils";

type UserAvatarProps = {
  name: string;
  image?: string | null;
  className?: string;
  textClassName?: string;
};

export function UserAvatar({
  name,
  image,
  className,
  textClassName,
}: UserAvatarProps) {
  const initials = initialsOf(name);

  return (
    <Avatar alt={name} className={className}>
      {image ? <AvatarImage source={{ uri: image }} /> : null}
      <AvatarFallback>
        {initials ? (
          <Text className={cn("text-xs", textClassName)}>{initials}</Text>
        ) : undefined}
      </AvatarFallback>
    </Avatar>
  );
}
