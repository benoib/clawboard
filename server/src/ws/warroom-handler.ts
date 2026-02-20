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
const MAX_DEBATE_ROUNDS = 3;
const MAX_DEBATE_AGENTS = 5;

const clients = new Set<WsWebSocket>();

function broadcast(data: unknown) {
  const json = JSON.stringify(data);
  for (const c of clients) {
    if (c.readyState === WsWebSocket.OPEN) c.send(json);
  }
}

// ── Core: run a single agent turn via CLI ──────────────────────────

interface TurnResult {
  text: string;
  durationMs?: number;
  model?: string;
  usage?: { input: number; output: number; total: number };
}

async function runTurn(agentId: string, message: string): Promise<TurnResult> {
  const sessionId = `warroom-${agentId}`;
  const args = ["agent", "--message", message, "--json", "--session-id", sessionId, "--agent", agentId];

  return new Promise((resolve) => {
    const proc = spawn(OPENCLAW_WRAPPER, args, { timeout: 120_000 });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (c: Buffer) => { stdout += c.toString(); });
    proc.stderr.on("data", (c: Buffer) => { stderr += c.toString(); });

    proc.on("close", (code) => {
      if (code === 0 && stdout.trim()) {
        try {
          const result = JSON.parse(stdout.trim());
          const payloads = result.result?.payloads;
          const text = Array.isArray(payloads) && payloads.length > 0
            ? payloads.map((p: { text?: string }) => p.text).filter(Boolean).join("\n")
            : result.text || result.message || result.content || stdout.trim();
          const meta = result.result?.meta;
          resolve({
            text,
            durationMs: meta?.durationMs,
            model: meta?.agentMeta?.model,
            usage: meta?.agentMeta?.usage,
          });
        } catch {
          resolve({ text: stdout.trim() });
        }
      } else {
        resolve({ text: stderr.trim() || stdout.trim() || `Exit code ${code}` });
      }
    });

    proc.on("error", (err) => resolve({ text: `Error: ${err.message}` }));
  });
}

// ── Helpers ─────────────────────────────────────────────────────────

interface AgentAlias { id: string; name: string; emoji: string }

async function resolveAgent(id: string): Promise<AgentAlias | undefined> {
  const aliases = await getAgentAliases();
  return aliases.find((a) => a.id === id);
}

function makeAgentMsg(
  agentId: string, agent: AgentAlias, text: string,
  opts: { replyTo?: string; threadId?: string; round?: number; meta?: WarRoomMessage["meta"] }
): WarRoomMessage {
  return {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    sender: { type: "agent", id: agentId, name: agent.name, emoji: agent.emoji },
    content: text,
    ...opts,
  };
}

function makeSystemMsg(text: string, opts: { threadId?: string; round?: number; meta?: WarRoomMessage["meta"] }): WarRoomMessage {
  return {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    sender: { type: "system" },
    content: text,
    ...opts,
  };
}

// ── One-shot mode (existing behavior) ──────────────────────────────

async function handleOneShot(content: string, targets: string[], userMsgId: string) {
  for (const agentId of targets) {
    const agent = await resolveAgent(agentId);
    if (!agent) continue;

    broadcast({ type: "typing", agentId, name: agent.name, emoji: agent.emoji });

    const result = await runTurn(agentId, content);
    const msg = makeAgentMsg(agentId, agent, result.text, { replyTo: userMsgId });
    await appendMessage(msg);
    broadcast({ type: "message", message: msg });
    broadcast({ type: "done", agentId });
  }
}

// ── Debate mode ────────────────────────────────────────────────────

interface DebateConfig {
  targets: string[];
  userText: string;
  userMsgId: string;
  threadId: string;
  rounds: number;
  synthesize: boolean;
  moderator: string;
}

