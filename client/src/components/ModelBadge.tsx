interface Props {
  model: string;
}

const modelColors: Record<string, string> = {
  opus: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  sonnet: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  haiku: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  gpt: "bg-green-500/15 text-green-300 border-green-500/30",
  gemini: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  llama: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  minimax: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

function getColor(model: string) {
  const lower = model.toLowerCase();
  for (const [key, val] of Object.entries(modelColors)) {
    if (lower.includes(key)) return val;
  }
  return "bg-neutral-500/15 text-neutral-300 border-neutral-500/30";
}

function shortName(model: string) {
  const parts = model.split("/");
  const name = parts[parts.length - 1];
  return name
    .replace("claude-", "")
    .replace("openai-codex/", "")
    .replace(/-/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function ModelBadge({ model }: Props) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${getColor(model)}`}>
      {shortName(model)}
    </span>
  );
}
