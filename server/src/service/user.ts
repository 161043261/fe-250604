import { createHash, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { Redis } from "ioredis";
import type { WebSocket } from "ws";
import { resErr, resOk } from "../utils/res.js";
import { USER_STATE, BASE_STATE } from "../utils/state.js";
import query from "../utils/query.js";
import { secretKey } from "../utils/auth.js";
import pub from "../utils/pub.js";
import type { AppContext, UserRecord } from "../types.js";

const redis = new Redis({
  host: "127.0.0.1",
  port: 6379,
});

interface LoginRequest {
  email: string;
  password: string;
}

interface LogoutRequest {
  email: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  avatar: string;
}

interface UpdatePwdRequest {
  email: string;
  password: string;
}

interface UpdateUserInfoRequest {
  email: string;
  avatar?: string;
  username?: string;
  signature?: string;
}

export async function login(ctx: AppContext): Promise<void> {
  const { email, password } = ctx.request.body as LoginRequest;
  if (!email || !password) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }

  try {
    const userWraps = await query<UserRecord[]>("select * from users where email = ?", [email]);
    if (userWraps.length === 0) {
      resErr(ctx, USER_STATE.EmailOrPassErr);
      return;
    }

    // 解盐
    const { id, password: saltedPwd, username, avatar, signature } = userWraps[0];
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
      query("update friends set state = ? where email = ?", ["online", email]),
      redis.set(`token:${email}`, token, "EX", 60 * 60 * 24),
    ]);

    resOk(ctx, { token, userInfo });
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}

export async function logout(ctx: AppContext): Promise<void> {
  const { email } = ctx.request.body as LogoutRequest;
  if (!email) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }

  try {
    await Promise.all([
      query("update friends set state = ? where email = ?", ["offline", email]),
      redis.del(`token:${email}`),
    ]);
    resOk(ctx);
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}

export async function register(ctx: AppContext): Promise<void> {
  const { email, password, avatar } = ctx.request.body as RegisterRequest;
  if (!email || !password || !avatar) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  try {
    const countWraps = await query<{ count: number }[]>(
      "select count(*) as count from users where email = ?",
      [email],
    );
    if (Number.parseInt(String(countWraps[0].count)) !== 0) {
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
      id: 0,
      email,
      password: saltedPwd,
      username: email,
      avatar,
      signature: "",
    };
    const result = await query<{ affectedRows: number }>("insert into users set ?", userInfo);
    if (result.affectedRows !== 1) {
      resErr(ctx, BASE_STATE.UpdateErr);
      return;
    }

    const [{ id }] = await query<{ id: number }[]>("select * from users where email = ?", [email]);
    await query("insert into tags set ?", [{ user_id: id, user_email: email, name: "好友" }]);

    userInfo.id = id;
    const token = jwt.sign(userInfo, secretKey);
    resOk(ctx, { token, userInfo });
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}

export async function updatePwd(ctx: AppContext): Promise<void> {
  const { email, password } = ctx.request.body as UpdatePwdRequest;
  if (!email || !password) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  try {
    const emailPwdWraps = await query<{ email: string; password: string }[]>(
      "select email, password from users where email = ?",
      [email],
    );
    if (emailPwdWraps.length === 0) {
      resErr(ctx, USER_STATE.UserNotRegistered);
      return;
    }
    const salt = emailPwdWraps[0].password.split("$")[0];
    const encodedPwd = createHash("md5")
      .update(salt + password)
      .digest("hex");
    const saltedPwd = salt + "$" + encodedPwd;
    const result = await query<{ affectedRows: number }>(
      "update users set password = ? where email = ?",
      [saltedPwd, email],
    );
    if (result.affectedRows === 1) {
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
  const { email, avatar, username, signature } = ctx.request.body as UpdateUserInfoRequest;
  if (!email) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  try {
    const userInfo: Record<string, unknown> = { email, avatar, username, signature };
    const result = await query<{ affectedRows: number }>("update users set ? where email = ?", [
      userInfo,
      email,
    ]);
    if (result.affectedRows !== 1) {
      resErr(ctx, BASE_STATE.UpdateErr);
      return;
    }
    const userWraps = await query<UserRecord[]>("select * from users where email = ?", [email]);
    const { id, password: saltedPwd, updated_at } = userWraps[0];
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
      delete global.__online_users__[curEmail];
      for (const email in global.__online_users__) {
        pub({ receiverEmail: email, type: "wsFetchFriendList" });
      }
    }
  });
}
