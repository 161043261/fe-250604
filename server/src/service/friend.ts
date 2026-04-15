import db from "../utils/query.js";
import { BASE_STATE } from "../utils/state.js";
import {
  FindFriendByEmailSchema,
  FindFriendByIdQuerySchema,
  AddFriendSchema,
  AddTagSchema,
  UpdateFriendSchema,
} from "../schema/index.js";
import { resErr, resOk } from "../utils/res.js";
import { v4 as uuid } from "uuid";
import pub from "../utils/pub.js";
import { camel2snake, snack2camel } from "../utils/fmt.js";
import type { AppContext, FriendRecord, TagRecord, UserRecord } from "../types.js";

async function selectFriendsByTagId(tagId: number): Promise<Record<string, unknown>[]> {
  try {
    const friendWraps = await db<FriendRecord>("friends").select("*").where("tag_id", tagId);
    return friendWraps.map((item) => snack2camel(item));
  } catch (err) {
    console.error(err);
    throw err;
  }
}

async function selectFriendsByUserId(userId: number): Promise<Record<string, unknown>[]> {
  const retList: Record<string, unknown>[] = [];
  try {
    const idWraps = await db<{ id: number }>("tags").select("id").where("user_id", userId);
    for (const item of idWraps) {
      const camelItems = await selectFriendsByTagId(item.id);
      retList.push(...camelItems);
    }
    return retList;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

async function insertFriend(friendItem: Record<string, unknown>): Promise<void> {
  friendItem = camel2snake(friendItem);
  try {
    const ids = await db("friends").insert(friendItem);
    if (!Array.isArray(ids) || ids.length !== 1) {
      throw new Error("affectedRows !== 1");
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// DAO end

export async function findFriendListByEmail(ctx: AppContext): Promise<void> {
  const sender = ctx.userInfo;
  const result = FindFriendByEmailSchema.safeParse(ctx.query);
  if (!sender || !result.success) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  const { email } = result.data;
  try {
    const results = await db<Pick<UserRecord, "id" | "email" | "username" | "avatar">>("users")
      .select("id", "email", "username", "avatar")
      .where("email", "like", `%${email}%`);
    if (results.length === 0) {
      resOk(ctx, []);
      return;
    }
    const friends = await selectFriendsByUserId(sender.id);
    resOk(
      ctx,
      results
        .filter((item) => item.email !== sender.email)
        .map((item) => ({
          ...item,
          flag: friends.some((friend) => friend.email === item.email),
        })),
    );
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}

export async function addFriend(ctx: AppContext): Promise<void> {
  const sender = ctx.userInfo;
  const result = AddFriendSchema.safeParse(ctx.request.body);
  if (!sender || !result.success) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }

  const { id, email, avatar } = result.data;
  try {
    const roomKey = uuid();
    const [senderIds, receiverIds] = await Promise.all([
      db<{ id: number }>("tags").select("id").where("user_id", sender.id),
      db<{ id: number }>("tags").select("id").where("user_id", id),
    ]);
    await Promise.all([
      insertFriend({
        user_id: id,
        email,
        avatar,
        state: global.__online_users__[email] ? "online" : "offline",
        note_name: email,
        tag_id: senderIds[0].id,
        room_key: roomKey,
      }),
      insertFriend({
        user_id: sender.id,
        email: sender.email,
        avatar: sender.avatar,
        state: global.__online_users__[sender.email] ? "online" : "offline",
        note_name: sender.email,
        tag_id: receiverIds[0].id,
        room_key: roomKey,
      }),
    ]);
    pub({ receiverEmail: email, type: "wsFetchFriendList" });
    pub({ receiverEmail: sender.email, type: "wsFetchFriendList" });
    resOk(ctx);
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}

export async function findFriendList(ctx: AppContext): Promise<void> {
  try {
    const sender = ctx.userInfo;
    if (!sender) {
      resErr(ctx, BASE_STATE.ParamErr);
      return;
    }
    const idNameWraps = await db<{ id: number; name: string }>("tags")
      .select("id", "name")
      .where("user_id", sender.id);
    if (idNameWraps.length === 0) {
      resOk(ctx, []);
      return;
    }
    const taggedFriendsList: {
      tagName: string;
      onlineCnt: number;
      friends: Record<string, unknown>[];
    }[] = [];
    for (const idNameWrap of idNameWraps) {
      const taggedFriends = {
        tagName: idNameWrap.name,
        onlineCnt: 0,
        friends: [] as Record<string, unknown>[],
      };
      const friends = await selectFriendsByTagId(idNameWrap.id);
      for (const friend of friends) {
        taggedFriends.friends.push(friend);
        if (friend.state === "online") {
          taggedFriends.onlineCnt++;
        }
      }
      taggedFriendsList.push(taggedFriends);
    }
    resOk(ctx, taggedFriendsList);
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}

export async function findFriendById(ctx: AppContext): Promise<void> {
  const result = FindFriendByIdQuerySchema.safeParse(ctx.query);
  if (!result.success) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  const { id } = result.data;
  if (!id) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  try {
    const friendInfoWrap = await db("friends as f")
      .join("users as u", "f.user_id", "u.id")
      .join("tags as t", "f.tag_id", "t.id")
      .select({
        friend_id: "f.id",
        friend_user_id: "f.user_id",
        state: "f.state",
        note_name: "f.note_name",
        tag_id: "f.tag_id",
        room_key: "f.room_key",
        unread_cnt: "f.unread_cnt",
        tag_name: "t.name",
        email: "u.email",
        avatar: "u.avatar",
        username: "u.username",
        signature: "u.signature",
      })
      .where("f.id", Number(id))
      .first();
    if (friendInfoWrap) {
      const friendInfo = snack2camel(friendInfoWrap);
      resOk(ctx, friendInfo);
    }
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}

export async function findTagList(ctx: AppContext): Promise<void> {
  const userId = ctx.userInfo?.id;
  if (!userId) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  try {
    const tagWraps = await db<TagRecord>("tags").select("*").where("user_id", userId);
    resOk(
      ctx,
      tagWraps.map((item) => snack2camel(item)),
    );
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}

export async function addTag(ctx: AppContext): Promise<void> {
  const result = AddTagSchema.safeParse(ctx.request.body);
  if (!result.success) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  const tag = result.data;
  try {
    await db("tags").insert(camel2snake(tag));
    resOk(ctx);
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}

export async function updateFriend(ctx: AppContext): Promise<void> {
  const result = UpdateFriendSchema.safeParse(ctx.request.body);
  if (!result.success) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  const { friendId, noteName, tagId } = result.data;
  try {
    const affectedRows = await db("friends")
      .where("id", friendId)
      .update({ note_name: noteName, tag_id: tagId });
    if (affectedRows === 1) {
      resOk(ctx);
    } else {
      resErr(ctx, BASE_STATE.UpdateErr);
    }
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}
