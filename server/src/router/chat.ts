import Router from "@koa/router";
import { findChatList } from "../service/chat.js";
import auth from "../utils/auth.js";
import type { AppContext } from "../types.js";

const router = new Router<unknown, AppContext>();

export default function createChatRouter(): Router<unknown, AppContext> {
  // /api/v1/chat/list
  router.get("/list", auth, findChatList);
  return router;
}
