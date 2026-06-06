import { Header } from "@/components/dashboard/Header";

export default function ChannelsPage() {
  return (
    <div>
      <Header title="Channels" subtitle="All active YouTube and TikTok channels" />
      <div className="p-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <div className="text-3xl mb-3 text-zinc-700">▶</div>
          <div className="text-sm font-medium text-zinc-400 mb-1">No channels yet</div>
          <div className="text-xs text-zinc-600 mb-4 max-w-xs mx-auto">
            Channels are created by the Creative Agent when given a niche by the CEO Agent.
            Launch your first channel by triggering the CEO Agent.
          </div>
          <div className="inline-block px-4 py-2 text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg">
            Phase 1 · Coming after Phase 0 foundation
          </div>
        </div>
      </div>
    </div>
  );
}
