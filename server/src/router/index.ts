import Koa from "koa";
import { bodyParser } from "@koa/bodyparser";
import serve from "koa-static";
import mount from "koa-mount";
import createUserRouter from "./user.js";
import createFriendRouter from "./friend.js";
import createGroupRouter from "./group.js";
import createRtcRouter from "./rtc.js";
import createChatRouter from "./chat.js";
import createFileRouter from "./file.js";
import type { AppContext } from "../types.js";
import type { Next } from "koa";

const app = new Koa<unknown, AppContext>();

async function cors(ctx: AppContext, next: Next): Promise<void> {
  ctx.set("Access-Control-Allow-Origin", "*");
  ctx.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  ctx.set("Access-Control-Allow-Credentials", "true");
  ctx.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  ctx.set("Content-Type", "application/json;charset=utf-8");
  // 预检 (pre-flight) 请求
  if (ctx.method.toLowerCase() === "options") {
    ctx.status = 204;
  } else {
    await next();
  }
}

async function staticHandler(ctx: AppContext, next: Next): Promise<void> {
  ctx.set("Access-Control-Allow-Origin", "*");
  ctx.set("Access-Control-Allow-Headers", "*");
  ctx.set("Access-Control-Allow-Credentials", "true");
  ctx.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  ctx.set("Content-Type", "application/octet-stream");
  // 预检 (pre-flight) 请求
  if (ctx.method.toLowerCase() === "options") {
    ctx.status = 204;
  } else {
    await next();
  }
}

// Static file serving for uploads
app.use(async (ctx, next) => {
  if (ctx.path.startsWith("/uploads")) {
    await staticHandler(ctx, next);
  } else {
    await next();
  }
});
app.use(mount("/uploads", serve("uploads")));

// Body parser
app.use(
  bodyParser({
    jsonLimit: "500mb",
    formLimit: "500mb",
  }),
);

// CORS middleware
app.use(cors);

// /api/v1/user/login
// /api/v1/user/logout
// /api/v1/user/register
// /api/v1/user/update-pwd
// /api/v1/user/update-info
const userRouter = createUserRouter();

// /api/v1/friend/email
// /api/v1/friend/add
// /api/v1/friend/list
// /api/v1/friend/id
// /api/v1/friend/tag-list
// /api/v1/friend/add-tag
// /api/v1/friend/update
const friendRouter = createFriendRouter();

// /api/v1/group/list
// /api/v1/group/name
// /api/v1/group/id
// /api/v1/group/create
// /api/v1/group/add-friends
// /api/v1/group/add-self
// /api/v1/group/members
const groupRouter = createGroupRouter();

// /api/v1/rtc/callers
const rtcRouter = createRtcRouter();

// /api/v1/chat/list
const chatRouter = createChatRouter();

// /api/v1/file/verify
// /api/v1/file/upload
// /api/v1/file/merge
const fileRouter = createFileRouter();

app.use(userRouter.prefix("/api/v1/user").routes());
app.use(userRouter.allowedMethods());
app.use(friendRouter.prefix("/api/v1/friend").routes());
app.use(friendRouter.allowedMethods());
app.use(groupRouter.prefix("/api/v1/group").routes());
app.use(groupRouter.allowedMethods());
app.use(rtcRouter.prefix("/api/v1/rtc").routes());
app.use(rtcRouter.allowedMethods());
app.use(chatRouter.prefix("/api/v1/chat").routes());
app.use(chatRouter.allowedMethods());
app.use(fileRouter.prefix("/api/v1/file").routes());
app.use(fileRouter.allowedMethods());

export default app;
