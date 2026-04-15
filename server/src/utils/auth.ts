import jwt from "jsonwebtoken";
import type { Next } from "koa";
import type { AppContext } from "../types.js";
import { resErr } from "./res.js";
import { BASE_STATE } from "./state.js";
import { JwtUserInfoSchema } from "../schema/index.js";

export const secretKey = "012345abcdefghijklmnopqrstuvwxyz";

export default async function auth(ctx: AppContext, next: Next): Promise<void> {
  const token = ctx.headers.authorization;
  if (!token) {
    resErr(ctx, BASE_STATE.TokenErr);
    return;
  }

  try {
    const decoded = jwt.verify(token, secretKey);
    const result = JwtUserInfoSchema.safeParse(decoded);
    if (!result.success) {
      resErr(ctx, BASE_STATE.TokenErr);
      return;
    }
    ctx.userInfo = result.data;
    await next();
  } catch {
    resErr(ctx, BASE_STATE.TokenErr);
  }
}
