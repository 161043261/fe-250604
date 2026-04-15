import { createHash, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { Redis } from "ioredis";
import type { WebSocket } from "ws";
import { resErr, resOk } from "../utils/res.js";
import { USER_STATE, BASE_STATE } from "../utils/state.js";
import db from "../utils/query.js";
import { secretKey } from "../utils/auth.js";
import pub from "../utils/pub.js";
import type { AppContext, UserRecord } from "../types.js";
import {
  LoginSchema,
  LogoutSchema,
  RegisterSchema,
  UpdatePwdSchema,
  UpdateUserInfoSchema,
} from "../schema/index.js";

const redis = new Redis({
  host: "127.0.0.1",
  port: 6379,
});

export async function login(ctx: AppContext): Promise<void> {
  const result = LoginSchema.safeParse(ctx.request.body);
  if (!result.success) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  const { email, password } = result.data;

  try {
    const user = await db<UserRecord>("users").select("*").where("email", email).first();
    if (!user) {
      resErr(ctx, USER_STATE.EmailOrPassErr);
      return;
    }

    // 解盐
    const { id, password: saltedPwd, username, avatar, signature } = user;
    const [salt, encodedPwd] = saltedPwd.split("$");
    const encodedPwd2 = createHash("md5")
      .update(salt + password)
      .digest("hex");
    if (encodedPwd !== encodedPwd2) {
      resErr(ctx, USER_STATE.EmailOrPassErr);
      return;
    }

    // 签发令牌
    const userInfo = { id, email, password: saltedPwd, username, avatar, signature };
    const token = jwt.sign(userInfo, secretKey);
    await Promise.all([
      db("friends").where("email", email).update({ state: "online" }),
      redis.set(`token:${email}`, token, "EX", 60 * 60 * 24),
    ]);

    resOk(ctx, { token, userInfo });
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}

export async function logout(ctx: AppContext): Promise<void> {
  const result = LogoutSchema.safeParse(ctx.request.body);
  if (!result.success) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  const { email } = result.data;

  try {
    await Promise.all([
      db("friends").where("email", email).update({ state: "offline" }),
      redis.del(`token:${email}`),
    ]);
    resOk(ctx);
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}
export async function register(ctx: AppContext): Promise<void> {
  const result = RegisterSchema.safeParse(ctx.request.body);
  if (!result.success) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  const { email, password, avatar } = result.data;

  try {
    const countWrap = await db("users")
      .where("email", email)
      .count<{ count: string | number }>({ count: "*" })
      .first();
    if (Number(countWrap?.count ?? 0) !== 0) {
      resErr(ctx, USER_STATE.UserRegistered);
      return;
    }

    // 加盐
    const salt = randomUUID().toString().replaceAll("-", "");
    const encodedPwd = createHash("md5")
      .update(salt + password)
      .digest("hex");
    const saltedPwd = salt + "$" + encodedPwd;

    const userInfo = {
      email,
      password: saltedPwd,
      username: email,
      avatar,
      signature: "",
    };
    const [id] = await db("users").insert(userInfo);
    await db("tags").insert({ user_id: Number(id), user_email: email, name: "好友" });

    const userInfoWithId = { ...userInfo, id: Number(id) };
    const token = jwt.sign(userInfoWithId, secretKey);
    resOk(ctx, { token, userInfo: userInfoWithId });
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}

export async function updatePwd(ctx: AppContext): Promise<void> {
  const result = UpdatePwdSchema.safeParse(ctx.request.body);
  if (!result.success) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  const { email, password } = result.data;

  try {
    const emailPwd = await db("users")
      .select<{ email: string; password: string }[]>("email", "password")
      .where("email", email)
      .first();
    if (!emailPwd) {
      resErr(ctx, USER_STATE.UserNotRegistered);
      return;
    }
    const salt = emailPwd.password.split("$")[0];
    const encodedPwd = createHash("md5")
      .update(salt + password)
      .digest("hex");
    const saltedPwd = salt + "$" + encodedPwd;
    const affectedRows = await db("users").where("email", email).update({ password: saltedPwd });
    if (affectedRows === 1) {
      resOk(ctx);
    } else {
      resErr(ctx, BASE_STATE.UpdateErr);
    }
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}

export async function updateUserInfo(ctx: AppContext): Promise<void> {
  const result = UpdateUserInfoSchema.safeParse(ctx.request.body);
  if (!result.success) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  const { email, avatar, username, signature } = result.data;

  try {
    const userInfo: Record<string, unknown> = { email, avatar, username, signature };
    const affectedRows = await db("users")
      .where("email", email)
      .update({ avatar, username, signature });
    if (affectedRows !== 1) {
      resErr(ctx, BASE_STATE.UpdateErr);
      return;
    }
    const user = await db<UserRecord>("users").select("*").where("email", email).first();
    if (!user) {
      resErr(ctx, BASE_STATE.UpdateErr);
      return;
    }
    const { id, password: saltedPwd, updated_at } = user;
    userInfo.id = id;
    userInfo.password = saltedPwd;
    userInfo.updatedAt = updated_at;
    const token = jwt.sign(userInfo, secretKey);
    await redis.set(`token:${email}`, token, "EX", 60 * 60 * 24);
    resOk(ctx, { token, userInfo });
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}

export async function wsPub(ws: WebSocket, url: string): Promise<void> {
  const params = new URLSearchParams(url);
  const curEmail = params.get("email");
  if (!curEmail) {
    ws.close();
    return;
  }

  global.__online_users__[curEmail] = {
    ws,
    state: false,
  };

  for (const email in global.__online_users__) {
    if (email === curEmail) {
      continue;
    }
    pub({ receiverEmail: email, type: "wsFetchFriendList" });
  }

  ws.on("close", () => {
    if (global.__online_users__[curEmail]) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete global.__online_users__[curEmail];
      for (const email in global.__online_users__) {
        pub({ receiverEmail: email, type: "wsFetchFriendList" });
      }
    }
  });
}
