import { v4 as uuid } from "uuid";
import { BaseState, GroupState } from "../utils/state.js";
import { resOk, resErr } from "../utils/res.js";
import pub from "../utils/pub.js";
import query from "../utils/query.js";
import { snack2camel } from "../utils/fmt.js";

/**
 *
 * @param {number} groupId
 * @param {string} roomKey
 */
async function selectGroupMembers(groupId, roomKey) {
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
    const results = await query(sql, [groupId, roomKey]);
    return results.map((item) => snack2camel(item));
  } catch (err) {
    console.error(err);
    throw err;
  }
}

//! >>>>>>>>>>>>>>>>>>>> DAO end >>>>>>>>>>>>>>>>>>>>

/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function createGroup(req, res) {
  const { groupName, groupAvatar, readme, memberList } = req.body;
  if (!groupName) {
    return resErr(res, BaseState.ParamErr);
  }
  try {
    const roomKey = uuid();
    const { affectedRows, insertId } = await query("insert into `groups` set ?", {
      name: groupName,
      avatar: groupAvatar,
      readme,
      room_key: roomKey,
      creator_id: req.userInfo.id,
      unread_cnt: 0,
    });
    if (affectedRows === 1) {
      await Promise.all([
        query("insert into messages set ?", {
          sender_id: req.userInfo.id,
          receiver_id: insertId,
          type: "group",
          media_type: "text",
          state: 0,
          content: "欢迎",
          room_key: roomKey,
        }),
        query("insert into msg_stats set ?", { room_key: roomKey, total: 1 }),
      ]);

      // Add self
      memberList.push({
        userId: req.userInfo.id,
        email: req.userInfo.email,
        avatar: req.userInfo.avatar,
      });
      for (const member of memberList) {
        await query("insert into group_members set ?", {
          group_id: insertId,
          user_id: member.userId,
          nickname: member.email,
        });
        pub({ receiverEmail: member.email, type: "wsFetchGroupList" });
      }
      return resOk(res);
    }
  } catch (err) {
    console.error(err);
    return resErr(err, BaseState.ServerErr);
  }
}

/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function findGroupListByUserId(req, res) {
  const id = req.userInfo.id;
  if (!id) {
    return resErr(res, BaseState.ParamErr);
  }
  try {
    const results = await query(
      `
select g.*
from ((select group_id from group_members where user_id = ?) as gm
  left join \`groups\` as g on gm.group_id = g.id);
      `,
      [id],
    );
    return resOk(
      res,
      results.map((item) => snack2camel(item)),
    );
  } catch (err) {
    console.error(err);
    return resErr(res, BaseState.ServerErr);
  }
}

/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function findGroupListByName(req, res) {
  const { name } = req.query;
  if (!name) {
    return resErr(res, BaseState.ParamErr);
  }
  try {
    const groupWraps = await query("select * from `groups` where name like ?", [`%${name}%`]);
    const retList = [];
    if (groupWraps.length === 0) {
      return resOk(res, []);
    }
    const { id: userId } = req.userInfo;
    for (const groupWrap of groupWraps) {
      const userIdWraps = await query("select user_id from group_members where group_id = ?", [
        groupWrap.id,
      ]);
      //! name, avatar, memberNum, flag, id
      retList.push({
        name: groupWrap.name,
        avatar: groupWrap.avatar,
        memberNum: userIdWraps.length,
        // 是否已加入
        flag: userIdWraps.some((item) => item.user_id === userId),
        id: groupWrap.id, // groupId
      });
    }
    return resOk(res, retList);
  } catch (err) {
    console.error(err);
    return resErr(res, BaseState.ServerErr);
  }
}

/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function findGroupById(req, res) {
  const groupId = req.query.id;
  if (!groupId) {
    return resErr(res, BaseState.ParamErr);
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
    const [
      {
        id,
        name,
        creator_id: creatorId,
        creator_email: creatorEmail,
        avatar,
        readme,
        room_key: roomKey,
        created_at: createdAt,
      },
    ] = await query(sql, [groupId]);
    const groupData = {
      id,
      name,
      creatorId,
      creatorEmail,
      avatar,
      readme,
      roomKey,
      createdAt,
      memberList: [],
    };
    groupData.memberList = await selectGroupMembers(groupId, groupData.roomKey);
    // const memberList = await selectGroupMembers(groupId, groupData.roomKey);
    // for (const member of memberList) {
    //   groupData.memberList.push({ ...member });
    // }
    return resOk(res, groupData);
  } catch (err) {
    console.error(err);
    return resErr(res, BaseState.ServerErr);
  }
}

/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function addFriends2group(req, res) {
  const { groupId, friendList } = req.body;
  if (!groupId || !friendList) {
    return resErr(res, BaseState.ParamErr);
  }
  try {
    const userIdList = friendList.map((item) => item.userId);
    const userIdWraps = await query(
      "select user_id from group_members where group_id = ? and find_in_set(user_id, ?)",
      [groupId, userIdList.join(",")],
    );
    const filteredList = friendList.filter((friend) =>
      userIdWraps.every((item) => item.user_id !== friend.userId),
    );
    if (filteredList.length === 0) {
      return resErr(res, GroupState.FriendJoined);
    }
    // 批量插入
    await query("insert into group_members (group_id, user_id, nickname) values ?", [
      filteredList.map((item) => [groupId, item.userId, item.email /** 默认群昵称 */]),
    ]);
    for (const item of filteredList) {
      pub({ receiverEmail: item.email, type: "wsFetchGroupList" });
    }
    pub({ receiverEmail: req.userInfo.email, type: "wsFetchGroupList" });
    return resOk(res);
  } catch (err) {
    console.error(err);
    return resErr(res, BaseState.ServerErr);
  }
}

/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function addSelf2group(req, res) {
  const sender = req.userInfo;
  const groupId = req.body.groupId;
  if (!groupId) {
    return resErr(res, BaseState.ParamErr);
  }
  try {
    const groupMemberIdWraps = await query(
      "select id from group_members where group_id = ? and user_id = ?",
      [groupId, sender.id],
    );
    if (groupMemberIdWraps.length !== 0) {
      return resErr(res, GroupState.SelfJoined);
    }
    await query("insert into group_members set ?", {
      group_id: groupId,
      user_id: sender.id,
      nickname: sender.username,
    });
    const [{ name: groupName, room_key: roomKey }] = await query(
      "select name, room_key from `groups` where id = ?",
      [groupId],
    );
    pub({ receiverEmail: sender.email, type: "wsFetchGroupList" });
    return resOk(res, {
      groupId,
      groupName,
      roomKey,
    });
  } catch (err) {
    console.error(err);
    return resErr(res, BaseState.ServerErr);
  }
}

/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function findGroupMembers(req, res) {
  const { groupId, roomKey } = req.query;
  if (!groupId || !roomKey) {
    return resErr(res, BaseState.ParamErr);
  }
  try {
    const groupMembers = await selectGroupMembers(groupId, roomKey);
    return resOk(res, groupMembers);
  } catch (err) {
    console.error(err);
    return resErr(res, BaseState.ServerErr);
  }
}
