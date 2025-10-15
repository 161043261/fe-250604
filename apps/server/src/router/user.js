import { Router } from "express";
import { login, logout, register, wsPub, updatePwd, updateUserInfo } from "../service/user.js";

const router = Router();

export default function createUserRouter() {
  //! /api/v1/user/login
  router.post("/login", login);
  //! /api/v1/user/logout
  router.post("/logout", logout);
  //! /api/v1/user/register
  router.post("/register", register);
  //! /api/v1/user/update-pwd
  router.post("/update-pwd", updatePwd);
  //! /api/v1/user/update-info
  router.post("/update-info", updateUserInfo);
  //! /api/v1/user/pub
  router.ws("/pub", wsPub);
  return router;
}
