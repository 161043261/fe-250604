import type { AppContext } from "../types.js";
import { CODE_2_MSG } from "./state.js";

class ResponseBody<T> {
  constructor(
    public code: number,
    public msg: string,
    public data: T,
  ) {}
}

export function response(ctx: AppContext, code: number, data: unknown = "") {
  ctx.body = new ResponseBody(code ?? 200, CODE_2_MSG.get(code) ?? "成功", data ?? "");
}

export function resErr(ctx: AppContext, code: number): void {
  response(ctx, code ?? 400, "");
}

export function resOk(ctx: AppContext, data: unknown = ""): void {
  response(ctx, 200, data ?? "");
}
