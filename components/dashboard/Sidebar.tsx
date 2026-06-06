"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "CEO Overview", icon: "⬡" },
  { href: "/dashboard/channels", label: "Channels", icon: "▶" },
  { href: "/dashboard/pipeline", label: "Pipeline", icon: "◈" },
  { href: "/dashboard/trends", label: "Trends", icon: "↑" },
  { href: "/dashboard/agents", label: "Agents", icon: "◎" },
  { href: "/dashboard/revenue", label: "Revenue", icon: "$" },
  { href: "/dashboard/schedule", label: "Schedule", icon: "▦" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-[#111113] border-r border-zinc-800 flex flex-col z-30">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-orange-500 flex items-center justify-center text-white font-bold text-sm">P</div>
          <div>
            <div className="text-sm font-semibold text-zinc-50 leading-none">PEMedia</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">ContentOS</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-orange-500/10 text-orange-400 font-medium"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
              )}
            >
              <span className="w-4 text-center text-xs opacity-70">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Phase badge + settings */}
      <div className="px-3 py-4 border-t border-zinc-800 space-y-2">
        <div className="px-3 py-2 rounded-md bg-zinc-800/50">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Current Phase</div>
          <div className="text-xs text-zinc-300 mt-0.5 font-medium">Phase 0 — Foundation</div>
        </div>
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
        >
          <span className="w-4 text-center text-xs opacity-70">⚙</span>
          Settings
        </Link>
      </div>
    </aside>
  );
}
