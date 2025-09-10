import { Code2Msg } from "./state.js";

/**
 *
 * @param {import("express").Response} res
 * @param {number} code
 * @param {any} data
 */
export function response(res, code, data) {
  const body = {
    code: 200,
    data: "",
    msg: "",
  };
  body.code = code ?? 200;
  body.data = data ?? "";
  body.msg = Code2Msg.get(body.code) ?? "成功";
  res.json(body);
}

/**
 *
 * @param {import("express").Response} res
 * @param {number} code
 */
export function resErr(res, code) {
  response(res, code ?? 400 /** code */, "" /** data */);
}

/**
 *
 * @param {import("express").Response} res
 * @param {any} data
 */
export function resOk(res, data) {
  response(res, 200 /** code */, data ?? "" /** data */);
}
