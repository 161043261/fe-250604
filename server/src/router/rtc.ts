import Router from "@koa/router";
import { findCurRoomCallers } from "../service/rtc.js";
import auth from "../utils/auth.js";
import type { AppContext } from "../types.js";

const router = new Router<unknown, AppContext>();

export default function createRtcRouter(): Router<unknown, AppContext> {
  // /api/v1/rtc/callers
  router.get("/callers", auth, findCurRoomCallers);
  return router;
}
