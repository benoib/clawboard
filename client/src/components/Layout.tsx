import { NavLink, Outlet } from "react-router-dom";

const tabs = [
  { to: "/org", label: "Org Chart", icon: "🏛" },
  { to: "/workspaces", label: "Workspaces", icon: "📁" },
  { to: "/warroom", label: "War Room", icon: "⚔️" },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-surface-base">
      <header className="sticky top-0 z-50 border-b border-border-subtle bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-6">
          <NavLink to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-gold">
            🦞 Clawboard
          </NavLink>

          <nav className="flex items-center gap-1 rounded-full bg-surface-card/60 p-1">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-gold/15 text-gold shadow-sm"
                      : "text-neutral-400 hover:text-neutral-200 hover:bg-surface-elevated/50"
                  }`
                }
              >
                <span>{t.icon}</span>
                {t.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <GatewayIndicator />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}

function GatewayIndicator() {
  return (
    <div className="flex items-center gap-2 rounded-full bg-surface-card/60 px-3 py-1.5 text-xs">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="text-neutral-400">Gateway</span>
    </div>
  );
}
