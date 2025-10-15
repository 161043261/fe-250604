import { Router } from "express";
import { createRtc, findCurRoomCallers } from "../service/rtc.js";
import auth from "../utils/auth.js";

const router = Router();

export default function createRtcRouter() {
  //! /api/v1/rtc/create
  router.ws("/create", createRtc);
  //! /api/v1/rtc/callers
  router.get("/callers", auth, findCurRoomCallers);
  return router;
}
