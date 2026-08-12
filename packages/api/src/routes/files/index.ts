import { protectedProcedure, router } from "../../lib/trpc";
import { createUploadUrl, objectExists, publicUrl } from "../../lib/s3";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

/**
 * Generic direct-to-bucket upload flow:
 *   1. `createUpload` → client PUTs the file to `uploadUrl`
 *   2. `confirmUpload` → API checks the object landed, returns its public URL
 * Persist the returned key on whatever row owns the file (avatar, receipt, …).
 */
export const filesRouter = router({
  createUpload: protectedProcedure
    .input(z.object({ contentType: z.string() }))
    .mutation(async (opts) => {
      const { user } = opts.ctx;
      const { contentType } = opts.input;

      const key = `uploads/${user.id}/${crypto.randomUUID()}`;
      const uploadUrl = await createUploadUrl({ key, contentType });

      return { uploadUrl, key };
    }),

  confirmUpload: protectedProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async (opts) => {
      const { user } = opts.ctx;
      const { key } = opts.input;

      if (!key.startsWith(`uploads/${user.id}/`)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (!(await objectExists(key))) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Upload not found" });
      }

      return { key, url: publicUrl(key) };
    }),
});
