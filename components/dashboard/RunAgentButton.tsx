"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { AgentType } from "@/lib/db/schema";

interface RunAgentButtonProps {
  agent: AgentType;
  /** Payload POSTed to /api/agents/<agent>. */
  input?: Record<string, unknown>;
  label?: string;
  /** Shown in a confirm() dialog before firing — use for costly runs. */
  confirmMessage?: string;
  className?: string;
}

type RunState = "idle" | "running" | "done" | "error";

export function RunAgentButton({ agent, input, label, confirmMessage, className }: RunAgentButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<RunState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    if (state === "running") return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;

    setState("running");
    setMessage(null);
    try {
      const res = await fetch(`/api/agents/${agent}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input ?? {}),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.error ?? `Agent run failed (HTTP ${res.status})`);
      }
      setState("done");
      setMessage("Completed");
      router.refresh();
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={run}
        disabled={state === "running"}
        className={cn(
          "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
          state === "running"
            ? "bg-zinc-800 text-zinc-500 border-zinc-700 cursor-wait"
            : "bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20",
          className
        )}
      >
        {state === "running" ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border border-zinc-500 border-t-transparent animate-spin inline-block" />
            Running…
          </span>
        ) : (
          label ?? `Run ${agent}`
        )}
      </button>
      {message && (
        <span
          className={cn(
            "text-[10px] max-w-[260px] truncate",
            state === "error" ? "text-red-400" : "text-emerald-400"
          )}
          title={message}
        >
          {message}
        </span>
      )}
    </span>
  );
}
