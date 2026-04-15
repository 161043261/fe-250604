import { v4 as uuid } from "uuid";
import { BASE_STATE, GROUP_STATE } from "../utils/state.js";
import {
  CreateGroupSchema,
  AddFriends2GroupSchema,
  AddSelf2GroupSchema,
  FetchGroupMembersQuerySchema,
  SearchGroupByNameQuerySchema,
} from "../schema/index.js";
import { resOk, resErr } from "../utils/res.js";
import pub from "../utils/pub.js";
import db from "../utils/query.js";
import { snack2camel } from "../utils/fmt.js";
import type { AppContext, GroupRecord } from "../types.js";

async function selectGroupMembers(
  groupId: number | string,
  roomKey: string,
): Promise<Record<string, unknown>[]> {
  try {
    const membersSubQuery = db("group_members as gm")
      .join("users as u", "gm.user_id", "u.id")
      .where("gm.group_id", Number(groupId))
      .select({
        user_id: "gm.user_id",
        avatar: "u.avatar",
        email: "u.email",
        username: "u.username",
        nickname: "gm.nickname",
        created_at: "gm.created_at",
      })
      .as("s");

    const latestMsgSubQuery = db("messages")
      .select("sender_id")
      .max({ latest_msg_time: "created_at" })
      .where("room_key", roomKey)
      .groupBy("sender_id")
      .as("m");

    const results = await db
      .from(membersSubQuery)
      .leftJoin(latestMsgSubQuery, "m.sender_id", "s.user_id")
      .select("s.*", "m.latest_msg_time");
    return results.map((item) => snack2camel(item));
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export async function createGroup(ctx: AppContext): Promise<void> {
  const result = CreateGroupSchema.safeParse(ctx.request.body);
  if (!result.success) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  const { groupName, groupAvatar, readme, memberList } = result.data;
  const userInfo = ctx.userInfo;
  if (!userInfo) {
    resErr(ctx, BASE_STATE.TokenErr);
    return;
  }
  try {
    const roomKey = uuid();
    const [insertId] = await db("groups").insert({
      name: groupName,
      avatar: groupAvatar,
      readme,
      room_key: roomKey,
      creator_id: userInfo.id,
      unread_cnt: 0,
    });
    if (insertId) {
      await Promise.all([
        db("messages").insert({
          sender_id: userInfo.id,
          receiver_id: Number(insertId),
          type: "group",
          media_type: "text",
          state: 0,
          content: "欢迎",
          room_key: roomKey,
        }),
        db("msg_stats").insert({ room_key: roomKey, total: 1 }),
      ]);

      memberList.push({
        userId: userInfo.id,
        email: userInfo.email,
        avatar: userInfo.avatar,
      });
      for (const member of memberList) {
        await db("group_members").insert({
          group_id: Number(insertId),
          user_id: member.userId,
          nickname: member.email,
        });
        pub({ receiverEmail: member.email, type: "wsFetchGroupList" });
      }
      resOk(ctx);
    }
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}

export async function findGroupListByUserId(ctx: AppContext): Promise<void> {
  const id = ctx.userInfo?.id;
  if (!id) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  try {
    const results = await db<GroupRecord>("group_members as gm")
      .join("groups as g", "gm.group_id", "g.id")
      .where("gm.user_id", id)
      .distinct("g.*");
    resOk(
      ctx,
      results.map((item) => snack2camel(item)),
    );
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}

export async function findGroupByName(ctx: AppContext): Promise<void> {
  const result = SearchGroupByNameQuerySchema.safeParse(ctx.query);
  if (!result.success) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  const { name } = result.data;
  if (!name) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  try {
    const groupWraps = await db<GroupRecord>("groups")
      .select("*")
      .where("name", "like", `%${name}%`);
    const retList: {
      name: string;
      avatar: string | null;
      memberNum: number;
      flag: boolean;
      id: number;
    }[] = [];
    if (groupWraps.length === 0) {
      resOk(ctx, []);
      return;
    }
    const userId = ctx.userInfo?.id;
    for (const groupWrap of groupWraps) {
      const userIdWraps = await db<{ user_id: number }>("group_members")
        .select("user_id")
        .where("group_id", groupWrap.id);
      retList.push({
        name: groupWrap.name,
        avatar: groupWrap.avatar,
        memberNum: userIdWraps.length,
        flag: userIdWraps.some((item) => item.user_id === userId),
        id: groupWrap.id,
      });
    }
    resOk(ctx, retList);
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}

export async function findGroupById(ctx: AppContext): Promise<void> {
  const groupId = ctx.query.id
    ? typeof ctx.query.id === "string"
      ? ctx.query.id
      : ctx.query.id[0]
    : "";
  if (!groupId) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  try {
    const groupWrap = await db("groups as g")
      .join("users as u", "g.creator_id", "u.id")
      .select({
        id: "g.id",
        name: "g.name",
        creator_id: "g.creator_id",
        creator_email: "u.email",
        avatar: "g.avatar",
        readme: "g.readme",
        room_key: "g.room_key",
        created_at: "g.created_at",
      })
      .where("g.id", Number(groupId))
      .first();
    if (!groupWrap) {
      resErr(ctx, BASE_STATE.ParamErr);
      return;
    }
    const {
      id,
      name,
      creator_id: creatorId,
      creator_email: creatorEmail,
      avatar,
      readme,
      room_key: roomKey,
      created_at: createdAt,
    } = groupWrap;
    const groupData = {
      id,
      name,
      creatorId,
      creatorEmail,
      avatar,
      readme,
      roomKey,
      createdAt,
      memberList: [] as Record<string, unknown>[],
    };
    groupData.memberList = await selectGroupMembers(groupId, String(roomKey));
    resOk(ctx, groupData);
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}

export async function addFriends2group(ctx: AppContext): Promise<void> {
  const result = AddFriends2GroupSchema.safeParse(ctx.request.body);
  if (!result.success) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  const { groupId, friendList } = result.data;
  try {
    const userIdList = friendList.map((item) => item.userId);
    const userIdWraps = await db<{ user_id: number }>("group_members")
      .select("user_id")
      .where("group_id", groupId)
      .whereIn("user_id", userIdList);
    const filteredList = friendList.filter((friend) =>
      userIdWraps.every((item) => item.user_id !== friend.userId),
    );
    if (filteredList.length === 0) {
      resErr(ctx, GROUP_STATE.FriendJoined);
      return;
    }
    await db("group_members").insert(
      filteredList.map((item) => ({
        group_id: groupId,
        user_id: item.userId,
        nickname: item.email,
      })),
    );
    for (const item of filteredList) {
      pub({ receiverEmail: item.email, type: "wsFetchGroupList" });
    }
    if (ctx.userInfo) {
      pub({ receiverEmail: ctx.userInfo.email, type: "wsFetchGroupList" });
    }
    resOk(ctx);
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}

export async function addSelf2group(ctx: AppContext): Promise<void> {
  const sender = ctx.userInfo;
  if (!sender) {
    resErr(ctx, BASE_STATE.TokenErr);
    return;
  }
  const result = AddSelf2GroupSchema.safeParse(ctx.request.body);
  if (!result.success) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  const { groupId } = result.data;
  try {
    const groupMember = await db<{ id: number }>("group_members")
      .select("id")
      .where({ group_id: groupId, user_id: sender.id })
      .first();
    if (groupMember) {
      resErr(ctx, GROUP_STATE.SelfJoined);
      return;
    }
    await db("group_members").insert({
      group_id: groupId,
      user_id: sender.id,
      nickname: sender.username,
    });
    const groupWrap = await db<{ name: string; room_key: string }>("groups")
      .select("name", "room_key")
      .where("id", groupId)
      .first();
    if (!groupWrap) {
      resErr(ctx, BASE_STATE.ParamErr);
      return;
    }
    const { name: groupName, room_key: roomKey } = groupWrap;
    pub({ receiverEmail: sender.email, type: "wsFetchGroupList" });
    resOk(ctx, {
      groupId,
      groupName,
      roomKey,
    });
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}

export async function findGroupMembers(ctx: AppContext): Promise<void> {
  const result = FetchGroupMembersQuerySchema.safeParse(ctx.query);
  if (!result.success) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  const { groupId, roomKey } = result.data;
  if (!groupId || !roomKey) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  try {
    const groupMembers = await selectGroupMembers(groupId, roomKey);
    resOk(ctx, groupMembers);
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}
