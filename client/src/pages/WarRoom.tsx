import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { WarRoomMessage, WarRoomAgent } from "@/lib/types";

type TypingState = Record<string, { name: string; emoji: string }>;

export default function WarRoom() {
  const [messages, setMessages] = useState<WarRoomMessage[]>([]);
  const [agents, setAgents] = useState<WarRoomAgent[]>([]);
  const [typing, setTyping] = useState<TypingState>({});
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/warroom`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(() => window.location.reload(), 3000);
    };

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      switch (data.type) {
        case "history":
          setMessages(data.messages);
          setTimeout(scrollToBottom, 100);
          break;
        case "agents":
          setAgents(data.agents);
          break;
        case "message":
          setMessages((prev) => [...prev, data.message]);
          if (data.message.sender.type === "agent") {
            setTyping((t) => { const n = { ...t }; delete n[data.message.sender.id]; return n; });
          }
          scrollToBottom();
          break;
        case "typing":
          setTyping((t) => ({ ...t, [data.agentId]: { name: data.name, emoji: data.emoji } }));
          scrollToBottom();
          break;
        case "done":
          setTyping((t) => { const n = { ...t }; delete n[data.agentId]; return n; });
          break;
        case "error":
          setTyping((t) => { const n = { ...t }; delete n[data.agentId]; return n; });
          break;
      }
    };

    return () => ws.close();
  }, [scrollToBottom]);

  function send() {
    const text = input.trim();
    if (!text || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: "send", content: text }));
    setInput("");
    setShowMentions(false);
  }

  function handleInputChange(value: string) {
    setInput(value);
    const lastAt = value.lastIndexOf("@");
    if (lastAt >= 0) {
      const afterAt = value.slice(lastAt + 1);
      if (!afterAt.includes(" ")) {
        setShowMentions(true);
        setMentionFilter(afterAt.toLowerCase());
        return;
      }
    }
    setShowMentions(false);
  }

  function insertMention(agent: WarRoomAgent) {
    const lastAt = input.lastIndexOf("@");
    const before = input.slice(0, lastAt);
    setInput(`${before}@${agent.name.toLowerCase()} `);
    setShowMentions(false);
    inputRef.current?.focus();
  }

  const filteredAgents = agents.filter((a) =>
    a.name.toLowerCase().startsWith(mentionFilter) || a.id.toLowerCase().startsWith(mentionFilter)
  );

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4">
        <h1 className="text-xl font-bold tracking-tight">⚔️ War Room</h1>
        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
          connected
            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
            : "bg-red-500/15 text-red-400 border border-red-500/30"
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`} />
          {connected ? "Connected" : "Disconnected"}
        </span>
        {agents.length > 0 && (
          <div className="flex items-center gap-1 ml-2">
            {agents.map((a) => (
              <span key={a.id} className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-card text-sm ring-1 ring-border-subtle" title={a.name}>
                {a.emoji}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 rounded-2xl border border-border-subtle bg-surface-card/50 p-4">
        {messages.length === 0 && Object.keys(typing).length === 0 && (
          <div className="flex h-full items-center justify-center flex-col gap-2">
            <p className="text-neutral-600 text-sm">No messages yet. Start the conversation.</p>
            <p className="text-neutral-700 text-xs font-mono">/debate @bbot @rhormozi rounds=2 Your topic here</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Typing indicators */}
        {Object.entries(typing).map(([agentId, info]) => (
          <div key={`typing-${agentId}`} className="flex gap-3 items-start">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-sm ring-2 ring-neutral-600 animate-pulse">
              {info.emoji}
            </div>
            <div className="rounded-2xl rounded-tl-md bg-surface-elevated px-4 py-3">
              <p className="text-xs text-neutral-500">{info.name} is thinking…</p>
              <div className="mt-1 flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="relative pt-3">
        {showMentions && filteredAgents.length > 0 && (
          <div className="absolute bottom-full mb-1 left-0 w-64 rounded-xl border border-border-subtle bg-surface-card p-1 shadow-glow-lg">
            {filteredAgents.map((a) => (
              <button
                key={a.id}
                onClick={() => insertMention(a)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-300 hover:bg-surface-elevated transition-colors"
              >
                <span className="text-base">{a.emoji}</span>
                <span className="font-medium">{a.name}</span>
                <span className="text-xs text-neutral-600">@{a.id}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 rounded-full border border-border-subtle bg-surface-card px-4 py-2 focus-within:border-gold/40 focus-within:ring-1 focus-within:ring-gold/20 transition-all">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="/debate @bbot @rhormozi rounds=2 topic  ·  or just @bbot message"
            className="flex-1 bg-transparent text-sm text-neutral-200 outline-none placeholder:text-neutral-600"
            disabled={!connected}
          />
          <button
            onClick={send}
            disabled={!connected || !input.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-surface-base transition-all hover:bg-gold-hover disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Message rendering ──────────────────────────────────────────────

function MessageBubble({ message }: { message: WarRoomMessage }) {
  if (message.sender.type === "system") return <SystemMessage message={message} />;
  if (message.sender.type === "user") return <UserMessage message={message} />;
  return <AgentMessage message={message} />;
}

function SystemMessage({ message }: { message: WarRoomMessage }) {
  const isDebateStart = message.content.startsWith("⚔️ Debate started");
  const isDebateEnd = message.content === "⚔️ Debate complete.";
  const isRound = message.content.startsWith("— Round");
  const isSynthesis = message.content.startsWith("— Synthesis");

  return (
    <div className={`flex justify-center py-1 ${isDebateStart || isDebateEnd ? "py-2" : ""}`}>
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        isDebateStart
          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
          : isDebateEnd
          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          : isSynthesis
          ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
          : isRound
          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
          : "bg-neutral-800 text-neutral-500 border border-neutral-700"
      }`}>
        {message.content}
      </span>
    </div>
  );
}

function UserMessage({ message }: { message: WarRoomMessage }) {
  const isDebate = message.meta?.mode === "debate";
  return (
    <div className="flex justify-end">
      <div className="max-w-[70%]">
        <div className={`rounded-2xl rounded-br-md px-4 py-3 text-sm text-neutral-200 ${
          isDebate
            ? "border border-amber-500/30 bg-amber-500/10"
            : "border border-gold/20 bg-gold/10"
        }`}>
          {message.content}
        </div>
        <p className="mt-1 text-right text-[10px] text-neutral-600">
          {new Date(message.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          {message.targets && message.targets.length > 0 && (
            <span className="ml-1.5 text-neutral-700">→ {message.targets.join(", ")}</span>
          )}
          {isDebate && message.meta?.maxRounds && (
            <span className="ml-1.5 text-amber-600">{message.meta.maxRounds}R debate</span>
          )}
        </p>
      </div>
    </div>
  );
}

function AgentMessage({ message }: { message: WarRoomMessage }) {
  const sender = message.sender as { type: "agent"; id: string; name: string; emoji: string };
  const isSynthesis = message.meta?.synthesis;
  const round = message.round;

  return (
    <div className="flex gap-3 items-start">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-sm ring-2 ${
        isSynthesis ? "ring-purple-500/50" : "ring-emerald-500/30"
      }`}>
        {sender.emoji}
      </div>
      <div className="min-w-0 max-w-[75%]">
        <div className="mb-1 flex items-center gap-2">
          <span className={`text-xs font-medium ${isSynthesis ? "text-purple-400" : "text-emerald-400"}`}>
            {sender.name}
          </span>
          {round != null && round >= 0 && (
            <span className="text-[10px] text-neutral-600 font-mono">
              {isSynthesis ? "synthesis" : `R${round}`}
            </span>
          )}
        </div>
        <div className={`rounded-2xl rounded-tl-md px-4 py-3 text-sm text-neutral-200 ${
          isSynthesis
            ? "bg-purple-500/10 border border-purple-500/20"
            : "bg-surface-elevated"
        }`}>
          <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-headings:text-neutral-100 prose-strong:text-gold prose-code:bg-surface-base prose-code:rounded prose-code:px-1 prose-li:my-0.5">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        </div>
        <p className="mt-1 text-[10px] text-neutral-600">
          {new Date(message.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}
