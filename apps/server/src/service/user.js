import { createHash, randomUUID } from "node:crypto";
// import { promises as fs } from "node:fs";
import jwt from "jsonwebtoken";
import { Redis } from "ioredis";
import { resErr, resOk } from "../utils/res.js";
import { UserState, BaseState } from "../utils/state.js";
import query from "../utils/query.js";
import { secretKey } from "../utils/auth.js";
import pub from "../utils/pub.js";

// import { fileURLToPath } from "url";
// import { dirname } from "node:path";
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

const redis = new Redis({
  host: "127.0.0.1",
  port: 6379,
});

/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return resErr(res, BaseState.ParamErr);
  }
  // const cachedToken = await redis.get(`token:${email}`);
  // if (cachedToken) {
  //   return resErr(res, UserState.UserLoggedIn);
  // }

  try {
    const userWraps = await query("select * from users where email = ?", [email]);
    if (userWraps.length === 0) {
      return resErr(res, UserState.EmailOrPassErr);
    }

    //! 解盐
    const { id, password: saltedPwd, username, avatar, signature } = userWraps[0];
    const [salt, encodedPwd] = saltedPwd.split("$");
    const encodedPwd2 = createHash("md5")
      .update(salt + password)
      .digest("hex");
    if (encodedPwd !== encodedPwd2) {
      return resErr(res, UserState.EmailOrPassErr);
    }

    //! 签发令牌
    //! id, email, password, username, avatar, signature
    const userInfo = { id, email, password: saltedPwd, username, avatar, signature };
    const token = jwt.sign(userInfo /** payload */, secretKey);
    await Promise.all([
      query("update friends set state = ? where email = ?", ["online", email]),
      redis.set(`token:${email}`, token, "EX", 60 * 60 * 24),
    ]);

    res.userInfo = userInfo;
    return resOk(res, { token, userInfo });
  } catch (err) {
    console.error(err);
    resErr(res, BaseState.ServerErr);
  }
}

/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function logout(req, res) {
  const { email } = req.body;
  if (!email) {
    return resErr(res, BaseState.ParamErr);
  }

  try {
    await Promise.all([
      query("update friends set state = ? where email = ?", ["offline", email]),
      redis.del(`token:${email}`),
    ]);
    return resOk(res);
  } catch (err) {
    console.error(err);
    return resErr(res, BaseState.ServerErr);
  }
}

/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function register(req, res) {
  const { email, password, avatar } = req.body;
  if (!email || !password || !avatar) {
    return resErr(res, BaseState.ParamErr);
  }
  try {
    const countWraps = await query("select count(*) as count from users where email = ?", [email]);
    if (Number.parseInt(countWraps[0].count) !== 0) {
      return resErr(res, UserState.UserRegistered);
    }

    //! 加盐
    const salt = randomUUID().toString().replaceAll("-", "");
    const encodedPwd = createHash("md5")
      .update(salt + password)
      .digest("hex");
    const saltedPwd = salt + "$" + encodedPwd;

    const userInfo = {
      id: 0,
      email,
      password: saltedPwd,
      username: email, // 默认
      avatar,
      signature: "", // 默认
    };
    const { affectedRows } = await query("insert into users set ?", userInfo);
    if (affectedRows !== 1) {
      return resErr(res, BaseState.UpdateErr);
    }

    // 数组解构赋值, 对象解构赋值
    const [{ id }] = await query("select * from users where email = ?", [email]);
    // 默认标签
    await query("insert into tags set ?", [{ user_id: id, user_email: email, name: "好友" }]);

    //! 签发令牌
    userInfo.id = id;
    const token = jwt.sign(userInfo /** payload */, secretKey);
    const data = { token, userInfo };
    return resOk(res, data);
  } catch (err) {
    console.error(err);
    return resErr(res, BaseState.ServerErr);
  }
}

/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function updatePwd(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return resErr(res, BaseState.ParamErr);
  }
  try {
    const emailPwdWraps = await query("select email, password from users where email = ?", [email]);
    if (emailPwdWraps.length === 0) {
      return resErr(res, UserState.UserNotRegistered);
    }
    const salt = emailPwdWraps[0].password.split("$")[0];
    const encodedPwd = createHash("md5")
      .update(salt + password)
      .digest("hex");
    const saltedPwd = salt + "$" + encodedPwd;
    const { affectedRows } = await query("update users set password = ? where email = ?", [
      saltedPwd,
      email,
    ]);
    if (affectedRows === 1) {
      return resOk(res);
    } else {
      return resErr(res, BaseState.UpdateErr);
    }
  } catch (err) {
    console.error(err);
    resErr(res, BaseState.ServerErr);
  }
}

/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function updateUserInfo(req, res) {
  const { email, avatar, username, signature } = req.body;
  if (!email) {
    return resErr(res, BaseState.ParamErr);
  }
  try {
    const userInfo = { email, avatar, username, signature };
    const { affectedRows } = await query("update users set ? where email = ?", [userInfo, email]);
    if (affectedRows !== 1) {
      return resErr(res, BaseState.UpdateErr);
    }
    const userWraps = await query("select * from users where email = ?", [email]);
    const { id, password: saltedPwd, updated_at } = userWraps[0];
    [userInfo.id, userInfo.password, userInfo.updatedAt] = [id, saltedPwd, updated_at];
    const token = jwt.sign(userInfo /** payload */, secretKey);
    await redis.set(`token:${email}`, token, "EX", 60 * 60 * 24);
    return resOk(res, { token, userInfo });
  } catch (err) {
    console.error(err);
    return resErr(err, BaseState.ServerErr);
  }
}

/**
 *
 * @param {any} ws
 * @param {import("express").Request} req
 */
export async function wsPub(ws, req) {
  const url = req.url.split("?")[1];
  const params = new URLSearchParams(url);
  const curEmail = params.get("email");
  global.OnlineUsers[curEmail] = {
    ws,
    state: false, // 用户是否在音视频聊天
  };
  for (const email in global.OnlineUsers) {
    if (email === curEmail) {
      continue;
    }
    pub({ receiverEmail: email, type: "wsFetchFriendList" });
  }
  ws.on("close", () => {
    if (global.OnlineUsers[curEmail]) {
      delete global.OnlineUsers[curEmail];
      for (const email in global.OnlineUsers) {
        pub({ receiverEmail: email, type: "wsFetchFriendList" });
      }
    }
  });
}
