import type { WebSocket } from "ws";
import { snack2camel } from "../utils/fmt.js";
import db from "../utils/query.js";
import { BASE_STATE, CODE_2_MSG } from "../utils/state.js";
import { resErr, resOk } from "../utils/res.js";
import type { AppContext, FriendRecord, RtcMessage } from "../types.js";
import { RtcMessageSchema } from "../schema/index.js";

function broadcast(email: string, roomKey: string, msg: object, needCall: boolean): void {
  for (const userEmail in global.__rtc_rooms__[roomKey]) {
    if (userEmail === email) {
      continue;
    }
    const ws = global.__rtc_rooms__[roomKey][userEmail];
    if (ws) {
      const shouldSend = needCall ? !global.__online_users__[userEmail].state : true;
      if (shouldSend) {
        ws.send(JSON.stringify(msg));
      }
    }
  }
}

async function findFriendByEmail(
  friendEmail: string,
  selfEmail: string,
): Promise<Record<string, unknown>[]> {
  try {
    const friendWraps = await db<FriendRecord>("friends")
      .select("*")
      .where("email", friendEmail)
      .whereIn(
        "tag_id",
        db("tags").select("id").where("user_email", selfEmail),
      );
    return friendWraps.map((item) => snack2camel(item));
  } catch (err) {
    console.error(err);
    throw err;
  }
}

enum RtcCmd {
  CreateRtcRoom = "createRtcRoom",
  AddPeer = "addPeer",
  Offer = "offer",
  Answer = "answer",
  IceCandidate = "iceCandidate",
  Reject = "reject",
}

export async function createRtc(ws: WebSocket, url: string): Promise<void> {
  const params = new URLSearchParams(url);
  const roomKey = params.get("roomKey");
  const email = params.get("email");
  const type = params.get("type");
  if (!roomKey || !email || !type) {
    console.log("[createRtc] Missing params. roomKey:", roomKey, "email:", email, "type:", type);
    ws.close();
    return;
  }
  try {
    if (!global.__rtc_rooms__[roomKey]) {
      global.__rtc_rooms__[roomKey] = {};
    }
    global.__rtc_rooms__[roomKey][email] = ws;

    ws.on("message", async (msgStr: string) => {
      let msgObj: RtcMessage;
      try {
        const parsed = JSON.parse(msgStr.toString());
        const result = RtcMessageSchema.safeParse(parsed);
        if (!result.success) return;
        msgObj = result.data;
      } catch {
        return;
      }
      let { receiverList } = msgObj;
      switch (msgObj.cmd) {
        case RtcCmd.CreateRtcRoom:
          if (!global.__online_users__[email]) {
            ws.send(JSON.stringify({ code: BASE_STATE.Err, msg: "您已离线" }));
            return;
          }
          if (global.__online_users__[email].state) {
            ws.send(JSON.stringify({ code: BASE_STATE.Err, msg: "您正在音视频聊天" }));
            return;
          }
          if (type === "friend" && receiverList) {
            if (!global.__online_users__[receiverList[0].email]) {
              ws.send(JSON.stringify({ code: BASE_STATE.Err, msg: "对方已离线" }));
              return;
            }
            if (global.__online_users__[receiverList[0].email].state) {
              ws.send(JSON.stringify({ code: BASE_STATE.Err, msg: "对方正在音视频聊天" }));
              return;
            }
          } else if (receiverList) {
            receiverList = receiverList.filter(
              (item) =>
                item.email === email ||
                (item.email !== email &&
                  global.__online_users__[item.email] &&
                  !global.__online_users__[item.email].state),
            );

            if (!receiverList || receiverList.length <= 1) {
              ws.send(JSON.stringify({ code: BASE_STATE.Err, msg: "当前没有可以聊天的人" }));
              return;
            }
          }

          if (!receiverList) {
            return;
          }

          global.__online_users__[email].state = true;
          for (const item of receiverList) {
            const receiverEmail = item.email;
            if (receiverEmail === email) {
              continue;
            }
            const newReceiverList = receiverList.filter((item) => item.email !== receiverEmail);
            if (type === "friend") {
              const senderInfo = await findFriendByEmail(email, receiverEmail);
              if (senderInfo.length > 0) {
                newReceiverList.push({
                  email: email,
                  avatar: String(senderInfo[0].avatar),
                  alias: String(senderInfo[0].noteName),
                });
              }
            }
            global.__online_users__[receiverEmail].ws.send(
              JSON.stringify({
                type: "wsCreateRtcRoom",
                cmd: RtcCmd.CreateRtcRoom,
                roomKey,
                mode: msgObj.mode,
                receiverList: newReceiverList,
              }),
            );
          }
          break;

        case RtcCmd.AddPeer:
          global.__online_users__[email].state = true;
          broadcast(email, roomKey, { cmd: RtcCmd.AddPeer, sender: email }, false);
          break;

        case RtcCmd.Offer:
          if (msgObj.receiver && global.__rtc_rooms__[roomKey][msgObj.receiver]) {
            global.__rtc_rooms__[roomKey][msgObj.receiver].send(
              JSON.stringify({
                cmd: RtcCmd.Offer,
                data: msgObj.data,
                sender: email,
              }),
            );
          }
          break;

        case RtcCmd.Answer:
          if (msgObj.receiver && global.__rtc_rooms__[roomKey][msgObj.receiver]) {
            global.__rtc_rooms__[roomKey][msgObj.receiver].send(
              JSON.stringify({
                cmd: RtcCmd.Answer,
                data: msgObj.data,
                sender: email,
              }),
            );
          }
          break;

        case RtcCmd.IceCandidate:
          if (msgObj.receiver && global.__rtc_rooms__[roomKey][msgObj.receiver]) {
            global.__rtc_rooms__[roomKey][msgObj.receiver].send(
              JSON.stringify({
                cmd: RtcCmd.IceCandidate,
                data: msgObj.data,
                sender: email,
              }),
            );
          }
          break;

        default:
          broadcast(
            email,
            roomKey,
            { cmd: RtcCmd.Reject, data: msgObj.data, sender: email },
            false,
          );
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete global.__rtc_rooms__[roomKey][email];
          global.__online_users__[email].state = false;
          break;
      }
    });

    ws.on("close", () => {
      if (global.__rtc_rooms__[roomKey]?.[email]) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete global.__rtc_rooms__[roomKey][email];
        if (global.__online_users__[email]) {
          global.__online_users__[email].state = false;
        }
      }
    });
  } catch (err) {
    console.error(err);
    ws.send(
      JSON.stringify({ code: BASE_STATE.ServerErr, msg: CODE_2_MSG.get(BASE_STATE.ServerErr) }),
    );
    ws.close();
  }
}

export async function findCurRoomCallers(ctx: AppContext): Promise<void> {
  const roomKey = ctx.query.roomKey
    ? typeof ctx.query.roomKey === "string"
      ? ctx.query.roomKey
      : ctx.query.roomKey[0]
    : "";

  if (!roomKey) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  const email = ctx.userInfo?.email;
  const callerList: string[] = [];
  try {
    for (const key in global.__rtc_rooms__[roomKey]) {
      if (key !== email && global.__online_users__[key]?.state) {
        callerList.push(key);
      }
    }
    resOk(ctx, callerList);
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}
