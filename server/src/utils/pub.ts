import type { PubData, UserRecord } from "../types.js";
import db from "./query.js";

export default async function pub(data: PubData): Promise<void> {
  let receiverEmail = data.receiverEmail;
  if (!receiverEmail) {
    const emailWrap = await db<UserRecord>("users")
      .select("email")
      .where("id", Number(data.receiverId))
      .first();
    receiverEmail = emailWrap?.email;
  }
  if (receiverEmail && global.__online_users__[receiverEmail]) {
    global.__online_users__[receiverEmail].ws.send(JSON.stringify(data));
  }
}
