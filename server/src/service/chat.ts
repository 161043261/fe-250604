import type { WebSocket } from "ws";
import { camel2snake, fmtBytes, snack2camel } from "../utils/fmt.js";
import pub from "../utils/pub.js";
import query from "../utils/query.js";
import { BASE_STATE } from "../utils/state.js";
import { resOk, resErr } from "../utils/res.js";
import type { AppContext, ChatMessage, MsgStatRecord } from "../types.js";

async function updateMsgStats(roomKey: string): Promise<void> {
  const msgStatWraps = await query<MsgStatRecord[]>("select * from msg_stats where room_key = ?", [
    roomKey,
  ]);
  if (msgStatWraps.length === 0) {
    await query("insert into msg_stats set ?", { room_key: roomKey, total: 0 });
  }
  await query("update msg_stats set total = total + 1 where room_key = ?", [roomKey]);
}

interface WriteMsg {
  sender_id: number;
  receiver_id: number;
  content: string;
  roomKey: string;
  type: string;
  media_type: string;
  file_size: number;
  state: number;
}

async function writeAndSend(
  type: "friend" | "group",
  roomKey: string,
  writeMsg: WriteMsg,
  sendMsg: ChatMessage,
): Promise<void> {
  if (
    type === "group" ||
    (type === "friend" && global.__chat_rooms__[roomKey][sendMsg.receiverId])
  ) {
    writeMsg.state = 1;
  } else {
    writeMsg.state = 0;
  }
  await Promise.all([
    query(
      "insert into messages set ?",
      camel2snake(writeMsg as unknown as Record<string, unknown>),
    ),
    updateMsgStats(roomKey),
  ]);
  sendMsg.createdAt = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  sendMsg.fileSize = fmtBytes(writeMsg.file_size);
  for (const receiverId in global.__chat_rooms__[roomKey]) {
    global.__chat_rooms__[roomKey][receiverId].send(JSON.stringify(sendMsg));
  }
  if (type === "group") {
    const userIdWraps = await query<{ user_id: number }[]>(
      "select user_id from group_members where group_id = ?",
      [sendMsg.receiverId],
    );
    for (const item of userIdWraps) {
      if (item.user_id !== sendMsg.senderId) {
        pub({ receiverId: item.user_id, type: "wsFetchChatList" });
      }
    }
  } else {
    pub({ receiverId: sendMsg.receiverId, type: "wsFetchChatList" });
  }
}

interface ChatListRawItem {
  receiver_id: number;
  name: string;
  receiver_email?: string;
  room_key: string;
  updated_at: string;
  unread_cnt?: number;
  latest_msg?: string;
  media_type?: string;
  avatar?: string;
}

export async function findChatList(ctx: AppContext): Promise<void> {
  try {
    const data: Record<string, unknown>[] = [];
    const userId = ctx.userInfo?.id;
    if (!userId) {
      resErr(ctx, BASE_STATE.ParamErr);
      return;
    }
    const sql = `
select user_id as receiver_id, note_name as name, email as receiver_email, f.room_key, msg_stats.updated_at
from friends as f,
     (select id from tags where user_id = ?) as t,
     msg_stats
where t.id = f.tag_id
  and f.room_key = msg_stats.room_key
order by msg_stats.updated_at desc;
    `;
    const results = await query<ChatListRawItem[]>(sql, [userId]);
    for (const item of results) {
      const unreadCntSql = `
select count(*) as unread_cnt
from messages
where room_key = ?
  and receiver_id = ?
  and state = 0;
      `;
      const unreadCntWraps = await query<{ unread_cnt: number }[]>(unreadCntSql, [
        item.room_key,
        userId,
      ]);
      item.unread_cnt = unreadCntWraps[0].unread_cnt;
      const sql2 = `
select content as latest_msg, media_type
from messages
where room_key = ?
order by created_at desc
limit 1;
      `;
      const results2 = await query<{ latest_msg: string; media_type: string }[]>(sql2, [
        item.room_key,
      ]);
      item.latest_msg = results2[0].latest_msg;
      item.media_type = results2[0].media_type;
      const avatarWraps = await query<{ avatar: string }[]>(
        "select avatar from users where id = ?",
        [item.receiver_id],
      );
      item.avatar = avatarWraps[0].avatar;
    }
    if (results) {
      data.push(...results.map((item) => snack2camel(item as unknown as Record<string, unknown>)));
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
    const results3 = await query<ChatListRawItem[]>(sql3, [userId]);
    for (const item3 of results3) {
      item3.unread_cnt = 0;
      const sql4 = `
select content as latest_msg, media_type
from messages
where room_key = ?
order by created_at desc
limit 1;
      `;
      const result4 = await query<{ latest_msg: string; media_type: string }[]>(sql4, [
        item3.room_key,
      ]);
      item3.latest_msg = result4[0].latest_msg;
      item3.media_type = result4[0].media_type;
    }
    if (results3) {
      data.push(...results3.map((item) => snack2camel(item as unknown as Record<string, unknown>)));
    }

    data.sort((a, b) => {
      const ta = new Date(a.updatedAt as string).getTime();
      const tb = new Date(b.updatedAt as string).getTime();
      return tb - ta;
    });
    resOk(ctx, data);
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}

interface RawHistoryMsg {
  sender_id: number;
  receiver_id: number;
  content: string;
  room_key: string;
  avatar: string;
  media_type: string;
  file_size: number;
  created_at: string;
  nickname?: string;
}

export async function connChat(ws: WebSocket, url: string): Promise<void> {
  const params = new URLSearchParams(url);
  const roomKey = params.get("roomKey");
  const id = params.get("id");
  const type = params.get("type") as "friend" | "group" | null;
  if (!roomKey || !id || !type) {
    ws.close();
    return;
  }
  try {
    if (!global.__chat_rooms__[roomKey]) {
      global.__chat_rooms__[roomKey] = {};
    }
    global.__chat_rooms__[roomKey][id] = ws;
    let rawHistoryMsgList: RawHistoryMsg[] = [];
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
      rawHistoryMsgList = await query<RawHistoryMsg[]>(sql, [roomKey, id]);
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
      rawHistoryMsgList = await query<RawHistoryMsg[]>(sql, [roomKey]);
    }

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

    ws.on("message", async (msgStr: string) => {
      const msgObj = JSON.parse(msgStr.toString()) as ChatMessage;
      const writeMsg: WriteMsg = {
        sender_id: msgObj.senderId,
        receiver_id: msgObj.receiverId,
        content: msgObj.content,
        roomKey,
        type,
        media_type: msgObj.mediaType,
        file_size: typeof msgObj.fileSize === "number" ? msgObj.fileSize : 0,
        state: 0,
      };
      await writeAndSend(type, roomKey, writeMsg, msgObj);
    });

    ws.on("close", () => {
      if (global.__chat_rooms__[roomKey]?.[id]) {
        delete global.__chat_rooms__[roomKey][id];
      }
    });
  } catch (err) {
    console.error(err);
    ws.close();
  }
}
