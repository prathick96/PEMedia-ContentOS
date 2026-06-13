import { Header } from "@/components/dashboard/Header";
import { RunAgentButton } from "@/components/dashboard/RunAgentButton";
import { getTrendSignalsByNiche } from "@/lib/db/queries";
import { formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SOURCE_BADGES: Record<string, { label: string; class: string }> = {
  hackernews: { label: "HN", class: "bg-orange-500/10 text-orange-400" },
  reddit: { label: "Reddit", class: "bg-red-500/10 text-red-400" },
  youtube: { label: "YouTube", class: "bg-rose-500/10 text-rose-400" },
  wikipedia: { label: "Wikipedia", class: "bg-sky-500/10 text-sky-400" },
  claude_analysis: { label: "AI", class: "bg-purple-500/10 text-purple-400" },
  google_trends: { label: "Trends", class: "bg-sky-500/10 text-sky-400" },
  rss: { label: "RSS", class: "bg-zinc-800 text-zinc-400" },
};

export default async function TrendsPage() {
  const groups = await getTrendSignalsByNiche();

  return (
    <div>
      <Header title="Trend Intelligence" subtitle="Scout Agent briefings — top topics per niche" />
      <div className="p-6 space-y-4">

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="text-lg text-zinc-600 mt-0.5">↑</div>
            <div>
              <div className="text-sm font-medium text-zinc-300 mb-1">Scout Agent</div>
              <div className="text-xs text-zinc-500">
                Pulls live signals from Hacker News, Reddit, and YouTube, then scores them with Claude for
                CPM potential, competition gap, and AI producibility. Topics marked <span className="text-purple-400">AI</span> are
                model-generated without live source data.
              </div>
            </div>
          </div>
          <RunAgentButton
            agent="scout"
            label="Run Scout now"
            confirmMessage="Run the Scout Agent? This calls live trend sources + the Claude API (a few cents) and writes new trend signals."
          />
        </div>

        {groups.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
            <div className="text-3xl mb-3 text-zinc-700">↑</div>
            <div className="text-sm font-medium text-zinc-400 mb-1">No trend signals yet</div>
            <div className="text-xs text-zinc-600 max-w-xs mx-auto">
              Run the Scout Agent to capture today&apos;s top topics for the active niches.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {groups.map((group) => (
              <div key={group.nicheSlug} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-zinc-300">{group.nicheName}</span>
                  <span className="text-[10px] text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full">
                    {group.signals.length} signal{group.signals.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="space-y-2">
                  {group.signals.slice(0, 8).map((signal, i) => {
                    const badge = SOURCE_BADGES[signal.source] ?? SOURCE_BADGES.rss;
                    return (
                      <div key={signal.id} className="flex items-start gap-2">
                        <span className="text-xs font-mono text-zinc-700 w-4 mt-0.5">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-zinc-300 leading-snug">{signal.topic}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[9px] px-1.5 py-px rounded ${badge.class}`}>{badge.label}</span>
                            <span className="text-[9px] text-zinc-600 font-mono">score {Number(signal.score).toFixed(0)}</span>
                            <span className="text-[9px] text-zinc-700">{formatRelativeTime(signal.captured_at)}</span>
                            {signal.used_in_video_id && (
                              <span className="text-[9px] text-emerald-500">→ in production</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
