import express from "express";
import expressWs from "express-ws";
import bodyParser from "body-parser";
import createUserRouter from "./user.js";
import createFriendRouter from "./friend.js";
import createGroupRouter from "./group.js";
import createRtcRouter from "./rtc.js";
import createChatRouter from "./chat.js";
import createFileRouter from "./file.js";

const app = express();
expressWs(app);

/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
function cors(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", ["GET", "POST", "PUT", "DELETE", "OPTIONS"]);
  res.header("Content-Type", "application/json;charset=utf-8");
  // 预检 (pre-flight) 请求
  if (req.method.toLowerCase() === "options") {
    res.sendStatus(204);
  } else {
    next();
  }
}

/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
function staticHandler(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Credentials", true);
  res.header("Access-Control-Allow-Methods", ["GET", "POST", "PUT", "DELETE", "OPTIONS"]);
  res.header("Content-Type", "application/octet-stream");
  // 预检 (pre-flight) 请求
  if (req.method.toLowerCase() === "options") {
    res.sendStatus(204);
  } else {
    next();
  }
}

app.use("/uploads", staticHandler, express.static("uploads"));

app.use(bodyParser.json({ limit: "100mb" }));
app.use(bodyParser.urlencoded({ limit: "100mb", extended: true }));

//! /api/v1/user/login
//! /api/v1/user/logout
//! /api/v1/user/register
//! /api/v1/user/update-pwd
//! /api/v1/user/update-info
//! /api/v1/user/pub
const userRouter = createUserRouter();

//! /api/v1/friend/email
//! /api/v1/friend/add
//! /api/v1/friend/list
//! /api/v1/friend/id
//! /api/v1/friend/tag-list
//! /api/v1/friend/add-tag
//! /api/v1/friend/update
const friendRouter = createFriendRouter();

//! /api/v1/group/list
//! /api/v1/group/name
//! /api/v1/group/id
//! /api/v1/group/create
//! /api/v1/group/add-friends
//! /api/v1/group/add-self
//! /api/v1/group/members
const groupRouter = createGroupRouter();

//! /api/v1/rtc/create
//! /api/v1/rtc/callers
const rtcRouter = createRtcRouter();

//! /api/v1/chat/list
//! /api/v1/chat/conn
const chatRouter = createChatRouter();

//! /api/v1/file/verify
//! /api/v1/file/upload
//! /api/v1/file/merge
const fileRouter = createFileRouter();

app.use("", cors);
app.use("/api/v1/user", cors, userRouter);
app.use("/api/v1/friend", cors, friendRouter);
app.use("/api/v1/group", cors, groupRouter);
app.use("/api/v1/rtc", cors, rtcRouter);
app.use("/api/v1/chat", cors, chatRouter);
app.use("/api/v1/file", cors, fileRouter);

export default app;
