import fs from "fs/promises";
import { createReadStream } from "fs";
import { createInterface } from "readline";
import path from "path";
import { getAgents } from "./openclaw.js";

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(process.env.HOME || "/root", ".openclaw");
const LOG_FILE = path.join(OPENCLAW_HOME, "warroom.jsonl");

export interface WarRoomMessage {
  id: string;
  ts: string;
  sender:
    | { type: "user"; name: string }
    | { type: "agent"; id: string; name: string; emoji: string }
    | { type: "system" };
  content: string;
  targets?: string[];
  replyTo?: string;
  threadId?: string;
  round?: number;
  meta?: {
    mode?: "one-shot" | "debate";
    maxRounds?: number;
    targets?: string[];
    synthesis?: boolean;
  };
}

export async function appendMessage(msg: WarRoomMessage) {
  await fs.appendFile(LOG_FILE, JSON.stringify(msg) + "\n", "utf-8");
}

export async function loadHistory(limit = 200): Promise<WarRoomMessage[]> {
  try {
    await fs.access(LOG_FILE);
  } catch {
    return [];
  }

  const messages: WarRoomMessage[] = [];
  const rl = createInterface({ input: createReadStream(LOG_FILE, "utf-8"), crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      messages.push(JSON.parse(line));
    } catch { /* skip bad lines */ }
  }

  return messages.slice(-limit);
}

interface AgentAlias {
  id: string;
  aliases: string[];
  name: string;
  emoji: string;
}

let agentAliasCache: AgentAlias[] | null = null;

export async function getAgentAliases(): Promise<AgentAlias[]> {
  if (agentAliasCache) return agentAliasCache;
  const agents = await getAgents();
  agentAliasCache = agents.map((a) => ({
    id: a.id,
    name: a.identity.name || a.name,
    emoji: a.emoji,
    aliases: [
      a.id,
      (a.identity.name || a.name).toLowerCase(),
    ].filter(Boolean),
  }));
  setTimeout(() => { agentAliasCache = null; }, 60_000);
  return agentAliasCache;
}

export async function parseMentions(content: string): Promise<string[]> {
  const aliases = await getAgentAliases();
  const mentioned = new Set<string>();
  const mentionRegex = /@(\w+)/g;
  let match;
  while ((match = mentionRegex.exec(content)) !== null) {
    const token = match[1].toLowerCase();
    for (const a of aliases) {
      if (a.aliases.some((al) => al.toLowerCase() === token)) {
        mentioned.add(a.id);
      }
    }
  }
  return [...mentioned];
}
