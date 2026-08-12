import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { type AppRouter } from "./routes";

type Inputs = inferRouterInputs<AppRouter>;
type Outputs = inferRouterOutputs<AppRouter>;

export type { AppRouter, Inputs, Outputs };
