import { Header } from "@/components/dashboard/Header";
import { StatCard } from "@/components/dashboard/StatCard";

const agents = [
  { name: "CEO Agent", role: "Orchestrator", status: "idle", description: "Strategy & delegation" },
  { name: "Scout Agent", role: "Intelligence", status: "idle", description: "Trend monitoring" },
  { name: "Creative Agent", role: "Brand", status: "idle", description: "Channel identity & series" },
  { name: "Production Agent", role: "Production", status: "idle", description: "Script → Video pipeline" },
  { name: "Publisher Agent", role: "Publishing", status: "idle", description: "YouTube & TikTok upload" },
  { name: "Analytics Agent", role: "Analytics", status: "idle", description: "Performance & revenue" },
];

const niches = [
  { name: "Tech", phase: "Phase 1", status: "active", cpm: "$8–15" },
  { name: "World History", phase: "Phase 1", status: "active", cpm: "$4–8" },
  { name: "Movies", phase: "Phase 2", status: "planned", cpm: "$4–8" },
  { name: "Sports", phase: "Phase 2", status: "planned", cpm: "$3–6" },
  { name: "Current News", phase: "Month 6", status: "deferred", cpm: "$2–5" },
];

export default function DashboardPage() {
  return (
    <div>
      <Header
        title="CEO Overview"
        subtitle="PEMedia Autonomous Content Empire"
      />

      <div className="p-6 space-y-6">

        {/* KPI Cards */}
        <section>
          <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Empire Stats</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Active Channels" value="0" sub="Building Phase 0" accent="orange" />
            <StatCard label="Videos Published" value="0" sub="Pipeline not yet active" accent="blue" />
            <StatCard label="Monthly Revenue" value="$0" sub="Pre-monetization" accent="green" />
            <StatCard label="Total Subscribers" value="0" sub="Channels not launched" accent="purple" />
          </div>
        </section>

        {/* Agent Status */}
        <section>
          <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Agent Status</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map((agent) => (
              <div key={agent.name} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-sm font-medium text-zinc-200">{agent.name}</div>
                    <div className="text-xs text-zinc-500">{agent.role}</div>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                    <span className="w-1 h-1 rounded-full bg-zinc-600 inline-block" />
                    Idle
                  </span>
                </div>
                <div className="text-xs text-zinc-600">{agent.description}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Niche Pipeline */}
        <section>
          <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Niche Roadmap</h2>
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Niche</th>
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Phase</th>
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Est. CPM</th>
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {niches.map((n) => (
                  <tr key={n.name} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/20">
                    <td className="px-4 py-3 text-zinc-200 font-medium">{n.name}</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{n.phase}</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs font-mono">{n.cpm}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        n.status === "active"
                          ? "bg-orange-500/10 text-orange-400"
                          : n.status === "planned"
                          ? "bg-sky-500/10 text-sky-400"
                          : "bg-zinc-800 text-zinc-500"
                      }`}>
                        {n.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Revenue Target Tracker */}
        <section>
          <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Revenue Target</h2>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-zinc-300">Progress to $5,000 MRR</span>
              <span className="text-sm font-mono text-zinc-500">$0 / $5,000</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1.5">
              <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: "0%" }} />
            </div>
            <div className="mt-3 text-xs text-zinc-600">
              Target timeline: 13–18 months · Start date: Building Phase 0 now
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section>
          <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Next Actions</h2>
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 space-y-2">
            <div className="text-xs text-orange-400 font-medium uppercase tracking-wider">Phase 0 Checklist</div>
            {[
              "Get Anthropic API key → console.anthropic.com",
              "Create Supabase project → supabase.com",
              "Create Google Cloud project → enable YouTube Data API v3",
              "Sign up for ElevenLabs free tier → 10K chars/mo",
              "Sign up for Pexels API → free stock footage",
              "Create YouTube channel (Tech niche first)",
              "Create TikTok account (same brand)",
            ].map((action, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                <span className="text-zinc-700 mt-0.5 font-mono">{String(i + 1).padStart(2, "0")}</span>
                {action}
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
