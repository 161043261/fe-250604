import express from "express";
import { findChatList, connChat } from "../service/chat.js";
import auth from "../utils/auth.js";

const router = express.Router();

export default function createChatRouter() {
  //! /api/v1/chat/list
  router.get("/list", auth, findChatList);
  //! /api/v1/chat/conn
  router.ws("/conn", connChat);
  return router;
}
