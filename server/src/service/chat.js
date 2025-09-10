import { camel2snake, fmtBytes, snack2camel } from "../utils/fmt.js";
import pub from "../utils/pub.js";
import query from "../utils/query.js";
import { BaseState } from "../utils/state.js";
import { resOk, resErr } from "../utils/res.js";

/**
 *
 * @param {string} roomKey
 */
async function updateMsgStats(roomKey) {
  const msgStatWraps = await query("select * from msg_stats where room_key = ?", [roomKey]);
  if (msgStatWraps.length === 0) {
    await query("insert into msg_stats set ?", { room_key: roomKey, total: 0 });
  }
  await query("update msg_stats set total = total + 1 where room_key = ?", [roomKey]);
}

// todo: Specify typeof writeMsg, typeof sendMsg
/**
 *
 * @param {'friend' | 'group'} type
 * @param {string} roomKey
 * @param {any} writeMsg The message to be written to the database
 * @param {any} sendMsg The messages to be sent to the receiver
 */
async function writeAndSend(type, roomKey, writeMsg, sendMsg) {
  if (type === "group" || (type === "friend" && global.ChatRooms[roomKey][sendMsg.receiverId])) {
    writeMsg.state = 1;
  } else {
    writeMsg.state = 0;
  }
  await Promise.all([
    query("insert into messages set ?", camel2snake(writeMsg)),
    updateMsgStats(roomKey),
  ]);
  sendMsg.createdAt = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  sendMsg.fileSize = fmtBytes(writeMsg.fileSize);
  for (const receiverId /** userId | groupId */ in global.ChatRooms[roomKey]) {
    global.ChatRooms[roomKey][receiverId].send(JSON.stringify(sendMsg));
  }
  if (type === "group") {
    const userIdWraps = await query("select user_id from group_members where group_id = ?", [
      sendMsg.receiverId,
    ]);
    for (const item of userIdWraps) {
      if (item.user_id !== sendMsg.senderId) {
        pub({ receiverId: item.user_id, type: "wsFetchChatList" });
      }
    }
  } else {
    pub({ receiverId: sendMsg.receiverId, type: "wsFetchChatList" });
  }
}

/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function findChatList(req, res) {
  try {
    /**
     * @type {{ receiverId: number, name: string, receiverEmail: string, roomKey: string, updatedAt: string, unreadCnt: number, latestMsg: string, mediaType: 'text' | 'image' | 'video' | 'file', avatar: string }[]}
     */
    const data = [];
    const userId = req.userInfo.id;
    const sql = `
select user_id as receiver_id, note_name as name, email as receiver_email, f.room_key, msg_stats.updated_at
from friends as f,
     (select id from tags where user_id = ?) as t,
     msg_stats
where t.id = f.tag_id
  and f.room_key = msg_stats.room_key
order by msg_stats.updated_at desc;
    `;
    /**
     * @type {({ receiver_id: number, name: string, receiver_email: string, room_key: string, updated_at: string } & { unread_cnt: number, latest_msg: string, media_type: 'text' | 'image' | 'video' | 'file', avatar: string })[]}
     */
    const results = await query(sql, [userId]);
    for (const item of results) {
      const unreadCntSql = `
select count(*) as unread_cnt
from messages
where room_key = ?
  and receiver_id = ?
  and state = 0;
      `;
      /** @type {{ unread_cnt: number }[]} */
      const unreadCntWraps = await query(unreadCntSql, [item.room_key, userId]);
      item["unread_cnt"] = unreadCntWraps[0].unread_cnt;
      const sql2 = `
select content as latest_msg, media_type
from messages
where room_key = ?
order by created_at desc
limit 1;
      `;
      /** @type {{ latest_msg: string, media_type: 'text' | 'image' | 'video' | 'file' }[]} */
      const results2 = await query(sql2, [item.room_key]);
      // 补充字段 latest_msg, media_type, avatar
      item["latest_msg"] = results2[0].latest_msg;
      item["media_type"] = results2[0].media_type;
      /** @type {{ avatar: string }[]} */
      const avatarWraps = await query("select avatar from users where id = ?", [item.receiver_id]);
      item["avatar"] = avatarWraps[0].avatar;
    }
    if (results) {
      data.push(...results.map((item) => snack2camel(item)));
    }
    const sql3 = `
select g.id as receiver_id, avatar, name, g.room_key, msg_stats.updated_at
from \`groups\` as g,
     (select * from group_members where user_id = ?) as gm,
     msg_stats
where g.id = gm.group_id
  and g.room_key = msg_stats.room_key
order by msg_stats.updated_at desc;
    `;
    /**
     * @type {({ receiver_id: number, avatar: string, name: string, room_key: string, updated_at: string } & { unread_cnt: number, latest_msg: string, media_type: 'text' | 'image' | 'video' | 'file', avatar: string  })[]}
     */
    const results3 = await query(sql3, [userId]);
    for (const item3 of results3) {
      item3["unread_cnt"] = 0;
      const sql4 = `
select content as latest_msg, media_type
from messages
where room_key = ?
order by created_at desc
limit 1;
      `;
      const result4 = await query(sql4, [item3.room_key]);
      item3["latest_msg"] = result4[0].latest_msg;
      item3["media_type"] = result4[0].media_type;
      // item["avatar"] = "";
    }
    if (results3) {
      data.push(...results3.map((item) => snack2camel(item)));
    }

    data.sort((a, b) => {
      const ta = new Date(a.updatedAt).getTime();
      const tb = new Date(b.updatedAt).getTime();
      return tb - ta;
    });
    return resOk(res, data);
  } catch (err) {
    console.error(err);
    return resErr(res, BaseState.ServerErr);
  }
}

