import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc";
import { useMutation } from "@tanstack/react-query";
import { File, UploadType } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";

const CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;

const contentTypeOf = (mimeType: string | undefined) =>
  CONTENT_TYPES.find((type) => type === mimeType) ?? "image/jpeg";

/**
 * Pick a photo, put it in the bucket, then point the signed-in user's profile
 * at it. Cropping to a square and dropping the quality keeps a camera original
 * from reaching the bucket at full size.
 */
export function useAvatarUpload() {
  const trpc = useTRPC();
  const { refetch: refetchSession } = authClient.useSession();

  const createUpload = useMutation(
    trpc.user.avatar.createUpload.mutationOptions(),
  );
  const setAvatar = useMutation(trpc.user.avatar.set.mutationOptions());

  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickAndUpload = async () => {
    setError(null);

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    const asset = picked.assets?.[0];
    if (picked.canceled || !asset) return;

    // The editor hands back a JPEG on both platforms, so the asset's own type
    // only applies to a build that skips the editor.
    const contentType = contentTypeOf(asset.mimeType);

    setIsUploading(true);
    try {
      const { uploadUrl, key } = await createUpload.mutateAsync({
        contentType,
      });

      // Streaming the file off disk gives the request a Content-Length and
      // sends the signed content type unchanged. A blob body gets neither, and
      // the bucket rejects it.
      const upload = await new File(asset.uri).upload(uploadUrl, {
        httpMethod: "PUT",
        uploadType: UploadType.BINARY_CONTENT,
        headers: { "Content-Type": contentType },
      });

      if (upload.status >= 400) {
        console.error("Avatar upload failed", upload.status, upload.body);
        throw new Error(`The bucket refused the image (${upload.status}).`);
      }

      await setAvatar.mutateAsync({ key });

      // The API wrote the column directly, so pull the session fresh to show it.
      await refetchSession();
    } catch (caught) {
      console.error(caught);
      setError(
        caught instanceof Error
          ? caught.message
          : "Couldn't update your photo. Please try again.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  return { pickAndUpload, isUploading, error };
}
