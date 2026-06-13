import Link from "next/link";
import { Header } from "@/components/dashboard/Header";
import { getChannelById } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function ChannelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const channel = await getChannelById(id);

  if (!channel) {
    return (
      <div>
        <Header title="Channel Detail" subtitle="Not found" />
        <div className="p-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center">
            <div className="text-sm text-zinc-500">Channel not found — it may have been removed.</div>
            <Link href="/dashboard/channels" className="text-xs text-orange-400 mt-2 inline-block">
              ← Back to channels
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const brand = channel.brand_doc;

  return (
    <div>
      <Header title={channel.name} subtitle={channel.tagline ?? `Channel · ${channel.niches?.name ?? ""}`} />
      <div className="p-6 space-y-6">

        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">{channel.platform}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">{channel.niches?.name}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400">{channel.status}</span>
          {channel.url && (
            <a href={channel.url} target="_blank" rel="noreferrer" className="text-[10px] text-orange-400 hover:underline">
              {channel.url} ↗
            </a>
          )}
        </div>

        {brand && (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 space-y-3">
              <h2 className="text-xs text-zinc-500 uppercase tracking-wider">Brand Identity</h2>
              <div>
                <div className="text-[10px] text-zinc-600 uppercase">Audience</div>
                <div className="text-xs text-zinc-300 mt-1">{brand.audience_persona}</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-600 uppercase">Voice</div>
                <div className="text-xs text-zinc-300 mt-1">{brand.brand_voice}</div>
              </div>
              {brand.brand_colors && (
                <div>
                  <div className="text-[10px] text-zinc-600 uppercase mb-1">Colors</div>
                  <div className="flex items-center gap-2">
                    {Object.entries(brand.brand_colors).map(([name, hex]) => (
                      <span key={name} className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                        <span className="w-4 h-4 rounded border border-zinc-700 inline-block" style={{ background: hex }} />
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 space-y-3">
              <h2 className="text-xs text-zinc-500 uppercase tracking-wider">Content Strategy</h2>
              {brand.content_pillars && (
                <div>
                  <div className="text-[10px] text-zinc-600 uppercase mb-1">Pillars</div>
                  <div className="flex flex-wrap gap-1">
                    {brand.content_pillars.map((p) => (
                      <span key={p} className="text-[10px] text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded">{p}</span>
                    ))}
                  </div>
                </div>
              )}
              {brand.thumbnail_style_guide && (
                <div>
                  <div className="text-[10px] text-zinc-600 uppercase">Thumbnail Style</div>
                  <div className="text-xs text-zinc-300 mt-1">{brand.thumbnail_style_guide}</div>
                </div>
              )}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">
            Series ({channel.series.length})
          </h2>
          {channel.series.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center text-xs text-zinc-600">
              No series yet — the Creative Agent generates these at channel launch.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {channel.series.map((s) => (
                <Link
                  key={s.id}
                  href={`/dashboard/series/${s.id}`}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 hover:border-zinc-700 transition-colors block"
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-sm font-medium text-zinc-200">{s.name}</span>
                    <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{s.format}</span>
                  </div>
                  <div className="text-xs text-zinc-500 mb-2">{s.description}</div>
                  <div className="text-[10px] text-zinc-600">{s.frequency}</div>
                </Link>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
