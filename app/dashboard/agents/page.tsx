import { Header } from "@/components/dashboard/Header";
import { RunAgentButton } from "@/components/dashboard/RunAgentButton";
import { getAgentStatuses, getRecentJobs } from "@/lib/db/queries";
import type { AgentType } from "@/lib/db/schema";
import { formatDuration, formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface AgentMeta {
  name: string;
  id: AgentType;
  role: string;
  description: string;
  trigger: string;
  tools: string[];
  runnable: boolean;
  confirm?: string;
}

const agents: AgentMeta[] = [
  {
    name: "CEO Agent",
    id: "ceo",
    role: "Master Orchestrator",
    description: "Convenes the council for strategy, reads analytics + trends, issues the daily task queue.",
    trigger: "Daily cron + manual",
    tools: ["LLM Council", "All DB tables", "Task queue"],
    runnable: true,
    confirm: "Run the CEO Agent? It convenes the full council (~7 Claude calls, ≈$0.10–0.30) and generates today's task queue.",
  },
  {
    name: "Scout Agent",
    id: "scout",
    role: "Trend Intelligence",
    description: "Pulls live signals (Hacker News, Reddit, YouTube), scores them with Claude per niche.",
    trigger: "Daily from CEO",
    tools: ["Hacker News", "Reddit JSON", "YouTube Data API", "Claude"],
    runnable: true,
    confirm: "Run the Scout Agent? Fetches live trend sources and calls Claude (a few cents).",
  },
  {
    name: "Creative Agent",
    id: "creative",
    role: "Brand Architect",
    description: "Receives only a niche. Generates the full channel profile; council-gated, then awaits your approval.",
    trigger: "Once per channel launch",
    tools: ["Claude", "Council gate", "Approvals"],
    runnable: false,
  },
  {
    name: "Production Agent",
    id: "production",
    role: "Content Factory",
    description: "Quality-gates the topic, then writes the full script. Voice/video/thumbnail land in Phase 2–3.",
    trigger: "Per topic from CEO",
    tools: ["Quality gate", "Claude", "ElevenLabs (Phase 2)"],
    runnable: false,
  },
  {
    name: "QA Reviewer Agent",
    id: "qa",
    role: "Quality Gate",
    description: "Reviews the finished package (script, narration, visuals, thumbnail, short). Scores 10 dimensions, enforces AI disclosure + copyright safety, and gates advancement to the Publisher.",
    trigger: "Per produced video, before Publisher",
    tools: ["Claude", "qa_review_results", "Approvals"],
    runnable: false,
  },
  {
    name: "Publisher Agent",
    id: "publisher",
    role: "Distribution",
    description: "Optimises metadata, forces AI-disclosure labels, schedules ±90min — then awaits your approval.",
    trigger: "Per READY video",
    tools: ["Claude", "Approvals", "YouTube API (Phase 3)"],
    runnable: false,
  },
  {
    name: "Analytics Agent",
    id: "analytics",
    role: "Performance Monitor",
    description: "Reads snapshots + revenue, surfaces top/bottom performers and recommendations for the CEO.",
    trigger: "Weekly + on-demand",
    tools: ["Claude", "analytics_snaps", "revenue_entries"],
    runnable: true,
    confirm: "Run the Analytics Agent? Generates a report from current data (one Claude call).",
  },
];

function statusBadge(status: string | undefined) {
  switch (status) {
    case "completed":
      return "bg-emerald-500/10 text-emerald-400";
    case "running":
      return "bg-orange-500/10 text-orange-400";
    case "failed":
      return "bg-red-500/10 text-red-400";
    default:
      return "bg-zinc-800 text-zinc-500";
  }
}

export default async function AgentsPage() {
  const [statuses, recentJobs] = await Promise.all([getAgentStatuses(), getRecentJobs(25)]);
  const lastJobByAgent = new Map(statuses.map((s) => [s.agent, s.lastJob]));

  return (
    <div>
      <Header title="Agent Control Panel" subtitle="Monitor and manually trigger all autonomous agents" />
      <div className="p-6 space-y-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-800/20 px-4 py-3 text-xs text-zinc-500">
          Manual runs call the Claude API with your key. Creative, Production, and Publisher need
          structured input — trigger them from their context pages (Channels, Trends) or via the CEO&apos;s task queue.
        </div>

        <div className="space-y-3">
          {agents.map((agent) => {
            const lastJob = lastJobByAgent.get(agent.id) ?? null;
            return (
              <div key={agent.id} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-200">{agent.name}</span>
                      <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{agent.role}</span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">Trigger: {agent.trigger}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusBadge(lastJob?.status)}`}>
                      {lastJob ? `${lastJob.status} · ${formatRelativeTime(lastJob.started_at)}` : "never run"}
                    </span>
                    {agent.runnable && (
                      <RunAgentButton agent={agent.id} label="Run" confirmMessage={agent.confirm} />
                    )}
                  </div>
                </div>
                <div className="text-xs text-zinc-500 mb-3">{agent.description}</div>
                <div className="flex flex-wrap gap-1">
                  {agent.tools.map((tool) => (
                    <span key={tool} className="text-[10px] text-zinc-600 bg-zinc-800/60 px-2 py-0.5 rounded">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <section>
          <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Recent Runs</h2>
          {recentJobs.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center text-xs text-zinc-600">
              No agent runs yet — trigger one above.
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Agent</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Triggered by</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Duration</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Started</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((job) => (
                    <tr key={job.id} className="border-b border-zinc-800/50 last:border-0 align-top">
                      <td className="px-4 py-3 text-zinc-200 text-xs font-medium">{job.agent_type}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusBadge(job.status)}`}>{job.status}</span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{job.triggered_by}</td>
                      <td className="px-4 py-3 text-zinc-500 text-xs font-mono">{formatDuration(job.duration_ms)}</td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{formatRelativeTime(job.started_at)}</td>
                      <td className="px-4 py-3">
                        <details>
                          <summary className="text-[10px] text-zinc-500 cursor-pointer hover:text-zinc-300">view</summary>
                          {job.error && (
                            <div className="mt-2 text-[10px] text-red-400 max-w-md whitespace-pre-wrap">{job.error}</div>
                          )}
                          <pre className="mt-2 text-[10px] text-zinc-500 bg-zinc-900/80 rounded-lg p-3 max-w-md max-h-64 overflow-auto whitespace-pre-wrap">
{JSON.stringify({ input: job.input, output: job.output }, null, 2)}
                          </pre>
                        </details>
                      </td>
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
