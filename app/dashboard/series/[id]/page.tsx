import Link from "next/link";
import { Header } from "@/components/dashboard/Header";
import { getSeriesById } from "@/lib/db/queries";
import { formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  PUBLISHED: "bg-orange-500/10 text-orange-400",
  SCHEDULED: "bg-emerald-500/10 text-emerald-400",
  READY: "bg-emerald-500/10 text-emerald-400",
  IDEA: "bg-zinc-800 text-zinc-500",
};

export default async function SeriesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const series = await getSeriesById(id);

  if (!series) {
    return (
      <div>
        <Header title="Series Detail" subtitle="Not found" />
        <div className="p-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center">
            <div className="text-sm text-zinc-500">Series not found — it may have been removed.</div>
            <Link href="/dashboard/channels" className="text-xs text-orange-400 mt-2 inline-block">
              ← Back to channels
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header
        title={series.name}
        subtitle={`${series.channels?.name ?? "—"} · ${series.format} · ${series.frequency ?? ""}`}
      />
      <div className="p-6 space-y-6">

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 space-y-3">
          <div className="text-xs text-zinc-400">{series.description}</div>
          {series.episode_template && (
            <div>
              <div className="text-[10px] text-zinc-600 uppercase">Episode Template</div>
              <div className="text-xs text-zinc-300 mt-1 whitespace-pre-wrap">{series.episode_template}</div>
            </div>
          )}
          {series.channels && (
            <Link href={`/dashboard/channels/${series.channels.id}`} className="text-xs text-orange-400 inline-block">
              ← {series.channels.name}
            </Link>
          )}
        </div>

        <section>
          <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">
            Videos ({series.videos.length})
          </h2>
          {series.videos.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center text-xs text-zinc-600">
              No videos in this series yet — greenlight a topic through the Production Agent.
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Title / Topic</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {series.videos.map((v) => (
                    <tr key={v.id} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/20">
                      <td className="px-4 py-3 text-zinc-200 text-xs">{v.title ?? v.topic}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${STATUS_COLOR[v.status] ?? "bg-zinc-800 text-zinc-400"}`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 text-xs">{formatRelativeTime(v.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
