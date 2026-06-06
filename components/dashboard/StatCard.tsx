interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: "orange" | "green" | "blue" | "purple";
}

const accentColors = {
  orange: "text-orange-400 bg-orange-500/10",
  green: "text-emerald-400 bg-emerald-500/10",
  blue: "text-sky-400 bg-sky-500/10",
  purple: "text-purple-400 bg-purple-500/10",
};

export function StatCard({ label, value, sub, accent = "orange" }: StatCardProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-3">{label}</div>
      <div className={`text-2xl font-bold ${accentColors[accent].split(" ")[0]}`}>{value}</div>
      {sub && <div className="text-xs text-zinc-600 mt-1.5">{sub}</div>}
    </div>
  );
}
