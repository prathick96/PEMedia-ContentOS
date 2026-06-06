import { Header } from "@/components/dashboard/Header";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SchedulePage() {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const startDay = startOfMonth.getDay();

  const cells = Array.from({ length: startDay + daysInMonth }, (_, i) =>
    i < startDay ? null : i - startDay + 1
  );

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
                className={`aspect-square rounded-md flex items-center justify-center text-xs ${
                  day === null
                    ? ""
                    : day === today.getDate()
                    ? "bg-orange-500/20 text-orange-400 font-semibold"
                    : "text-zinc-600 hover:bg-zinc-800/50"
                }`}
              >
                {day || ""}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center">
          <div className="text-2xl mb-2 text-zinc-700">▦</div>
          <div className="text-sm font-medium text-zinc-400 mb-1">No scheduled posts</div>
          <div className="text-xs text-zinc-600 max-w-sm mx-auto">
            The Publisher Agent will populate this calendar with scheduled uploads.
            Posts are randomised within ±90 minutes of target windows per platform analytics.
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {["YouTube", "TikTok", "Shorts"].map((platform) => (
            <div key={platform} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
              <div className="text-sm font-medium text-zinc-400 mb-1">{platform}</div>
              <div className="text-2xl font-bold text-zinc-600">0</div>
              <div className="text-xs text-zinc-700">posts this month</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
