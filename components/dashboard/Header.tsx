"use client";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  return (
    <header className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-[#09090b]/80 backdrop-blur-sm sticky top-0 z-20">
      <div>
        <h1 className="text-sm font-semibold text-zinc-50">{title}</h1>
        {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs text-zinc-500">{dateStr}</span>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
          <span className="text-xs text-zinc-500">All agents idle</span>
        </div>
      </div>
    </header>
  );
}
