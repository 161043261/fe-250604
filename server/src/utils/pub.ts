import type { PubData, UserRecord } from "../types.js";
import query from "./query.js";

export default async function pub(data: PubData): Promise<void> {
  let receiverEmail = data.receiverEmail;
  if (!receiverEmail) {
    const emailWraps = await query<UserRecord[]>("select email from users where id = ?", [
      data.receiverId,
    ]);
    receiverEmail = emailWraps[0].email;
  }
  if (global.__online_users__[receiverEmail]) {
    global.__online_users__[receiverEmail].ws.send(JSON.stringify(data));
  }
}
