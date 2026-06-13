import { Header } from "@/components/dashboard/Header";
import { StatCard } from "@/components/dashboard/StatCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { getRevenueSummary } from "@/lib/db/queries";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STREAM_INFO: Record<string, { name: string; note: string }> = {
  adsense: { name: "YouTube AdSense", note: "Requires 1K subs + 4K watch hours (YPP)" },
  affiliate: { name: "Affiliate Links", note: "Amazon Associates, software affiliates — ready day 1" },
  sponsor: { name: "Sponsorships", note: "Typically available at 10K+ subscribers" },
  membership: { name: "Channel Memberships", note: "Requires 1K subscribers + YPP" },
  product: { name: "Digital Products", note: "Course/ebook in top niche — highest margin" },
};

const MILESTONES = [
  { milestone: "First $50 affiliate", unlock: "ElevenLabs Starter ($5/mo) — better voice quality" },
  { milestone: "$200/mo revenue", unlock: "Muapi.ai API key — AI video generation" },
  { milestone: "$500/mo revenue", unlock: "ElevenLabs Creator ($22/mo) — more characters" },
  { milestone: "$1,000/mo revenue", unlock: "Full automation stack (~$150/mo)" },
  { milestone: "$5,000 MRR", unlock: "Reinvest 30% — scale to 4–5 channels, digital products" },
];

export default async function RevenuePage() {
  const revenue = await getRevenueSummary();
  const bySourceMap = new Map(revenue.bySource.map((s) => [s.source, s.totalUsd]));
  const progressPct = Math.min(100, (revenue.thisMonthUsd / 5000) * 100);

  return (
    <div>
      <Header title="Revenue Dashboard" subtitle="All monetization streams tracked in one place" />
      <div className="p-6 space-y-6">

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="This Month"
            value={formatCurrency(revenue.thisMonthUsd)}
            sub={revenue.entries.length === 0 ? "Pre-launch" : `${revenue.entries.length} entries tracked`}
            accent="green"
          />
          <StatCard
            label="All Time"
            value={formatCurrency(revenue.allTimeUsd)}
            sub={revenue.allTimeUsd === 0 ? "Day 0" : undefined}
            accent="green"
          />
          <StatCard label="Target MRR" value="$5,000" sub="13–18 month goal" accent="orange" />
          <StatCard
            label="Progress to Target"
            value={`${progressPct.toFixed(progressPct > 0 && progressPct < 1 ? 1 : 0)}%`}
            sub={revenue.thisMonthUsd === 0 ? "Building foundation" : "Of monthly target"}
            accent="blue"
          />
        </div>

        <section>
          <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Monthly Revenue</h2>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
            <RevenueChart byMonth={revenue.byMonth} />
          </div>
        </section>

        <section>
          <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Revenue Streams</h2>
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Stream</th>
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">All Time</th>
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(STREAM_INFO).map(([source, info]) => {
                  const total = bySourceMap.get(source) ?? 0;
                  return (
                    <tr key={source} className="border-b border-zinc-800/50 last:border-0">
                      <td className="px-4 py-3 text-zinc-300 font-medium text-sm">{info.name}</td>
                      <td className={`px-4 py-3 font-mono text-xs ${total > 0 ? "text-emerald-400" : "text-zinc-600"}`}>
                        {formatCurrency(total)}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 text-xs max-w-xs">{info.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {revenue.entries.length > 0 && (
          <section>
            <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Recent Entries</h2>
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Date</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Source</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Channel</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Amount</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {revenue.entries.slice(0, 20).map((e) => (
                    <tr key={e.id} className="border-b border-zinc-800/50 last:border-0">
                      <td className="px-4 py-3 text-zinc-500 text-xs">{e.date}</td>
                      <td className="px-4 py-3 text-zinc-300 text-xs">{STREAM_INFO[e.source]?.name ?? e.source}</td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{e.channels?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-emerald-400 font-mono text-xs">{formatCurrency(Number(e.amount_usd))}</td>
                      <td className="px-4 py-3 text-zinc-600 text-xs">{e.notes ?? formatRelativeTime(e.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section>
          <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Milestone Revenue Unlocks</h2>
          <div className="space-y-2">
            {MILESTONES.map((r, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-zinc-800/50 bg-zinc-900/20 px-4 py-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-700 flex-none" />
                <span className="text-xs text-zinc-400 font-medium min-w-[140px]">{r.milestone}</span>
                <span className="text-xs text-zinc-600">{r.unlock}</span>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
