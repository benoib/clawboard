import { useState, useEffect } from "react";
import { useParams, NavLink } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useApi, apiFetch } from "@/hooks/useApi";
import type { Agent, WorkspaceFile } from "@/lib/types";

export default function Workspaces() {
  const { agentId } = useParams();
  const { data: agents, loading } = useApi<Agent[]>("/agents");

  const selectedId = agentId || agents?.[0]?.id;

  if (loading) return <WorkspaceSkeleton />;
  if (!agents?.length) return <p className="text-neutral-500">No agents found.</p>;

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 space-y-1">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Workspaces
        </h2>
        {agents.map((a) => (
          <NavLink
            key={a.id}
            to={`/workspaces/${a.id}`}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all duration-200 ${
                isActive
                  ? "bg-gold/10 text-gold border-l-2 border-gold"
                  : "text-neutral-400 hover:bg-surface-elevated/50 hover:text-neutral-200 border-l-2 border-transparent"
              }`
            }
          >
            <span className="text-base">{a.emoji}</span>
            <div>
              <p className="font-medium">{a.identity.name || a.name}</p>
              <p className="text-[10px] text-neutral-600">{a.identity.role || a.role || ""}</p>
            </div>
          </NavLink>
        ))}
      </aside>

      {/* Content */}
      {selectedId && <WorkspaceContent agentId={selectedId} agents={agents} />}
    </div>
  );
}

function WorkspaceContent({ agentId, agents }: { agentId: string; agents: Agent[] }) {
  const agent = agents.find((a) => a.id === agentId);
  const { data: files, loading } = useApi<WorkspaceFile[]>(`/agents/${agentId}/workspace`);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [editContent, setEditContent] = useState("");
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [saving, setSaving] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);

  useEffect(() => {
    setSelectedFile(null);
    setContent("");
    setMode("preview");
  }, [agentId]);

  useEffect(() => {
    if (files?.length && !selectedFile) {
      loadFile(files[0].name);
    }
  }, [files]);

  async function loadFile(name: string) {
    setSelectedFile(name);
    setMode("preview");
    setFileLoading(true);
    try {
      const data = await apiFetch<{ content: string }>(`/agents/${agentId}/workspace/${name}`);
      setContent(data.content);
      setEditContent(data.content);
    } catch {
      setContent("*Failed to load file*");
    } finally {
      setFileLoading(false);
    }
  }

  async function handleSave() {
    if (!selectedFile) return;
    setSaving(true);
    try {
      await apiFetch(`/agents/${agentId}/workspace/${selectedFile}`, {
        method: "PUT",
        body: JSON.stringify({ content: editContent }),
      });
      setContent(editContent);
      setMode("preview");
    } catch {
      alert("Save failed");
    } finally {
      setSaving(false);
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes}b`;
    return `${(bytes / 1024).toFixed(1)}kb`;
  }

  if (!agent) return <p className="text-neutral-500">Agent not found.</p>;

  return (
    <div className="min-w-0 flex-1 space-y-4">
      {/* Agent header */}
      <div className="flex items-center gap-4 rounded-2xl border border-border-subtle bg-surface-card p-4 shadow-glow">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-elevated text-2xl ring-2 ring-gold/30">
          {agent.emoji}
        </div>
        <div>
          <h2 className="text-lg font-bold">{agent.identity.name || agent.name}</h2>
          <p className="text-xs text-neutral-500">
            {agent.identity.creature || agent.identity.theme || agent.role}
          </p>
        </div>
        <code className="ml-auto rounded-lg bg-surface-elevated px-2 py-1 text-[10px] text-neutral-600">
          {agent.workspace}
        </code>
      </div>

      <div className="flex gap-4">
        {/* File list */}
        <div className="w-48 shrink-0 space-y-1">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Files
          </h3>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 animate-pulse rounded-xl bg-surface-card" />
              ))}
            </div>
          ) : (
            files?.map((f) => (
              <button
                key={f.name}
                onClick={() => loadFile(f.name)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-all duration-200 ${
                  selectedFile === f.name
                    ? "bg-gold/10 text-gold"
                    : "text-neutral-400 hover:bg-surface-elevated/50 hover:text-neutral-200"
                }`}
              >
                <span className="truncate font-medium">{f.name}</span>
                <span className="text-[10px] text-neutral-600">{formatSize(f.size)}</span>
              </button>
            ))
          )}
        </div>

        {/* File content */}
        <div className="min-w-0 flex-1 rounded-2xl border border-border-subtle bg-surface-card shadow-glow">
          {/* Tab bar */}
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
            <span className="text-sm font-medium text-neutral-300">{selectedFile || "Select a file"}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMode("preview")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  mode === "preview" ? "bg-gold/15 text-gold" : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => { setMode("edit"); setEditContent(content); }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  mode === "edit" ? "bg-gold/15 text-gold" : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                Edit
              </button>
              {mode === "edit" && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="ml-2 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-surface-base transition-all hover:bg-gold-hover disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              )}
            </div>
          </div>

          {/* Content area */}
          <div className="p-5">
            {fileLoading ? (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-4 animate-pulse rounded bg-surface-elevated" style={{ width: `${60 + Math.random() * 40}%` }} />
                ))}
              </div>
            ) : mode === "preview" ? (
              <div className="prose prose-invert prose-sm max-w-none prose-headings:text-neutral-100 prose-p:text-neutral-300 prose-strong:text-gold prose-code:rounded-lg prose-code:bg-surface-elevated prose-code:px-1.5 prose-code:py-0.5 prose-code:text-neutral-300 prose-li:text-neutral-300 prose-ul:text-neutral-300">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
            ) : (
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="h-[500px] w-full resize-none rounded-xl border border-border-subtle bg-surface-elevated p-4 font-mono text-sm text-neutral-200 outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20"
                spellCheck={false}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="flex gap-6">
      <div className="w-56 space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-xl bg-surface-card" />
        ))}
      </div>
      <div className="flex-1">
        <div className="h-20 animate-pulse rounded-2xl bg-surface-card" />
      </div>
    </div>
  );
}
