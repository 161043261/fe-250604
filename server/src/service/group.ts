import { v4 as uuid } from "uuid";
import { BASE_STATE, GROUP_STATE } from "../utils/state.js";
import { resOk, resErr } from "../utils/res.js";
import pub from "../utils/pub.js";
import query from "../utils/query.js";
import { snack2camel } from "../utils/fmt.js";
import type { AppContext, GroupRecord } from "../types.js";

async function selectGroupMembers(
  groupId: number | string,
  roomKey: string,
): Promise<Record<string, unknown>[]> {
  try {
    const sql = `
select s.*, m.latest_msg_time
from (select user_id, users.avatar, users.email, users.username, nickname, group_members.created_at
      from group_members,
           users
      where group_id = ?
        and user_id = users.id) as s
       left join (select sender_id, max(created_at) as latest_msg_time
                  from messages
                  where messages.room_key = ?
                  group by sender_id) as m on m.sender_id = s.user_id;
  `;
    const results = await query<Record<string, unknown>[]>(sql, [groupId, roomKey]);
    return results.map((item) => snack2camel(item));
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// DAO end

interface CreateGroupRequest {
  groupName: string;
  groupAvatar?: string;
  readme?: string;
  memberList: Array<{ userId: number; email: string; avatar: string }>;
}

interface AddFriends2GroupRequest {
  groupId: number;
  friendList: Array<{ userId: number; email: string }>;
}

interface AddSelf2GroupRequest {
  groupId: number;
}

export async function createGroup(ctx: AppContext): Promise<void> {
  const { groupName, groupAvatar, readme, memberList } = ctx.request.body as CreateGroupRequest;
  if (!groupName) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  const userInfo = ctx.userInfo;
  if (!userInfo) {
    resErr(ctx, BASE_STATE.TokenErr);
    return;
  }
  try {
    const roomKey = uuid();
    const result = await query<{ affectedRows: number; insertId: number }>(
      "insert into `groups` set ?",
      {
        name: groupName,
        avatar: groupAvatar,
        readme,
        room_key: roomKey,
        creator_id: userInfo.id,
        unread_cnt: 0,
      },
    );
    if (result.affectedRows === 1) {
      const insertId = result.insertId;
      await Promise.all([
        query("insert into messages set ?", {
          sender_id: userInfo.id,
          receiver_id: insertId,
          type: "group",
          media_type: "text",
          state: 0,
          content: "欢迎",
          room_key: roomKey,
        }),
        query("insert into msg_stats set ?", { room_key: roomKey, total: 1 }),
      ]);

      memberList.push({
        userId: userInfo.id,
        email: userInfo.email,
        avatar: userInfo.avatar,
      });
      for (const member of memberList) {
        await query("insert into group_members set ?", {
          group_id: insertId,
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
    const results = await query<GroupRecord[]>(
      `
select g.*
from ((select group_id from group_members where user_id = ?) as gm
  left join \`groups\` as g on gm.group_id = g.id);
      `,
      [id],
    );
    resOk(
      ctx,
      results.map((item) => snack2camel(item as unknown as Record<string, unknown>)),
    );
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}

export async function findGroupListByName(ctx: AppContext): Promise<void> {
  const { name } = ctx.query as { name?: string };
  if (!name) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  try {
    const groupWraps = await query<GroupRecord[]>("select * from `groups` where name like ?", [
      `%${name}%`,
    ]);
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
      const userIdWraps = await query<{ user_id: number }[]>(
        "select user_id from group_members where group_id = ?",
        [groupWrap.id],
      );
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
  const groupId = ctx.query.id as string | undefined;
  if (!groupId) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  try {
    const sql = `
select g.id,
       g.name,
       g.creator_id,
       u.email as creator_email,
       g.avatar,
       g.readme,
       g.room_key,
       g.created_at
from \`groups\` g
       join users u on g.creator_id = u.id
where g.id = ?;
  `;
    const results = await query<Record<string, unknown>[]>(sql, [groupId]);
    if (results.length === 0) {
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
    } = results[0];
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
    groupData.memberList = await selectGroupMembers(groupId, roomKey as string);
    resOk(ctx, groupData);
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}

export async function addFriends2group(ctx: AppContext): Promise<void> {
  const { groupId, friendList } = ctx.request.body as AddFriends2GroupRequest;
  if (!groupId || !friendList) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  try {
    const userIdList = friendList.map((item) => item.userId);
    const userIdWraps = await query<{ user_id: number }[]>(
      "select user_id from group_members where group_id = ? and find_in_set(user_id, ?)",
      [groupId, userIdList.join(",")],
    );
    const filteredList = friendList.filter((friend) =>
      userIdWraps.every((item) => item.user_id !== friend.userId),
    );
    if (filteredList.length === 0) {
      resErr(ctx, GROUP_STATE.FriendJoined);
      return;
    }
    await query("insert into group_members (group_id, user_id, nickname) values ?", [
      filteredList.map((item) => [groupId, item.userId, item.email]),
    ]);
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
  const { groupId } = ctx.request.body as AddSelf2GroupRequest;
  if (!groupId) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  try {
    const groupMemberIdWraps = await query<{ id: number }[]>(
      "select id from group_members where group_id = ? and user_id = ?",
      [groupId, sender.id],
    );
    if (groupMemberIdWraps.length !== 0) {
      resErr(ctx, GROUP_STATE.SelfJoined);
      return;
    }
    await query("insert into group_members set ?", {
      group_id: groupId,
      user_id: sender.id,
      nickname: sender.username,
    });
    const [{ name: groupName, room_key: roomKey }] = await query<
      { name: string; room_key: string }[]
    >("select name, room_key from `groups` where id = ?", [groupId]);
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
  const { groupId, roomKey } = ctx.query as { groupId?: string; roomKey?: string };
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
