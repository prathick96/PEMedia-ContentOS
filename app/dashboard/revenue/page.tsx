import { Header } from "@/components/dashboard/Header";
import { StatCard } from "@/components/dashboard/StatCard";

const streams = [
  { name: "YouTube AdSense", status: "Locked", note: "Requires 1K subs + 4K watch hours (YPP)", color: "text-zinc-500" },
  { name: "TikTok Creator Fund", status: "Locked", note: "Requires 10K followers + 100K views/30 days", color: "text-zinc-500" },
  { name: "Affiliate Links", status: "Ready Day 1", note: "Amazon Associates, software affiliates — add to descriptions immediately", color: "text-emerald-400" },
  { name: "Channel Memberships", status: "Locked", note: "Requires 1K subscribers + YPP", color: "text-zinc-500" },
  { name: "Sponsorships", status: "Locked", note: "Typically available at 10K+ subscribers", color: "text-zinc-500" },
  { name: "Digital Products", status: "Phase 4", note: "Course/ebook in top niche — highest margin", color: "text-sky-400" },
];

export default function RevenuePage() {
  return (
    <div>
      <Header title="Revenue Dashboard" subtitle="All monetization streams tracked in one place" />
      <div className="p-6 space-y-6">

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="This Month" value="$0" sub="Pre-launch" accent="green" />
          <StatCard label="All Time" value="$0" sub="Day 0" accent="green" />
          <StatCard label="Target MRR" value="$5,000" sub="13–18 month goal" accent="orange" />
          <StatCard label="Runway to Target" value="0%" sub="Building foundation" accent="blue" />
        </div>

        <section>
          <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Revenue Streams</h2>
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Stream</th>
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">This Month</th>
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {streams.map((s) => (
                  <tr key={s.name} className="border-b border-zinc-800/50 last:border-0">
                    <td className="px-4 py-3 text-zinc-300 font-medium text-sm">{s.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${s.color}`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 font-mono text-xs">$0.00</td>
                    <td className="px-4 py-3 text-zinc-600 text-xs max-w-xs">{s.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Milestone Revenue Unlocks</h2>
          <div className="space-y-2">
            {[
              { milestone: "First $50 affiliate", unlock: "ElevenLabs Starter ($5/mo) — better voice quality" },
              { milestone: "$200/mo revenue", unlock: "Muapi.ai API key — AI video generation" },
              { milestone: "$500/mo revenue", unlock: "ElevenLabs Creator ($22/mo) — more characters" },
              { milestone: "$1,000/mo revenue", unlock: "Full automation stack (~$150/mo)" },
              { milestone: "$5,000 MRR", unlock: "Reinvest 30% — scale to 4–5 channels, digital products" },
            ].map((r, i) => (
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
