import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { UserAvatar } from "@/components/user-avatar";
import { Camera } from "lucide-react-native";
import { TouchableOpacity, View } from "react-native";
import { useAvatarUpload } from "../hooks/use-avatar-upload";

type AvatarPickerProps = {
  name: string;
  image?: string | null;
};

export function AvatarPicker({ name, image }: AvatarPickerProps) {
  const { pickAndUpload, isUploading, error } = useAvatarUpload();

  return (
    <View className="items-center gap-2">
      <TouchableOpacity
        onPress={pickAndUpload}
        disabled={isUploading}
        activeOpacity={0.7}
        accessibilityLabel="Change photo"
      >
        <View className="relative">
          <UserAvatar
            name={name}
            image={image}
            className="size-24"
            textClassName="text-2xl"
          />
          <View className="bg-primary border-background absolute bottom-0 right-0 size-8 items-center justify-center rounded-full border-2">
            {isUploading ? (
              <Spinner className="text-primary-foreground size-4" />
            ) : (
              <Icon as={Camera} className="text-primary-foreground size-4" />
            )}
          </View>
        </View>
      </TouchableOpacity>

      {error && (
        <Text className="text-destructive text-center text-sm">{error}</Text>
      )}
    </View>
  );
}