async function handleDebate(config: DebateConfig) {
  const { targets, userText, userMsgId, threadId, rounds, synthesize, moderator } = config;

  const agents: Record<string, AgentAlias> = {};
  for (const id of targets) {
    const a = await resolveAgent(id);
    if (a) agents[id] = a;
  }
  if (Object.keys(agents).length < 2) {
    const sysMsg = makeSystemMsg("Debate requires at least 2 agents.", { threadId });
    await appendMessage(sysMsg);
    broadcast({ type: "message", message: sysMsg });
    return;
  }

  const startMsg = makeSystemMsg(
    `⚔️ Debate started — ${Object.values(agents).map(a => `${a.emoji} ${a.name}`).join(" vs ")} — ${rounds} round${rounds > 1 ? "s" : ""}`,
    { threadId, round: -1, meta: { mode: "debate", maxRounds: rounds, targets } }
  );
  await appendMessage(startMsg);
  broadcast({ type: "message", message: startMsg });

  // Round 0: initial replies (parallel)
  const lastResponses: Record<string, string> = {};

  const round0 = await Promise.all(
    targets.map(async (agentId) => {
      broadcast({ type: "typing", agentId, name: agents[agentId].name, emoji: agents[agentId].emoji });
      const result = await runTurn(agentId, userText);
      lastResponses[agentId] = result.text;
      return { agentId, result };
    })
  );

  for (const { agentId, result } of round0) {
    const msg = makeAgentMsg(agentId, agents[agentId], result.text, {
      replyTo: userMsgId, threadId, round: 0,
      meta: { mode: "debate", targets },
    });
    await appendMessage(msg);
    broadcast({ type: "message", message: msg });
    broadcast({ type: "done", agentId });
  }

  // Rounds 1..N: cross-feed
  for (let r = 1; r <= rounds; r++) {
    const roundLabel = makeSystemMsg(`— Round ${r}/${rounds} —`, { threadId, round: r });
    await appendMessage(roundLabel);
    broadcast({ type: "message", message: roundLabel });

    const roundResults = await Promise.all(
      targets.map(async (agentId) => {
        const otherTexts = targets
          .filter((id) => id !== agentId)
          .map((id) => `**${agents[id].emoji} ${agents[id].name}** said:\n${lastResponses[id]}`)
          .join("\n\n---\n\n");

        const relayPrompt = [
          `War Room relay (round ${r}/${rounds}).`,
          ``,
          `Context: ${userText}`,
          ``,
          otherTexts,
          ``,
          `Your task:`,
          `- Respond directly to the points above`,
          `- Challenge weak assumptions, build on strong ones`,
          `- Be specific and actionable`,
          `- Keep it concise (≤ 8 bullets)`,
        ].join("\n");

        broadcast({ type: "typing", agentId, name: agents[agentId].name, emoji: agents[agentId].emoji });
        const result = await runTurn(agentId, relayPrompt);
        lastResponses[agentId] = result.text;
        return { agentId, result };
      })
    );

    for (const { agentId, result } of roundResults) {
      const msg = makeAgentMsg(agentId, agents[agentId], result.text, {
        threadId, round: r,
        meta: { mode: "debate", targets },
      });
      await appendMessage(msg);
      broadcast({ type: "message", message: msg });
      broadcast({ type: "done", agentId });
    }
  }

  // Synthesis turn
  if (synthesize) {
    const modAgent = agents[moderator] || Object.values(agents)[0];
    const modId = modAgent ? targets.find(id => agents[id] === modAgent) || targets[0] : targets[0];

    const synthLabel = makeSystemMsg(`— Synthesis by ${modAgent.emoji} ${modAgent.name} —`, { threadId, round: rounds + 1 });
    await appendMessage(synthLabel);
    broadcast({ type: "message", message: synthLabel });

    const transcript = targets
      .map((id) => `**${agents[id].emoji} ${agents[id].name}** (final position):\n${lastResponses[id]}`)
      .join("\n\n---\n\n");

    const synthPrompt = [
      `You are the moderator wrapping up a War Room debate.`,
      ``,
      `Original question: ${userText}`,
      ``,
      `Final positions:`,
      transcript,
      ``,
      `Produce exactly 3 decisions. For each: (1) the decision, (2) why now, (3) first concrete test this week.`,
      `Be decisive — pick sides where the debate was split.`,
    ].join("\n");

    broadcast({ type: "typing", agentId: modId, name: modAgent.name, emoji: modAgent.emoji });
    const synthResult = await runTurn(modId, synthPrompt);

    const synthMsg = makeAgentMsg(modId, modAgent, synthResult.text, {
      threadId, round: rounds + 1,
      meta: { mode: "debate", targets, synthesis: true },
    });
    await appendMessage(synthMsg);
    broadcast({ type: "message", message: synthMsg });
    broadcast({ type: "done", agentId: modId });
  }

  const endMsg = makeSystemMsg(`⚔️ Debate complete.`, { threadId });
  await appendMessage(endMsg);
  broadcast({ type: "message", message: endMsg });
}

