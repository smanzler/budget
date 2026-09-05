import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import db from "../../../db/index";
import { users } from "../../../db/schema";
import { env } from "../../../env";
import {
  createUploadUrl,
  deleteObject,
  objectSize,
  publicUrl,
} from "../../../lib/s3";
import { protectedProcedure, router } from "../../../lib/trpc";

const IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const avatarPrefix = (userId: string) => `avatars/${userId}/`;

export const userAvatarRouter = router({
  /**
   * Step one: the client PUTs the image to `uploadUrl`, then hands `key` back
   * to `set`. The bytes never pass through the API.
   */
  createUpload: protectedProcedure
    .input(z.object({ contentType: z.enum(IMAGE_CONTENT_TYPES) }))
    .mutation(async (opts) => {
      const { user } = opts.ctx;

      const key = `${avatarPrefix(user.id)}${crypto.randomUUID()}`;
      const uploadUrl = await createUploadUrl({
        key,
        contentType: opts.input.contentType,
      });

      return { uploadUrl, key };
    }),

  /** Step two: point the profile at the uploaded image. */
  set: protectedProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async (opts) => {
      const { user } = opts.ctx;
      const { key } = opts.input;

      if (!key.startsWith(avatarPrefix(user.id))) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const size = await objectSize(key);

      if (size === undefined) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Upload not found" });
      }

      // The presigned URL cannot cap the body, so an oversized upload is only
      // caught here. Take it back out of the bucket before rejecting it.
      if (size > MAX_AVATAR_BYTES) {
        await deleteObject(key);
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "That image is too large. The limit is 5 MB.",
        });
      }

      const image = publicUrl(key);

      // Read before the write: an UPDATE ... RETURNING hands back the new row.
      const [previous] = await db
        .select({ image: users.image })
        .from(users)
        .where(eq(users.id, user.id));

      await db.update(users).set({ image }).where(eq(users.id, user.id));

      const previousKey = previous?.image?.slice(`${env.BUCKET_URL}/`.length);

      // Only a replaced avatar of our own, so an image set from anywhere else
      // stays where it is.
      if (previousKey?.startsWith(avatarPrefix(user.id))) {
        await deleteObject(previousKey);
      }

      return { image };
    }),
});
