import type { WebSocket } from "ws";
import { snack2camel } from "../utils/fmt.js";
import query from "../utils/query.js";
import { BASE_STATE, CODE_2_MSG } from "../utils/state.js";
import { resErr, resOk } from "../utils/res.js";
import type { AppContext, FriendRecord, RtcMessage } from "../types.js";

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
    const sql = `
select *
from friends
where email = ?
  and tag_id in (select id from tags where email = ?);
    `;
    const friendWraps = await query<FriendRecord[]>(sql, [friendEmail, selfEmail]);
    return friendWraps.map((item) => snack2camel(item as unknown as Record<string, unknown>));
  } catch (err) {
    console.error(err);
    throw err;
  }
}

const RtcCmd = {
  CreateRtcRoom: "createRtcRoom",
  AddPeer: "addPeer",
  Offer: "offer",
  Answer: "answer",
  IceCandidate: "iceCandidate",
  Reject: "reject",
} as const;

export async function createRtc(ws: WebSocket, url: string): Promise<void> {
  const params = new URLSearchParams(url);
  const roomKey = params.get("roomKey");
  const email = params.get("email");
  const type = params.get("type");
  if (!roomKey || !email || !type) {
    ws.close();
    return;
  }
  try {
    if (!global.__rtc_rooms__[roomKey]) {
      global.__rtc_rooms__[roomKey] = {};
    }
    global.__rtc_rooms__[roomKey][email] = ws;

    ws.on("message", async (msgStr: string) => {
      const msgObj = JSON.parse(msgStr.toString()) as RtcMessage;
      let { receiverList } = msgObj;
      switch (msgObj.cmd) {
        case RtcCmd.CreateRtcRoom:
          if (!global.__online_users__[email]) {
            ws.send(JSON.stringify({ code: BASE_STATE.Err, msg: "您已离线" }));
            return;
          }
          if (!global.__online_users__[email].state) {
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
            }
          } else if (receiverList) {
            receiverList = receiverList.filter(
              (item) =>
                item.email === email ||
                (item.email !== email &&
                  global.__online_users__[item.email] &&
                  !global.__online_users__[item.email].state),
            );
          }

          if (!receiverList || receiverList.length === 1) {
            ws.send(JSON.stringify({ code: BASE_STATE.Err, msg: "当前没有可以聊天的人" }));
            return;
          }

          global.__online_users__[email].state = true;
          for (let i = 0; i < receiverList.length; i++) {
            const receiverEmail = receiverList[i].email;
            if (receiverEmail === email) {
              continue;
            }
            const newReceiverList = receiverList.filter((item) => item.email !== receiverEmail);
            if (type === "friend") {
              const senderInfo = await findFriendByEmail(email, receiverEmail);
              if (senderInfo.length > 0) {
                newReceiverList.push({
                  email: email,
                  avatar: senderInfo[0].avatar as string,
                  alias: senderInfo[0].noteName as string,
                });
              }
            }
            global.__online_users__[receiverEmail].ws.send(
              JSON.stringify({
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
          delete global.__rtc_rooms__[roomKey][email];
          global.__online_users__[email].state = false;
          break;
      }
    });

    ws.on("close", () => {
      if (global.__rtc_rooms__[roomKey]?.[email]) {
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
  const roomKey = ctx.query.roomKey as string | undefined;
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
