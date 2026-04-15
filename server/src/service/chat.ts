import type { WebSocket } from "ws";
import { WsChatQueryParamsSchema, ChatMessageSchema } from "../schema/index.js";
import { camel2snake, fmtBytes, snack2camel } from "../utils/fmt.js";
import pub from "../utils/pub.js";
import db from "../utils/query.js";
import { BASE_STATE } from "../utils/state.js";
import { resOk, resErr } from "../utils/res.js";
import type { AppContext, ChatMessage, MsgStatRecord } from "../types.js";

async function updateMsgStats(roomKey: string): Promise<void> {
  const msgStat = await db<MsgStatRecord>("msg_stats").select("*").where("room_key", roomKey).first();
  if (!msgStat) {
    await db("msg_stats").insert({ room_key: roomKey, total: 0 });
  }
  await db("msg_stats").where("room_key", roomKey).increment("total", 1);
}

interface WriteMsg extends Record<string, unknown> {
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
    db("messages").insert(camel2snake(writeMsg)),
    updateMsgStats(roomKey),
  ]);
  sendMsg.createdAt = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  sendMsg.fileSize = fmtBytes(writeMsg.file_size);
  for (const receiverId in global.__chat_rooms__[roomKey]) {
    global.__chat_rooms__[roomKey][receiverId].send(JSON.stringify(sendMsg));
  }
  if (type === "group") {
    const userIdWraps = await db<{ user_id: number }>("group_members")
      .select("user_id")
      .where("group_id", sendMsg.receiverId);
    for (const item of userIdWraps) {
      if (item.user_id !== sendMsg.senderId) {
        pub({ receiverId: item.user_id, type: "wsFetchChatList" });
      }
    }
  } else {
    pub({ receiverId: sendMsg.receiverId, type: "wsFetchChatList" });
  }
}

interface ChatListRawItem extends Record<string, unknown> {
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
    const results = await db<ChatListRawItem>("friends as f")
      .join("tags as t", "t.id", "f.tag_id")
      .join("msg_stats as ms", "f.room_key", "ms.room_key")
      .where("t.user_id", userId)
      .select({
        receiver_id: "f.user_id",
        name: "f.note_name",
        receiver_email: "f.email",
        room_key: "f.room_key",
        updated_at: "ms.updated_at",
      })
      .orderBy("ms.updated_at", "desc");
    for (const item of results) {
      const unreadCntWrap = await db("messages")
        .where({ room_key: item.room_key, receiver_id: userId, state: 0 })
        .count<{ unread_cnt: string | number }>({ unread_cnt: "*" })
        .first();
      item.unread_cnt = Number(unreadCntWrap?.unread_cnt ?? 0);

      const latestMsgWrap = await db("messages")
        .where("room_key", item.room_key)
        .select({ latest_msg: "content", media_type: "media_type" })
        .orderBy("created_at", "desc")
        .first();
      item.latest_msg = latestMsgWrap?.latest_msg ?? "";
      item.media_type = latestMsgWrap?.media_type ?? "text";

      const avatarWrap = await db("users")
        .select<{ avatar: string | null }[]>("avatar")
        .where("id", item.receiver_id)
        .first();
      item.avatar = avatarWrap?.avatar ?? null;
    }
    if (results) {
      data.push(...results.map((item) => snack2camel(item)));
    }
    const results3 = await db<ChatListRawItem>("group_members as gm")
      .join("groups as g", "g.id", "gm.group_id")
      .join("msg_stats as ms", "g.room_key", "ms.room_key")
      .where("gm.user_id", userId)
      .select({
        receiver_id: "g.id",
        avatar: "g.avatar",
        name: "g.name",
        room_key: "g.room_key",
        updated_at: "ms.updated_at",
      })
      .orderBy("ms.updated_at", "desc");
    for (const item3 of results3) {
      item3.unread_cnt = 0;
      const result4 = await db("messages")
        .where("room_key", item3.room_key)
        .select({ latest_msg: "content", media_type: "media_type" })
        .orderBy("created_at", "desc")
        .first();
      item3.latest_msg = result4?.latest_msg ?? "";
      item3.media_type = result4?.media_type ?? "text";
    }
    if (results3) {
      data.push(...results3.map((item) => snack2camel(item)));
    }

    data.sort((a, b) => {
      const ta = new Date(String(a.updatedAt ?? a.updated_at)).getTime();
      const tb = new Date(String(b.updatedAt ?? b.updated_at)).getTime();
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
  const parsedParams = {
    roomKey: params.get("roomKey"),
    id: params.get("id"),
    type: params.get("type"),
  };
  const result = WsChatQueryParamsSchema.safeParse(parsedParams);
  if (!result.success) {
    ws.close();
    return;
  }
  const { roomKey, id, type } = result.data;
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
      rawHistoryMsgList = await db<RawHistoryMsg>("messages as m")
        .leftJoin("users as u", "u.id", "m.sender_id")
        .leftJoin("group_members as gm", function () {
          this.on("gm.user_id", "=", "u.id").andOn(
            "gm.group_id",
            "=",
            db.raw("?", [Number(id)]),
          );
        })
        .where("m.room_key", roomKey)
        .andWhere("m.type", "group")
        .select(
          "gm.nickname",
          "m.sender_id",
          "m.receiver_id",
          "m.content",
          "m.room_key",
          "m.media_type",
          "m.file_size",
          "m.created_at",
          "u.avatar",
        )
        .orderBy("m.created_at");
    } else {
      rawHistoryMsgList = await db<RawHistoryMsg>("messages as m")
        .leftJoin("users as u", "u.id", "m.sender_id")
        .where("m.room_key", roomKey)
        .andWhere("m.type", "friend")
        .select(
          "m.sender_id",
          "m.receiver_id",
          "m.content",
          "m.room_key",
          "m.media_type",
          "m.file_size",
          "m.created_at",
          "u.avatar",
        )
        .orderBy("m.created_at");
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
    await db("messages")
      .where({ receiver_id: Number(id), room_key: roomKey, type, state: 0 })
      .update({ state: 1 });

    ws.on("message", async (msgStr: string | Buffer) => {
      let msgObj;
      try {
        const parsed = JSON.parse(msgStr.toString());
        const result = ChatMessageSchema.safeParse(parsed);
        if (!result.success) return;
        msgObj = result.data;
      } catch (err) {
        console.error("parse chat message error", err);
        return;
      }
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
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete global.__chat_rooms__[roomKey][id];
      }
    });
  } catch (err) {
    console.error(err);
    ws.close();
  }
}
