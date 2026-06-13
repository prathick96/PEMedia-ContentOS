import { Header } from "@/components/dashboard/Header";
import { getScheduleData } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function SchedulePage() {
  const { scheduled, publishedThisMonth } = await getScheduleData();

  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const startDay = startOfMonth.getDay();

  const cells = Array.from({ length: startDay + daysInMonth }, (_, i) =>
    i < startDay ? null : i - startDay + 1
  );

  // Days of the current month that have scheduled or published posts
  const markedDays = new Set<number>();
  for (const v of [...scheduled, ...publishedThisMonth]) {
    const iso = v.scheduled_at ?? v.published_at;
    if (!iso) continue;
    const d = new Date(iso);
    if (d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth()) {
      markedDays.add(d.getDate());
    }
  }

  const ytCount = publishedThisMonth.filter((v) => v.youtube_id).length;
  const ttCount = publishedThisMonth.filter((v) => v.tiktok_id).length;

  return (
    <div>
      <Header title="Publishing Schedule" subtitle="Content calendar — post times randomised ±90min per platform rules" />
      <div className="p-6 space-y-4">

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-2">
          <div className="text-center py-1 mb-2 text-sm font-medium text-zinc-300">
            {today.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => (
              <div key={d} className="text-center text-[10px] text-zinc-600 py-1 font-medium">{d}</div>
            ))}
            {cells.map((day, i) => (
              <div
                key={i}
                className={`aspect-square rounded-md flex flex-col items-center justify-center text-xs ${
                  day === null
                    ? ""
                    : day === today.getDate()
                    ? "bg-orange-500/20 text-orange-400 font-semibold"
                    : "text-zinc-600 hover:bg-zinc-800/50"
                }`}
              >
                {day || ""}
                {day !== null && markedDays.has(day) && (
                  <span className="w-1 h-1 rounded-full bg-emerald-400 mt-0.5" />
                )}
              </div>
            ))}
          </div>
        </div>

        {scheduled.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center">
            <div className="text-2xl mb-2 text-zinc-700">▦</div>
            <div className="text-sm font-medium text-zinc-400 mb-1">No scheduled posts</div>
            <div className="text-xs text-zinc-600 max-w-sm mx-auto">
              The Publisher Agent populates this calendar with scheduled uploads.
              Posts are randomised within ±90 minutes of target windows, and never closer
              than 18 hours apart on the same channel.
            </div>
          </div>
        ) : (
          <section>
            <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">
              Upcoming ({scheduled.length})
            </h2>
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Scheduled for</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Title</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Channel · Series</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduled.map((v) => (
                    <tr key={v.id} className="border-b border-zinc-800/50 last:border-0">
                      <td className="px-4 py-3 text-emerald-400 text-xs font-mono">
                        {v.scheduled_at ? new Date(v.scheduled_at).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-200 text-xs">{v.title ?? v.topic}</td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">
                        {v.series?.channels?.name ?? "—"} · {v.series?.name ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <div className="grid grid-cols-3 gap-3">
          {[
            { platform: "YouTube", count: ytCount },
            { platform: "TikTok", count: ttCount },
            { platform: "Total", count: publishedThisMonth.length },
          ].map(({ platform, count }) => (
            <div key={platform} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
              <div className="text-sm font-medium text-zinc-400 mb-1">{platform}</div>
              <div className={`text-2xl font-bold ${count > 0 ? "text-zinc-200" : "text-zinc-600"}`}>{count}</div>
              <div className="text-xs text-zinc-700">posts this month</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
