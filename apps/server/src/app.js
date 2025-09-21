import expressWs from "express-ws";
import app from "./router/index.js";
import http from "node:http";

const port = 3000;

/**
 * @type {{ [email: string]: { ws: any, state: boolean } }}
 */
globalThis.OnlineUsers = {};

/**
 * @type {{ [roomKey: string]: { [receiverId: string]: any } }}
 */
globalThis.ChatRooms = {};

/**
 * @type {{ [roomKey: string]: { [email: string]: any }}}
 */
globalThis.RtcRooms = {};

app.listen(port, () => {
  console.log(`[server] http://localhost:${port}/`);
});

const server = http.createServer(app);
expressWs(app, server, {
  wsOptions: { maxPayload: 5 * 1024 * 1024 * 1024 },
});