// ── Parse /debate command ──────────────────────────────────────────

interface ParsedDebate {
  isDebate: true;
  targets: string[];
  rounds: number;
  synthesize: boolean;
  moderator: string;
  userText: string;
}

async function parseDebateCommand(content: string): Promise<ParsedDebate | null> {
  const debateMatch = content.match(/^\/debate\s+/i);
  if (!debateMatch) return null;

  const body = content.slice(debateMatch[0].length);

  const mentioned = await parseMentions(body);
  if (mentioned.length < 2) {
    const aliases = await getAgentAliases();
    if (mentioned.length === 0) {
      mentioned.push(...aliases.map(a => a.id));
    } else {
      for (const a of aliases) {
        if (!mentioned.includes(a.id)) { mentioned.push(a.id); break; }
      }
    }
  }

  let rounds = 1;
  const roundsMatch = body.match(/rounds?[=:\s]*(\d+)/i);
  if (roundsMatch) rounds = Math.min(parseInt(roundsMatch[1]), MAX_DEBATE_ROUNDS);

  const noSynth = /no[- ]?synth/i.test(body);
  const synthesize = !noSynth;

  const modMatch = body.match(/mod(?:erator)?[=:\s]*@?(\w+)/i);
  const moderator = modMatch ? modMatch[1] : mentioned[0];

  const textCleaned = body
    .replace(/@\w+/g, "")
    .replace(/rounds?[=:\s]*\d+/gi, "")
    .replace(/no[- ]?synth/gi, "")
    .replace(/mod(?:erator)?[=:\s]*@?\w+/gi, "")
    .trim();

  return {
    isDebate: true,
    targets: mentioned.slice(0, MAX_DEBATE_AGENTS),
    rounds,
    synthesize,
    moderator,
    userText: textCleaned || "Discuss and debate.",
  };
}

// ── WebSocket server ───────────────────────────────────────────────

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
        if (data.type !== "send") return;

        const content: string = data.content?.trim();
        if (!content) return;

        const debate = await parseDebateCommand(content);

        if (debate) {
          const threadId = `debate-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

          const userMsg: WarRoomMessage = {
            id: crypto.randomUUID(),
            ts: new Date().toISOString(),
            sender: { type: "user", name: "Ben" },
            content,
            targets: debate.targets,
            threadId,
            meta: { mode: "debate", maxRounds: debate.rounds, targets: debate.targets },
          };
          await appendMessage(userMsg);
          broadcast({ type: "message", message: userMsg });

          handleDebate({
            targets: debate.targets,
            userText: debate.userText,
            userMsgId: userMsg.id,
            threadId,
            rounds: debate.rounds,
            synthesize: debate.synthesize,
            moderator: debate.moderator,
          });
        } else {
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

          handleOneShot(content, targets, userMsg.id);
        }
      } catch { /* ignore bad messages */ }
    });

    ws.on("close", () => {
      clients.delete(ws);
    });
  });

  console.log("War Room WebSocket attached at /ws/warroom");
}
