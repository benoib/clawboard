import { useApi } from "@/hooks/useApi";
import type { Agent } from "@/lib/types";
import ModelBadge from "@/components/ModelBadge";
import StatusBadge from "@/components/StatusBadge";
import { Link } from "react-router-dom";

export default function OrgChart() {
  const { data: agents, loading } = useApi<Agent[]>("/agents");

  if (loading) return <Skeleton />;
  if (!agents?.length) return <p className="text-neutral-500">No agents found.</p>;

  const mainAgent = agents.find((a) => a.id === "main");
  const chiefAgents = agents.filter((a) => a.id !== "main");
  const totalSkills = agents.reduce((s, a) => s + a.stats.skillCount, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">🏛 Organization Chart</h1>
        <p className="mt-1 text-sm text-neutral-500">Clearmud Labs — Operational Structure</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Agents" value={agents.length} color="gold" />
        <StatCard label="Active" value={agents.length} color="emerald" />
        <StatCard label="Total Skills" value={totalSkills} color="purple" />
        <StatCard
          label="Sessions"
          value={agents.reduce((s, a) => s + a.stats.sessionCount, 0)}
          color="sky"
        />
      </div>

      {/* Hierarchy */}
      <div className="flex flex-col items-center gap-0">
        {/* CEO */}
        <PersonCard
          name="Ben Bailey"
          role="CEO"
          subtitle="Vision · Strategy · Final Decisions"
          emoji="👤"
          gradient="from-gold/30 to-gold/5"
          large
        />
        <Connector />

        {/* COO / Main agent */}
        {mainAgent && (
          <>
            <AgentCardLarge agent={mainAgent} role="COO" subtitle="Research · Delegation · Execution · Orchestration" />
            <Connector />
          </>
        )}

        {/* Chiefs row */}
        {chiefAgents.length > 0 && (
          <div className="flex flex-wrap justify-center gap-4">
            {chiefAgents.map((a) => (
              <AgentCard key={a.id} agent={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const borderColors: Record<string, string> = {
    gold: "border-t-gold",
    emerald: "border-t-emerald-500",
    purple: "border-t-purple-500",
    sky: "border-t-sky-500",
  };
  const textColors: Record<string, string> = {
    gold: "text-gold",
    emerald: "text-emerald-400",
    purple: "text-purple-400",
    sky: "text-sky-400",
  };
  return (
    <div className={`rounded-2xl border border-border-subtle ${borderColors[color]} border-t-2 bg-surface-card p-4 shadow-glow transition-all hover:-translate-y-0.5`}>
      <p className={`text-2xl font-bold ${textColors[color]}`}>{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}

function PersonCard({
  name, role, subtitle, emoji, gradient, large,
}: {
  name: string; role: string; subtitle: string; emoji: string; gradient: string; large?: boolean;
}) {
  return (
    <div className={`rounded-2xl border border-border-subtle bg-gradient-to-b ${gradient} bg-surface-card shadow-glow ${large ? "w-80 p-6" : "w-64 p-4"}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-elevated text-xl ring-2 ring-gold/40">
          {emoji}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gold">{role}</p>
          <p className="font-semibold">{name}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-neutral-500">{subtitle}</p>
    </div>
  );
}

function AgentCardLarge({ agent, role, subtitle }: { agent: Agent; role: string; subtitle: string }) {
  return (
    <Link
      to={`/workspaces/${agent.id}`}
      className="group block w-96 rounded-2xl border border-border-subtle bg-gradient-to-b from-emerald-900/20 to-surface-card p-6 shadow-glow transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow-lg"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-elevated text-2xl ring-[3px] ring-emerald-500/50">
          {agent.emoji}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">{role}</p>
          <p className="text-lg font-bold">{agent.identity.name || agent.name}</p>
        </div>
        <div className="ml-auto">
          <ModelBadge model={agent.model} />
        </div>
      </div>
      <p className="mt-2 text-xs text-neutral-500">{subtitle}</p>
      <div className="mt-3 flex gap-3 text-xs text-neutral-500">
        <span>{agent.stats.sessionCount} sessions</span>
        <span>·</span>
        <span>{agent.stats.skillCount} skills</span>
      </div>
    </Link>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Link
      to={`/workspaces/${agent.id}`}
      className="group block w-72 rounded-2xl border border-border-subtle bg-surface-card p-5 shadow-glow transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow-lg"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-elevated text-xl ring-2 ring-gold/30">
          {agent.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{agent.identity.name || agent.name}</p>
            <ModelBadge model={agent.model} />
          </div>
          <p className="text-xs text-neutral-500">{agent.identity.role || agent.role || agent.identity.theme}</p>
        </div>
      </div>

      <p className="mt-2 text-xs text-neutral-400 line-clamp-2">
        {agent.identity.vibe || agent.identity.creature || ""}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <StatusBadge status="active" />
        <span className="text-xs text-neutral-600">{agent.stats.skillCount} skills</span>
      </div>
    </Link>
  );
}

function Connector() {
  return (
    <div className="flex h-8 items-center justify-center">
      <div className="h-full w-px border-l border-dashed border-neutral-700" />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-64 animate-pulse rounded-xl bg-surface-card" />
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface-card" />
        ))}
      </div>
      <div className="flex flex-col items-center gap-4">
        <div className="h-28 w-80 animate-pulse rounded-2xl bg-surface-card" />
        <div className="h-28 w-96 animate-pulse rounded-2xl bg-surface-card" />
        <div className="flex gap-4">
          <div className="h-36 w-72 animate-pulse rounded-2xl bg-surface-card" />
          <div className="h-36 w-72 animate-pulse rounded-2xl bg-surface-card" />
        </div>
      </div>
    </div>
  );
}
