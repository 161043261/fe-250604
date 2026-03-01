import query from "../utils/query.js";
import { BASE_STATE } from "../utils/state.js";
import { resErr, resOk } from "../utils/res.js";
import { v4 as uuid } from "uuid";
import pub from "../utils/pub.js";
import { camel2snake, snack2camel } from "../utils/fmt.js";
import type { AppContext, FriendRecord, TagRecord, UserRecord } from "../types.js";

async function selectFriendsByTagId(tagId: number): Promise<Record<string, unknown>[]> {
  try {
    const friendWraps = await query<FriendRecord[]>("select * from friends where tag_id = ?", [
      tagId,
    ]);
    return friendWraps.map((item) => snack2camel(item as unknown as Record<string, unknown>));
  } catch (err) {
    console.error(err);
    throw err;
  }
}

async function selectFriendsByUserId(userId: number): Promise<Record<string, unknown>[]> {
  const retList: Record<string, unknown>[] = [];
  try {
    const idWraps = await query<{ id: number }[]>("select id from tags where user_id = ?", [
      userId,
    ]);
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
    const result = await query<{ affectedRows: number }>("insert into friends set ?", friendItem);
    if (result.affectedRows !== 1) {
      throw new Error("affectedRows !== 1");
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// DAO end

interface FindFriendByEmailQuery {
  email: string;
}

interface AddFriendRequest {
  id: number;
  email: string;
  avatar: string;
}

interface UpdateFriendRequest {
  friendId: number;
  noteName: string;
  tagId: number;
}

export async function findFriendListByEmail(ctx: AppContext): Promise<void> {
  const sender = ctx.userInfo;
  const { email } = ctx.query as unknown as FindFriendByEmailQuery;
  if (!sender || !email) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  try {
    const results = await query<Pick<UserRecord, "id" | "email" | "username" | "avatar">[]>(
      "select id, email, username, avatar from users where email like ?",
      [`%${email}%`],
    );
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
  if (!sender) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }

  const { id, email, avatar } = ctx.request.body as AddFriendRequest;
  if (!id || !email || !avatar) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  try {
    const roomKey = uuid();
    const [senderIds, receiverIds] = await Promise.all([
      query<{ id: number }[]>("select id from tags where user_id = ?", [sender.id]),
      query<{ id: number }[]>("select id from tags where user_id = ?", [id]),
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
    const idNameWraps = await query<{ id: number; name: string }[]>(
      "select id, name from tags where user_id = ?",
      [sender.id],
    );
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
  const { id } = ctx.query as { id?: string };
  if (!id) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  try {
    const sql = `
select f.id      as friend_id,
       f.user_id as friend_user_id,
       f.state,
       f.note_name,
       f.tag_id,
       f.room_key,
       f.unread_cnt,
       t.name    as tag_name,
       u.email,
       u.avatar,
       u.username,
       u.signature
from friends as f
       join users as u on f.user_id = u.id
       join tags as t on f.tag_id = t.id
where f.id = ?;
    `;
    const friendInfoWraps = await query<Record<string, unknown>[]>(sql, [id]);
    if (friendInfoWraps.length !== 0) {
      const friendInfo = snack2camel(friendInfoWraps[0]);
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
    const tagWraps = await query<TagRecord[]>("select * from tags where user_id = ?", [userId]);
    resOk(
      ctx,
      tagWraps.map((item) => snack2camel(item as unknown as Record<string, unknown>)),
    );
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}

export async function addTag(ctx: AppContext): Promise<void> {
  const tag = ctx.request.body as Record<string, unknown>;
  if (!tag) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  try {
    const result = await query<{ affectedRows: number }>(
      "insert into tags set ?",
      camel2snake(tag),
    );
    if (result.affectedRows === 1) {
      resOk(ctx);
    }
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}

export async function updateFriend(ctx: AppContext): Promise<void> {
  const { friendId, noteName, tagId } = ctx.request.body as UpdateFriendRequest;
  if (!friendId || !noteName || !tagId) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  try {
    const result = await query<{ affectedRows: number }>(
      "update friends set note_name = ?, tag_id = ? where id = ?",
      [noteName, tagId, friendId],
    );
    if (result.affectedRows === 1) {
      resOk(ctx);
    } else {
      resErr(ctx, BASE_STATE.UpdateErr);
    }
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}
