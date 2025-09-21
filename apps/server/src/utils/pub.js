import query from "./query.js";

/**
 * @param {{ receiverId?: number, receiverEmail?: string, type: 'wsFetchFriendList' | 'wsFetchGroupList' | 'wsFetchChatList' | 'wsCreateRtcRoom' }} data
 */
export default async function pub(data) {
  let receiverEmail = data.receiverEmail;
  if (!receiverEmail) {
    const emailWraps = await query("select email from users where id = ?", [data.receiverId]);
    receiverEmail = emailWraps[0].email;
  }
  if (global.OnlineUsers[receiverEmail]) {
    global.OnlineUsers[receiverEmail].ws.send(JSON.stringify(data));
  }
}
