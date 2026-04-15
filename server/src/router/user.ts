import Router from "@koa/router";
import { login, logout, register, updatePwd, updateUserInfo } from "../service/user.js";
import type { AppContext } from "../types.js";

const router = new Router<unknown, AppContext>();

export default function createUserRouter(): Router<unknown, AppContext> {
  // /api/v1/user/login
  router.post("/login", login);
  // /api/v1/user/logout
  router.post("/logout", logout);
  // /api/v1/user/register
  router.post("/register", register);
  // /api/v1/user/update-pwd
  router.post("/update-pwd", updatePwd);
  // /api/v1/user/update-info
  router.post("/update-info", updateUserInfo);
  return router;
}
