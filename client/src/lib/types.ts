export interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  model: string;
  workspace: string;
  identity: {
    name: string;
    creature?: string;
    vibe?: string;
    emoji?: string;
    theme?: string;
    role?: string;
  };
  stats: {
    sessionCount: number;
    skillCount: number;
    workspaceFiles: number;
    lastActivity?: string;
  };
}

export interface WorkspaceFile {
  name: string;
  size: number;
  modified: string;
}

export interface SessionMeta {
  id: string;
  agentId: string;
  channel?: string;
  createdAt?: string;
  lastMessageAt?: string;
  messageCount?: number;
}

export interface GatewayStatus {
  running: boolean;
  port: number;
  uptime?: number;
  agents?: string[];
}

export interface Skill {
  name: string;
  scope: "workspace" | "global" | "bundled";
  agentId?: string;
}
