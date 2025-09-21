import jwt from "jsonwebtoken";
import { resErr } from "./res.js";
import { BaseState } from "./state.js";
// import crypto from "node:crypto";

// export const secretKey = crypto.randomBytes(16).toString("hex");
export const secretKey = "00000000000000000000000000000000";

/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export default function auth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) {
    return resErr(res, BaseState.TokenErr);
  }

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      return resErr(res, BaseState.TokenErr);
    } else {
      req.userInfo = decoded;
      next();
    }
  });
}
