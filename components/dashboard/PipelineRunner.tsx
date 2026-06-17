"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PIPELINE_STAGES,
  type PipelineEvent,
  type PipelineStageId,
  type StageStatus,
} from "@/lib/pipeline/stages";

interface StageState {
  status: StageStatus;
  detail?: string;
}

function initialStages(): Record<PipelineStageId, StageState> {
  return Object.fromEntries(
    PIPELINE_STAGES.map((s) => [s.id, { status: "pending" as StageStatus }])
  ) as Record<PipelineStageId, StageState>;
}

const STATUS_STYLE: Record<StageStatus, { dot: string; text: string; label: string }> = {
  pending: { dot: "border border-zinc-700", text: "text-zinc-600", label: "" },
  running: { dot: "border-2 border-orange-400 border-t-transparent animate-spin", text: "text-orange-300", label: "running" },
  done: { dot: "bg-emerald-500", text: "text-emerald-300", label: "done" },
  skipped: { dot: "bg-zinc-600", text: "text-zinc-500", label: "skipped" },
  awaiting_approval: { dot: "bg-amber-400", text: "text-amber-300", label: "needs you" },
  failed: { dot: "bg-red-500", text: "text-red-300", label: "failed" },
};

export function PipelineRunner() {
  const router = useRouter();
  const [niche, setNiche] = useState("tech");
  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState<Record<PipelineStageId, StageState>>(initialStages);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  function finish() {
    esRef.current?.close();
    esRef.current = null;
    setRunning(false);
    router.refresh(); // pull the new video into the kanban below
  }

  function start() {
    if (running) return;
    setStages(initialStages());
    setError(null);
    setRunning(true);

    const es = new EventSource(`/api/pipeline/stream?niche=${encodeURIComponent(niche)}`);
    esRef.current = es;

    es.onmessage = (e) => {
      let msg: ({ type?: string } & Partial<PipelineEvent>) | null = null;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (!msg) return;
      if (msg.type === "end") {
        finish();
        return;
      }
      if (msg.stage && msg.status) {
        const ev = msg as PipelineEvent;
        setStages((prev) => ({ ...prev, [ev.stage]: { status: ev.status, detail: ev.detail } }));
      }
    };

    es.onerror = () => {
      setError("Stream interrupted — is the dev server running?");
      finish();
    };
  }

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
          <select
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            disabled={running}
            className="text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-300 disabled:opacity-50"
          >
            <option value="tech">Tech</option>
            <option value="history">History</option>
          </select>
          <button
            onClick={start}
            disabled={running}
            className="px-4 py-1.5 rounded-lg text-xs font-medium border bg-orange-500/15 text-orange-300 border-orange-500/30 hover:bg-orange-500/25 disabled:opacity-50 transition-colors"
          >
            {running ? "Running…" : "▶ Start Pipeline"}
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
                  {style.label && (
                    <span className={`text-[10px] ${style.text}`}>· {style.label}</span>
                  )}
                </div>
                {st.detail && <div className={`text-[11px] mt-0.5 ${style.text}`}>{st.detail}</div>}
              </div>
            </li>
          );
        })}
      </ol>

      {error && <div className="mt-3 text-[11px] text-red-400">{error}</div>}
    </div>
  );
}
