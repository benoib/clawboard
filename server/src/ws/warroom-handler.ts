import { WebSocketServer, WebSocket as WsWebSocket } from "ws";
import type { Server } from "http";
import GatewayWebSocket from "ws";
import {
  appendMessage,
  loadHistory,
  parseMentions,
  getAgentAliases,
  type WarRoomMessage,
} from "../lib/warroom.js";

const GATEWAY_PORT = process.env.GATEWAY_PORT || "18789";
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || "";

function gwUrl() {
  const base = `ws://127.0.0.1:${GATEWAY_PORT}`;
  return GATEWAY_TOKEN ? `${base}?token=${GATEWAY_TOKEN}` : base;
}

const clients = new Set<WsWebSocket>();

function broadcast(data: unknown) {
  const json = JSON.stringify(data);
  for (const c of clients) {
    if (c.readyState === WsWebSocket.OPEN) c.send(json);
  }
}

async function sendToAgent(
  agentId: string,
  content: string,
  userMsgId: string,
) {
  const aliases = await getAgentAliases();
  const agent = aliases.find((a) => a.id === agentId);
  if (!agent) return;

  const replyId = crypto.randomUUID();

  broadcast({
    type: "typing",
    agentId,
    name: agent.name,
    emoji: agent.emoji,
  });

  const gw = new GatewayWebSocket(gwUrl());
  const reqId = crypto.randomUUID();
  let fullContent = "";

  const timeout = setTimeout(() => {
    gw.close();
    broadcast({ type: "error", agentId, error: "Gateway timeout" });
  }, 120_000);

  gw.on("open", () => {
    gw.send(JSON.stringify({
      type: "req",
      id: reqId,
      method: "chat.send",
      params: { agentId, message: content },
    }));
  });

  gw.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === "event" && msg.event === "chat") {
        const payload = msg.payload;
        if (payload?.type === "text-delta" || payload?.type === "content_block_delta") {
          const delta = payload.delta?.text || payload.text || "";
          if (delta) {
            fullContent += delta;
            broadcast({ type: "chunk", agentId, msgId: replyId, content: delta });
          }
        }
        if (payload?.type === "response" || payload?.type === "message_stop") {
          if (payload.text && !fullContent) fullContent = payload.text;
        }
      }

      if (msg.type === "res" && msg.id === reqId) {
        clearTimeout(timeout);

        if (msg.ok && msg.payload?.text && !fullContent) {
          fullContent = msg.payload.text;
        }

        if (fullContent) {
          const agentMsg: WarRoomMessage = {
            id: replyId,
            ts: new Date().toISOString(),
            sender: { type: "agent", id: agentId, name: agent.name, emoji: agent.emoji },
            content: fullContent,
            replyTo: userMsgId,
          };
          appendMessage(agentMsg);
          broadcast({ type: "message", message: agentMsg });
        }

        broadcast({ type: "done", agentId });
        gw.close();
      }
    } catch { /* ignore parse errors */ }
  });

  gw.on("error", () => {
    clearTimeout(timeout);
    broadcast({ type: "error", agentId, error: "Gateway connection failed" });
  });
}

export function attachWarRoom(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws/warroom" });

  wss.on("connection", async (ws) => {
    clients.add(ws);

    const history = await loadHistory();
    ws.send(JSON.stringify({ type: "history", messages: history }));

    const aliases = await getAgentAliases();
    ws.send(JSON.stringify({ type: "agents", agents: aliases }));

    ws.on("message", async (raw) => {
      try {
        const data = JSON.parse(raw.toString());

        if (data.type === "send") {
          const content: string = data.content?.trim();
          if (!content) return;

          const mentioned = await parseMentions(content);
          const targets = mentioned.length > 0 ? mentioned : aliases.map((a) => a.id);

          const userMsg: WarRoomMessage = {
            id: crypto.randomUUID(),
            ts: new Date().toISOString(),
            sender: { type: "user", name: "Ben" },
            content,
            targets,
          };

          await appendMessage(userMsg);
          broadcast({ type: "message", message: userMsg });

          for (const agentId of targets) {
            sendToAgent(agentId, content, userMsg.id);
          }
        }
      } catch { /* ignore bad messages */ }
    });

    ws.on("close", () => {
      clients.delete(ws);
    });
  });

  console.log("War Room WebSocket attached at /ws/warroom");
}
