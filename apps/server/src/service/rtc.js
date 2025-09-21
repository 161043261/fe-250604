import { snack2camel } from "../utils/fmt.js";
import query from "../utils/query.js";
import { BaseState, Code2Msg } from "../utils/state.js";
import { resErr, resOk } from "../utils/res.js";

/**
 *
 * @param {string} email
 * @param {string} roomKey
 * @param {any} msg
 * @param {boolean} needCall
 */
function broadcast(email, roomKey, msg, needCall) {
  for (const userEmail in global.RtcRooms[roomKey]) {
    if (userEmail === email) {
      continue;
    }
    const ws = global.RtcRooms[roomKey][userEmail];
    if (ws) {
      const shouldSend = needCall ? !global.OnlineUsers[userEmail].state : true;
      if (shouldSend) {
        ws.send(JSON.stringify(msg));
      }
    }
  }
}

/**
 *
 * @param {string} friendEmail
 * @param {string} selfEmail
 */
async function findFriendByEmail(friendEmail, selfEmail) {
  try {
    const sql = `
select *
from friends
where email = ?
  and tag_id in (select id from tags where email = ?);
    `;
    const friendWraps = await query(sql, [friendEmail, selfEmail]);
    return friendWraps.map((item) => snack2camel(item));
  } catch (err) {
    console.error(err);
    throw err;
  }
}

//! SDP, Session Description Protocol
//! ICE, Interactive Connectivity Establishment
//! sender ---------- offer  ----------> receiver
//! sender <--------- answer ----------- receiver

const RtcCmd = {
  CreateRtcRoom: "createRtcRoom",
  AddPeer: "addPeer",
  Offer: "offer",
  Answer: "answer",
  IceCandidate: "iceCandidate",
  Reject: "reject",
};

/**
 *
 * @param {any} ws
 * @param {import("express").Request} req
 */
export async function createRtc(ws, req) {
  const url = req.url.split("?")[1];
  const params = new URLSearchParams(url);
  const roomKey = params.get("roomKey");
  const email = params.get("email");
  const type = params.get("type");
  if (!roomKey || !!email || !type) {
    ws.close();
    return;
  }
  try {
    if (!global.RtcRooms[roomKey]) {
      global.RtcRooms[roomKey] = {};
    }
    global.RtcRooms[roomKey][email] = ws;
    ws.on("message", async (msgStr) => {
      /**
       *
       * @type {{ cmd: 'createRtcRoom' | 'addPeer' | 'offer' | 'answer' | 'iceCandidate', mode?: 'friendAudio' | 'friendVideo' | 'groupAudio' | 'groupVideo', data?: any, receiver?: any, receiverList?: any[] }}
       */
      const msgObj = JSON.parse(msgStr);
      let { receiverList /** cmd, mode, data, receiver */ } = msgObj;
      switch (msgObj.cmd) {
        case RtcCmd.CreateRtcRoom:
          if (!global.OnlineUsers[email]) {
            ws.send(JSON.stringify({ code: BaseState.Err, msg: "您已离线" }));
            return;
          }
          if (!global.OnlineUsers[email].state) {
            ws.send(JSON.stringify({ code: BaseState.Err, msg: "您正在音视频聊天" }));
            return;
          }
          if (type === "friend") {
            if (!global.OnlineUsers[receiverList[0].email]) {
              ws.send(JSON.stringify({ code: BaseState.Err, msg: "对方已离线" }));
              return;
            }
            if (global.OnlineUsers[receiverList[0].email].state) {
              ws.send(JSON.stringify({ code: BaseState.Err, msg: "对方正在音视频聊天" }));
            }
          } else {
            // type === 'group'
            receiverList = receiverList.filter(
              (item) =>
                item.email === email ||
                (item.email !== email &&
                  global.OnlineUsers[item.email] &&
                  !global.OnlineUsers[item.email].state),
            );
          }

          if (receiverList.length === 1) {
            ws.send(JSON.stringify({ code: BaseState.Err, msg: "当前没有可以聊天的人" }));
            return;
          }

          global.OnlineUsers[email].state = true;
          for (let i = 0; i < receiverList.length; i++) {
            const receiverEmail = receiverList[i].email;
            if (receiverEmail === email) {
              continue;
            }
            const newReceiverList = receiverList.filter((item) => item.email !== receiverEmail);
            if (type === "friend") {
              const senderInfo = await findFriendByEmail(
                email /** sender's email */,
                receiverEmail /** receiver's email */,
              );
              newReceiverList.push({
                email: email, // sender's email,
                avatar: senderInfo.avatar,
                alias: senderInfo.noteName,
              });
            }
            global.OnlineUsers[receiverEmail].ws.send(
              JSON.stringify({
                cmd: RtcCmd.CreateRtcRoom,
                // todo: roomKey
                roomKey,
                mode: msgObj.mode,
                receiverList: newReceiverList,
              }),
            );
          }
          break;

        case RtcCmd.AddPeer:
          global.OnlineUsers[email].state = true;
          // todo: sender
          broadcast(email, roomKey, { cmd: RtcCmd.AddPeer, sender: email });
          break;

        case RtcCmd.Offer:
          global.RtcRooms[roomKey][msgObj.receiver].send(
            JSON.stringify({
              cmd: RtcCmd.Offer,
              data: msgObj.data,
              sender: email,
            }),
          );
          break;

        case RtcCmd.Answer:
          global.RtcRooms[roomKey][msgObj.receiver].send(
            JSON.stringify({
              cmd: RtcCmd.Answer,
              data: msgObj.data,
              sender: email,
            }),
          );
          break;

        case RtcCmd.IceCandidate:
          global.RtcRooms[roomKey][msgObj.receiver].send(
            JSON.stringify({
              cmd: RtcCmd.IceCandidate,
              data: msgObj.data,
              sender: email,
            }),
          );
          break;

        default: // case RtcCmd.Reject:
          broadcast(email, roomKey, { cmd: RtcCmd.Reject, data: msgObj.data, sender: email });
          delete global.RtcRooms[roomKey][email];
          global.OnlineUsers[email].state = false;
          break;
      }
    });

    ws.on("close", () => {
      if (global.RtcRooms[roomKey][email]) {
        delete global.RtcRooms[roomKey][email];
        global.OnlineUsers[email].state = false;
      }
    });
  } catch (err) {
    console.error(err);
    ws.send({ code: BaseState.ServerErr, msg: Code2Msg[BaseState.ServerErr] });
    ws.close();
  }
}

/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function findCurRoomCallers(req, res) {
  const url = req.url.split("?")[1];
  const params = new URLSearchParams(url);
  const roomKey = params.get("roomKey");
  if (!roomKey) {
    return resErr(res, BaseState.ParamErr);
  }
  const { email } = req.user;
  const callerList = [];
  try {
    for (const key in global.RtcRooms[roomKey]) {
      if (!key === email && global.OnlineUsers[roomKey].state) {
        callerList.push(key);
      }
    }
    return resOk(res, callerList);
  } catch (err) {
    console.error(err);
    return resErr(res, BaseState.ServerErr);
  }
}
