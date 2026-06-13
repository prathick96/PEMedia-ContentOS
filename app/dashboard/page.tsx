import Link from "next/link";
import { Header } from "@/components/dashboard/Header";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  getAgentStatuses,
  getNiches,
  getOverviewStats,
} from "@/lib/db/queries";
import { formatCurrency, formatNumber, formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const AGENT_META: Record<string, { name: string; role: string; description: string }> = {
  ceo: { name: "CEO Agent", role: "Orchestrator", description: "Strategy & delegation" },
  scout: { name: "Scout Agent", role: "Intelligence", description: "Trend monitoring" },
  creative: { name: "Creative Agent", role: "Brand", description: "Channel identity & series" },
  production: { name: "Production Agent", role: "Production", description: "Script → Video pipeline" },
  publisher: { name: "Publisher Agent", role: "Publishing", description: "YouTube & TikTok upload" },
  analytics: { name: "Analytics Agent", role: "Analytics", description: "Performance & revenue" },
};

const NICHE_PHASE: Record<string, string> = {
  tech: "Phase 1",
  history: "Phase 1",
  movies: "Phase 2",
  sports: "Phase 2",
  news: "Month 6",
};

function jobBadge(status: string | undefined) {
  switch (status) {
    case "completed":
      return { label: "Completed", dot: "bg-emerald-500", text: "text-emerald-400 bg-emerald-500/10" };
    case "running":
      return { label: "Running", dot: "bg-orange-500 animate-pulse", text: "text-orange-400 bg-orange-500/10" };
    case "failed":
      return { label: "Failed", dot: "bg-red-500", text: "text-red-400 bg-red-500/10" };
    default:
      return { label: "Idle", dot: "bg-zinc-600", text: "text-zinc-500 bg-zinc-800" };
  }
}

export default async function DashboardPage() {
  const [stats, agentStatuses, niches] = await Promise.all([
    getOverviewStats(),
    getAgentStatuses(),
    getNiches(),
  ]);

  const revenueProgressPct = Math.min(100, (stats.monthRevenueUsd / 5000) * 100);

  return (
    <div>
      <Header
        title="CEO Overview"
        subtitle="PEMedia Autonomous Content Empire"
      />

      <div className="p-6 space-y-6">

        {/* Pending approvals — the operator's #1 action item */}
        {stats.pendingApprovals > 0 && (
          <Link
            href="/dashboard/approvals"
            className="flex items-center justify-between rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 hover:bg-orange-500/15 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-sm text-orange-300 font-medium">
                {stats.pendingApprovals} approval{stats.pendingApprovals === 1 ? "" : "s"} awaiting your sign-off
              </span>
            </div>
            <span className="text-xs text-orange-400">Review →</span>
          </Link>
        )}

        {/* KPI Cards */}
        <section>
          <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Empire Stats</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Active Channels"
              value={String(stats.activeChannels)}
              sub={stats.totalChannels > stats.activeChannels ? `${stats.totalChannels - stats.activeChannels} building` : "Launch via Creative Agent"}
              accent="orange"
            />
            <StatCard
              label="Videos Published"
              value={String(stats.publishedVideos)}
              sub={stats.totalVideos > 0 ? `${stats.totalVideos} total in pipeline` : "Pipeline empty"}
              accent="blue"
            />
            <StatCard
              label="Monthly Revenue"
              value={formatCurrency(stats.monthRevenueUsd)}
              sub={stats.allTimeRevenueUsd > 0 ? `${formatCurrency(stats.allTimeRevenueUsd)} all time` : "Pre-monetization"}
              accent="green"
            />
            <StatCard
              label="Total Subscribers"
              value={formatNumber(stats.totalSubscribers)}
              sub={stats.totalSubscribers === 0 ? "Channels not launched" : "Across all channels"}
              accent="purple"
            />
          </div>
        </section>

        {/* Agent Status */}
        <section>
          <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Agent Status</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {agentStatuses.map(({ agent, lastJob }) => {
              const meta = AGENT_META[agent];
              const badge = jobBadge(lastJob?.status);
              return (
                <div key={agent} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-sm font-medium text-zinc-200">{meta.name}</div>
                      <div className="text-xs text-zinc-500">{meta.role}</div>
                    </div>
                    <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${badge.text}`}>
                      <span className={`w-1 h-1 rounded-full inline-block ${badge.dot}`} />
                      {badge.label}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-600">{meta.description}</div>
                  <div className="text-[10px] text-zinc-600 mt-2">
                    Last run: {formatRelativeTime(lastJob?.started_at)}
                  </div>
                </div>
              );
            })}
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
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Risk</th>
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {niches.map((n) => (
                  <tr key={n.id} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/20">
                    <td className="px-4 py-3 text-zinc-200 font-medium">{n.name}</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{NICHE_PHASE[n.slug] ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs font-mono">
                      ${Number(n.cpm_min)}–{Number(n.cpm_max)}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{n.risk_level.replace("_", " ")}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        n.active
                          ? "bg-orange-500/10 text-orange-400"
                          : "bg-zinc-800 text-zinc-500"
                      }`}>
                        {n.active ? "active" : "planned"}
                      </span>
                    </td>
                  </tr>
                ))}
                {niches.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-xs text-zinc-600">
                      No niches found — run supabase/migrations/001_initial.sql to seed the registry
                    </td>
                  </tr>
                )}
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
              <span className="text-sm font-mono text-zinc-500">
                {formatCurrency(stats.monthRevenueUsd)} / $5,000
              </span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1.5">
              <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${revenueProgressPct}%` }} />
            </div>
            <div className="mt-3 text-xs text-zinc-600">
              Target timeline: 13–18 months · Phase 1 — dashboard live, pipeline next
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
