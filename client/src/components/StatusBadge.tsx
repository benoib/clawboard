interface Props {
  status: "active" | "scaffolded" | "deprecated" | "idle";
  label?: string;
}

const styles = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  scaffolded: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  deprecated: "bg-red-500/15 text-red-400 border-red-500/30",
  idle: "bg-neutral-500/15 text-neutral-400 border-neutral-500/30",
};

export default function StatusBadge({ status, label }: Props) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${
        status === "active" ? "bg-emerald-400" :
        status === "scaffolded" ? "bg-amber-400" :
        status === "deprecated" ? "bg-red-400" : "bg-neutral-400"
      }`} />
      {label || status}
    </span>
  );
}