/**
 *
 * @param {any} ws WebSocket
 * @param {import("express").Request} req
 */
export async function connChat(ws, req) {
  const url = req.url.split("?")[1];
  const params = new URLSearchParams(url);
  const roomKey = params.get("roomKey");
  const id = params.get("id");
  const type = params.get("type");
  if (!roomKey || !id || !type) {
    ws.close();
    return;
  }
  try {
    if (!global.ChatRooms[roomKey]) {
      global.ChatRooms[roomKey] = {};
    }
    global.ChatRooms[roomKey][id] = ws;
    let rawHistoryMsgList = [];
    if (type === "group") {
      const sql = `
select gm.nickname, m.*, u.avatar
from (select sender_id, receiver_id, content, room_key, media_type, file_size, messages.created_at
      from messages
      where room_key = ?
        and type = 'group') as m
       left join users as u on u.id = m.sender_id
       left join group_members as gm on gm.group_id = ? and user_id = u.id
order by created_at;
      `;
      rawHistoryMsgList = await query(sql, [roomKey, id]);
    } else {
      const sql = `
select m.*, u.avatar
from (select sender_id, receiver_id, content, room_key, media_type, file_size, messages.created_at
      from messages
      where room_key = ?
        and type = 'friend'
      order by created_at) as m
       left join users as u on u.id = m.sender_id;
      `;
      rawHistoryMsgList = await query(sql, [roomKey]);
    }
    /**
     * @type {{senderId: number, receiverId: number, content: string, roomKey: string, avatar: string, mediaType: 'text' | 'image' | 'video' | 'file', fileSize: string, createdAt: string}[]}
     */
    const historyMsgList = rawHistoryMsgList.map((item) => ({
      senderId: item.sender_id,
      receiverId: item.receiver_id,
      content: item.content,
      roomKey: item.room_key,
      avatar: item.avatar,
      mediaType: item.media_type,
      fileSize: fmtBytes(item.file_size),
      createdAt: new Date(item.created_at).toLocaleString("zh-CN", {
        timeZone: "Asia/Shanghai",
      }),
    }));
    ws.send(JSON.stringify(historyMsgList));
    const sql = `
update messages
set state = 1
where receiver_id = ?
  and room_key = ?
  and type = ?
  and state = 0;
    `;
    await query(sql, [id, roomKey, type]);
    ws.on("message", async (msgStr) => {
      const msgObj = JSON.parse(msgStr);
      const writeMsg = {
        sender_id: msgObj.senderId,
        receiver_id: msgObj.receiverId,
        content: msgObj.content,
        roomKey,
        type,
        media_type: msgObj.mediaType,
        file_size: msgObj.fileSize ? msgObj.fileSize : 0,
        state: 0, // 0 未读, 1 已读
      };
      await writeAndSend(type, roomKey, writeMsg, msgObj);
    });

    ws.on("close", () => {
      if (global.ChatRooms[roomKey][id]) {
        delete global.ChatRooms[roomKey][id];
      }
    });
  } catch (err) {
    console.error(err);
    ws.close();
    return;
  }
}
