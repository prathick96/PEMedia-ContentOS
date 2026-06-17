import Link from "next/link";
import { Header } from "@/components/dashboard/Header";
import { RunAgentButton } from "@/components/dashboard/RunAgentButton";
import { getChannels, getNiches } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  building: "bg-sky-500/10 text-sky-400",
  active: "bg-emerald-500/10 text-emerald-400",
  paused: "bg-yellow-500/10 text-yellow-400",
  terminated: "bg-zinc-800 text-zinc-500",
};

export default async function ChannelsPage() {
  const [channels, niches] = await Promise.all([getChannels(), getNiches()]);
  const techNiche = niches.find((n) => n.slug === "tech");

  return (
    <div>
      <Header title="Channels" subtitle="All active YouTube and TikTok channels" />
      <div className="p-6 space-y-4">
        {channels.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
            <div className="text-3xl mb-3 text-zinc-700">▶</div>
            <div className="text-sm font-medium text-zinc-400 mb-1">No channels yet</div>
            <div className="text-xs text-zinc-600 mb-4 max-w-xs mx-auto">
              The Creative Agent generates a full channel profile (name, brand, series) from a niche.
              The council reviews the launch, then it lands here awaiting your approval.
            </div>
            {techNiche && (
              <RunAgentButton
                agent="creative"
                input={{ niche: "tech", niche_id: techNiche.id }}
                label="Launch Tech channel (Creative Agent)"
                confirmMessage="Run the Creative Agent for the Tech niche? This convenes the council + Claude (~$0.10) and creates a channel awaiting your approval."
              />
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {channels.map((channel) => (
              <Link
                key={channel.id}
                href={`/dashboard/channels/${channel.id}`}
                className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 hover:border-zinc-700 transition-colors block"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-sm font-semibold text-zinc-200">{channel.name}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{channel.tagline}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[channel.status] ?? STATUS_BADGE.terminated}`}>
                    {channel.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                    {channel.niches?.name ?? "—"}
                  </span>
                  <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                    {channel.platform}
                  </span>
                  <span className="text-[10px] text-zinc-600">
                    {channel.series.length} series
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
