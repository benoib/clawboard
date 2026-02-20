import { WebSocketServer, WebSocket as WsWebSocket } from "ws";
import type { Server } from "http";
import { spawn } from "child_process";
import {
  appendMessage,
  loadHistory,
  parseMentions,
  getAgentAliases,
  type WarRoomMessage,
} from "../lib/warroom.js";

const OPENCLAW_WRAPPER = "/home/benoit/clawboard/run-openclaw.sh";

const clients = new Set<WsWebSocket>();

function broadcast(data: unknown) {
  const json = JSON.stringify(data);
  for (const c of clients) {
    if (c.readyState === WsWebSocket.OPEN) c.send(json);
  }
}

async function sendToAgent(agentId: string, content: string, userMsgId: string) {
  const aliases = await getAgentAliases();
  const agent = aliases.find((a) => a.id === agentId);
  if (!agent) return;

  const replyId = crypto.randomUUID();
  broadcast({ type: "typing", agentId, name: agent.name, emoji: agent.emoji });

  const sessionId = `warroom-${agentId}`;
  const args = ["agent", "--message", content, "--json", "--session-id", sessionId, "--agent", agentId];
  const proc = spawn(OPENCLAW_WRAPPER, args, { timeout: 120_000 });

  let stdout = "";
  let stderr = "";

  proc.stdout.on("data", (chunk: Buffer) => {
    stdout += chunk.toString();
  });

  proc.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
    console.log(`[warroom] ${agentId} stderr:`, chunk.toString().trim());
  });

  proc.on("close", async (code) => {
    let responseText = "";

    if (code === 0 && stdout.trim()) {
      try {
        const result = JSON.parse(stdout.trim());
        const payloads = result.result?.payloads;
        if (Array.isArray(payloads) && payloads.length > 0) {
          responseText = payloads.map((p: { text?: string }) => p.text).filter(Boolean).join("\n");
        }
        if (!responseText) {
          responseText = result.text || result.message || result.content || stdout.trim();
        }
      } catch {
        responseText = stdout.trim();
      }
    } else {
      responseText = stderr.trim() || stdout.trim() || `Agent returned exit code ${code}`;
    }

    if (responseText) {
      const agentMsg: WarRoomMessage = {
        id: replyId,
        ts: new Date().toISOString(),
        sender: { type: "agent", id: agentId, name: agent.name, emoji: agent.emoji },
        content: responseText,
        replyTo: userMsgId,
      };
      await appendMessage(agentMsg);
      broadcast({ type: "message", message: agentMsg });
    }

    broadcast({ type: "done", agentId });
  });

  proc.on("error", (err) => {
    broadcast({ type: "error", agentId, error: err.message });
    broadcast({ type: "done", agentId });
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
