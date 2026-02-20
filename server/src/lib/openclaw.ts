import fs from "fs/promises";
import path from "path";

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(process.env.HOME || "/root", ".openclaw");
const CONFIG_FILE = path.join(OPENCLAW_HOME, "openclaw.json");

const WORKSPACE_FILES = [
  "SOUL.md", "IDENTITY.md", "USER.md", "AGENTS.md",
  "TOOLS.md", "MEMORY.md", "HEARTBEAT.md", "BOOTSTRAP.md",
];

const SENSITIVE_KEYS = ["botToken", "token", "apiKey", "password", "secret"];

function sanitize(obj: unknown): unknown {
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s.toLowerCase()))) {
      out[k] = "***";
    } else {
      out[k] = sanitize(v);
    }
  }
  return out;
}

export async function readConfig(): Promise<Record<string, unknown>> {
  const raw = await fs.readFile(CONFIG_FILE, "utf-8");
  return JSON.parse(raw);
}

export async function readConfigSanitized(): Promise<Record<string, unknown>> {
  return sanitize(await readConfig()) as Record<string, unknown>;
}

interface AgentEntry {
  id: string;
  name?: string;
  workspace?: string;
  agentDir?: string;
  model?: string;
  identity?: { name?: string; theme?: string; emoji?: string };
}

export async function getAgents() {
  const config = await readConfig();
  const agents = config.agents as { defaults?: Record<string, unknown>; list?: AgentEntry[] } | undefined;
  const list: AgentEntry[] = agents?.list || [{ id: "main" }];
  const defaultModel = (agents?.defaults as Record<string, unknown>)?.model as { primary?: string } | string | undefined;
  const primaryModel = typeof defaultModel === "object" ? defaultModel?.primary : defaultModel;

  return Promise.all(
    list.map(async (entry) => {
      const id = entry.id;
      const workspaceDir = entry.workspace || (id === "main"
        ? path.join(OPENCLAW_HOME, "workspace")
        : path.join(OPENCLAW_HOME, `workspace-${id}`));
      const agentDir = path.join(OPENCLAW_HOME, "agents", id);

      const identity = await readIdentity(workspaceDir, entry);
      const stats = await getAgentStats(id, workspaceDir, agentDir);

      return {
        id,
        name: entry.identity?.name || entry.name || id,
        emoji: entry.identity?.emoji || identity.emoji || (id === "main" ? "🦞" : "🤖"),
        role: entry.identity?.theme || identity.role || "",
        model: entry.model || primaryModel || "unknown",
        workspace: workspaceDir,
        identity,
        stats,
      };
    })
  );
}

async function readIdentity(workspaceDir: string, entry: AgentEntry) {
  try {
    const raw = await fs.readFile(path.join(workspaceDir, "IDENTITY.md"), "utf-8");
    const name = raw.match(/\*\*Name:\*\*\s*(.+)/)?.[1]?.trim() || entry.name || entry.id;
    const creature = raw.match(/\*\*Creature:\*\*\s*(.+)/)?.[1]?.trim();
    const vibe = raw.match(/\*\*Vibe:\*\*\s*(.+)/)?.[1]?.trim();
    const emoji = raw.match(/\*\*Emoji:\*\*\s*(.+)/)?.[1]?.trim();
    const role = raw.match(/\*\*Role:\*\*\s*(.+)/)?.[1]?.trim();
    const theme = raw.match(/\*\*Theme:\*\*\s*(.+)/)?.[1]?.trim();
    return { name, creature, vibe, emoji, role, theme };
  } catch {
    return { name: entry.identity?.name || entry.name || entry.id, emoji: entry.identity?.emoji };
  }
}

async function getAgentStats(id: string, workspaceDir: string, agentDir: string) {
  let sessionCount = 0;
  let lastActivity: string | undefined;
  try {
    const sessionsFile = path.join(agentDir, "sessions", "sessions.json");
    const raw = await fs.readFile(sessionsFile, "utf-8");
    const data = JSON.parse(raw);
    const sessions = data.sessions || data;
    if (Array.isArray(sessions)) {
      sessionCount = sessions.length;
      const sorted = sessions
        .filter((s: Record<string, unknown>) => s.lastMessageAt || s.updatedAt)
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
          new Date(b.lastMessageAt as string || b.updatedAt as string).getTime() -
          new Date(a.lastMessageAt as string || a.updatedAt as string).getTime()
        );
      if (sorted.length) lastActivity = (sorted[0].lastMessageAt || sorted[0].updatedAt) as string;
    } else if (typeof sessions === "object") {
      sessionCount = Object.keys(sessions).length;
    }
  } catch { /* no sessions yet */ }

  let skillCount = 0;
  try {
    const skillsDir = path.join(workspaceDir, "skills");
    const entries = await fs.readdir(skillsDir);
    skillCount = entries.filter((e) => !e.startsWith(".")).length;
  } catch { /* no skills */ }

  let workspaceFiles = 0;
  try {
    const entries = await fs.readdir(workspaceDir);
    workspaceFiles = entries.filter((e) => e.endsWith(".md")).length;
  } catch { /* no workspace */ }

  return { sessionCount, skillCount, workspaceFiles, lastActivity };
}

export async function getWorkspaceFiles(agentId: string) {
  const agents = await getAgents();
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) throw new Error(`Agent ${agentId} not found`);

  const dir = agent.workspace;
  const results: { name: string; size: number; modified: string }[] = [];

  for (const file of WORKSPACE_FILES) {
    try {
      const stat = await fs.stat(path.join(dir, file));
      results.push({ name: file, size: stat.size, modified: stat.mtime.toISOString() });
    } catch { /* file doesn't exist */ }
  }

  return results;
}

export async function readWorkspaceFile(agentId: string, fileName: string) {
  if (!WORKSPACE_FILES.includes(fileName) && !fileName.startsWith("memory/")) {
    throw new Error(`File ${fileName} not allowed`);
  }
  const agents = await getAgents();
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) throw new Error(`Agent ${agentId} not found`);
  return fs.readFile(path.join(agent.workspace, fileName), "utf-8");
}

export async function writeWorkspaceFile(agentId: string, fileName: string, content: string) {
  if (!WORKSPACE_FILES.includes(fileName)) {
    throw new Error(`File ${fileName} not writable`);
  }
  const agents = await getAgents();
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) throw new Error(`Agent ${agentId} not found`);
  await fs.writeFile(path.join(agent.workspace, fileName), content, "utf-8");
}

export async function getAgentSkills(agentId: string) {
  const agents = await getAgents();
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) throw new Error(`Agent ${agentId} not found`);

  const skills: { name: string; scope: string }[] = [];
  try {
    const entries = await fs.readdir(path.join(agent.workspace, "skills"));
    for (const e of entries) {
      if (!e.startsWith(".")) skills.push({ name: e, scope: "workspace" });
    }
  } catch { /* no skills dir */ }
  return skills;
}

export async function getGlobalSkills() {
  const skills: { name: string; scope: string }[] = [];
  try {
    const entries = await fs.readdir(path.join(OPENCLAW_HOME, "skills"));
    for (const e of entries) {
      if (!e.startsWith(".")) skills.push({ name: e, scope: "global" });
    }
  } catch { /* no global skills */ }
  return skills;
}

export async function getMemoryFiles(agentId: string) {
  const agents = await getAgents();
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) throw new Error(`Agent ${agentId} not found`);

  const memDir = path.join(agent.workspace, "memory");
  try {
    const entries = await fs.readdir(memDir);
    return entries.filter((e) => e.endsWith(".md")).sort().reverse();
  } catch {
    return [];
  }
}
