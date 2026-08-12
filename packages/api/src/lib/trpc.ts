import { type CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { initTRPC, TRPCError } from "@trpc/server";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth";

export async function createContext({ req, res }: CreateFastifyContextOptions) {
  const { session, user } =
    (await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    })) ?? {};

  return { req, res, user, session };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use((opts) => {
  const { ctx } = opts;

  if (!ctx.user || !ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return opts.next({
    ctx: {
      user: ctx.user,
      session: ctx.session,
    },
  });
});
