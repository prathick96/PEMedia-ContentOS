import { Header } from "@/components/dashboard/Header";

const niches = ["Tech", "World History", "Movies", "Sports", "Current News"];

export default function TrendsPage() {
  return (
    <div>
      <Header title="Trend Intelligence" subtitle="Scout Agent briefings — top 5 topics per niche" />
      <div className="p-6 space-y-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 flex items-start gap-3">
          <div className="text-lg text-zinc-600 mt-0.5">↑</div>
          <div>
            <div className="text-sm font-medium text-zinc-300 mb-1">Scout Agent not yet active</div>
            <div className="text-xs text-zinc-500">
              The Scout Agent monitors Google Trends, Reddit, and YouTube for trending topics across your niches.
              It will populate this feed daily once the agent system is online (Phase 2).
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {niches.map((niche) => (
            <div key={niche} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-zinc-300">{niche}</span>
                <span className="text-[10px] text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full">No data</span>
              </div>
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-700 w-4">{i}.</span>
                    <div className="h-2 bg-zinc-800 rounded flex-1" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
