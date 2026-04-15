import { createServer, type IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import app from "./router/index.js";
import { wsPub } from "./service/user.js";
import { createRtc } from "./service/rtc.js";
import { connChat } from "./service/chat.js";
import type { OnlineUsers, ChatRooms, RtcRooms } from "./types.js";

const port = 3000;

// Initialize global state
globalThis.__online_users__ = {} as OnlineUsers;
globalThis.__chat_rooms__ = {} as ChatRooms;
globalThis.__rtc_rooms__ = {} as RtcRooms;

// Create HTTP server from Koa app
const server = createServer(app.callback());

// Create WebSocket server
const wss = new WebSocketServer({
  server,
  maxPayload: 5 * 1024 * 1024 * 1024,
});

// WebSocket routing
wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  const url = req.url || "";
  const pathname = url.split("?")[0];
  const queryString = url.split("?")[1] || "";
  console.log("[WebSocket Request] pathname:", pathname, "queryString:", queryString);

  if (pathname === "/api/v1/user/pub") {
    // User pub WebSocket
    wsPub(ws, queryString);
  } else if (pathname === "/api/v1/rtc/create") {
    // RTC WebSocket
    createRtc(ws, queryString);
  } else if (pathname === "/api/v1/chat/conn") {
    // Chat WebSocket
    connChat(ws, queryString);
  } else {
    ws.close();
  }
});

server.listen(port, () => {
  console.log(`[server] http://localhost:${port}/`);
});
