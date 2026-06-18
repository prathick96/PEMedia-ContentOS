"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PIPELINE_STAGES,
  reduceStageViews,
  type PipelineEvent,
  type StageStatus,
} from "@/lib/pipeline/stages";

/** The pipeline_runs row shape the client needs (see lib/pipeline/runs.ts). */
interface RunDTO {
  id: string;
  niche: string;
  status: "running" | "completed" | "failed" | "awaiting_approval";
  stages: PipelineEvent[];
  error: string | null;
}

const STATUS_STYLE: Record<StageStatus, { dot: string; text: string; label: string }> = {
  pending: { dot: "border border-zinc-700", text: "text-zinc-600", label: "" },
  running: { dot: "border-2 border-orange-400 border-t-transparent animate-spin", text: "text-orange-300", label: "running" },
  done: { dot: "bg-emerald-500", text: "text-emerald-300", label: "done" },
  skipped: { dot: "bg-zinc-600", text: "text-zinc-500", label: "skipped" },
  awaiting_approval: { dot: "bg-amber-400", text: "text-amber-300", label: "needs you" },
  failed: { dot: "bg-red-500", text: "text-red-300", label: "failed" },
};

const POLL_MS = 3000;

export function PipelineRunner() {
  const router = useRouter();
  const [niche, setNiche] = useState("tech");
  const [run, setRun] = useState<RunDTO | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isRunning = run?.status === "running";

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchRun = useCallback(async (id?: string): Promise<RunDTO | null> => {
    const url = id ? `/api/pipeline/runs?id=${encodeURIComponent(id)}` : "/api/pipeline/runs";
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    return (json?.run ?? null) as RunDTO | null;
  }, []);

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetchRun(id);
          if (!r) return;
          setRun(r);
          if (r.status !== "running") {
            stopPolling();
            router.refresh(); // surface the new video in the kanban below
          }
        } catch {
          /* transient network blip — keep polling */
        }
      }, POLL_MS);
    },
    [fetchRun, router, stopPolling]
  );

  // On mount (incl. every reload): rehydrate the latest run from the DB and, if it's
  // still running, resume polling. This is what makes a run survive a page reload.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await fetchRun();
        if (!active || !r) return;
        setRun(r);
        setNiche(r.niche);
        if (r.status === "running") startPolling(r.id);
      } catch {
        /* ignore — Start is still available */
      }
    })();
    return () => {
      active = false;
      stopPolling();
    };
  }, [fetchRun, startPolling, stopPolling]);

  async function start() {
    if (isRunning || starting) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/pipeline/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error ?? "Failed to start pipeline");
      setRun((json.run ?? null) as RunDTO | null);
      startPolling(json.runId as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start pipeline");
    } finally {
      setStarting(false);
    }
  }

  const stages = reduceStageViews(run?.stages);
  const busy = isRunning || starting;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div>
          <div className="text-sm font-semibold text-zinc-100">Run full pipeline</div>
          <div className="text-xs text-zinc-500">
            Scout → CEO check → Creative → Production → Render → QA → Publisher, live.
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isRunning && (
            <span className="text-[10px] text-emerald-400/80 mr-1">● live — safe to reload</span>
          )}
          <select
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            disabled={busy}
            className="text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-300 disabled:opacity-50"
          >
            <option value="tech">Tech</option>
            <option value="history">History</option>
          </select>
          <button
            onClick={start}
            disabled={busy}
            className="px-4 py-1.5 rounded-lg text-xs font-medium border bg-orange-500/15 text-orange-300 border-orange-500/30 hover:bg-orange-500/25 disabled:opacity-50 transition-colors"
          >
            {isRunning ? "Running…" : starting ? "Starting…" : "▶ Start Pipeline"}
          </button>
        </div>
      </div>

      <ol className="space-y-2.5">
        {PIPELINE_STAGES.map((stage) => {
          const st = stages[stage.id];
          const style = STATUS_STYLE[st.status];
          return (
            <li key={stage.id} className="flex items-start gap-3">
              <span className={`mt-1 w-3 h-3 rounded-full shrink-0 inline-block ${style.dot}`} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${st.status === "pending" ? "text-zinc-500" : "text-zinc-200"}`}>
                    {stage.label}
                  </span>
                  <span className="text-[10px] text-zinc-600">{stage.hint}</span>
                  {style.label && <span className={`text-[10px] ${style.text}`}>· {style.label}</span>}
                </div>
                {st.detail && <div className={`text-[11px] mt-0.5 ${style.text}`}>{st.detail}</div>}
              </div>
            </li>
          );
        })}
      </ol>

      {(error || (run?.status === "failed" && run.error)) && (
        <div className="mt-3 text-[11px] text-red-400">{error ?? run?.error}</div>
      )}
    </div>
  );
}
