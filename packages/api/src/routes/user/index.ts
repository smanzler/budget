import { router } from "../../lib/trpc";
import { userAvatarRouter } from "./avatar";

export const userRouter = router({
  avatar: userAvatarRouter,
});
