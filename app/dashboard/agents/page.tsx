import { Header } from "@/components/dashboard/Header";

const agents = [
  {
    name: "CEO Agent",
    id: "ceo",
    role: "Master Orchestrator",
    description: "Reads daily analytics + Scout briefings → issues task queues to all agents. Runs at 8am daily.",
    trigger: "Daily cron + manual",
    tools: ["All DB tables", "All agent triggers", "YouTube Analytics"],
    status: "idle",
    phase: 2,
  },
  {
    name: "Scout Agent",
    id: "scout",
    role: "Trend Intelligence",
    description: "Monitors Google Trends, Reddit, YouTube for trending topics across all niches. Scores by CPM, competition gap, AI producibility.",
    trigger: "Daily from CEO",
    tools: ["SerpAPI", "Reddit API", "YouTube Data API"],
    status: "idle",
    phase: 2,
  },
  {
    name: "Creative Agent",
    id: "creative",
    role: "Brand Architect",
    description: "Receives only a niche from CEO. Independently generates full channel profile: name, tagline, series, brand voice, colors, thumbnail guide.",
    trigger: "Once per channel launch",
    tools: ["Claude API", "Supabase write"],
    status: "idle",
    phase: 2,
  },
  {
    name: "Production Agent",
    id: "production",
    role: "Content Factory",
    description: "Script → ElevenLabs voice → Pexels/Muapi visuals → Creatomate assembly → thumbnail generation. Full pipeline per topic.",
    trigger: "Per topic from CEO",
    tools: ["Claude API", "ElevenLabs", "Pexels", "Muapi", "Creatomate"],
    status: "idle",
    phase: 3,
  },
  {
    name: "Publisher Agent",
    id: "publisher",
    role: "Distribution",
    description: "Posts to YouTube + TikTok via official APIs. Randomizes timing ±90min. Adds AI labels. Manages playlists.",
    trigger: "Per READY video from queue",
    tools: ["YouTube Data API v3", "TikTok Content API"],
    status: "idle",
    phase: 3,
  },
  {
    name: "Analytics Agent",
    id: "analytics",
    role: "Performance Monitor",
    description: "Pulls YouTube Analytics weekly. Identifies top/bottom performers. Feeds strategy recommendations to CEO Agent.",
    trigger: "Weekly Sunday night + on-demand",
    tools: ["YouTube Analytics API", "Supabase read/write"],
    status: "idle",
    phase: 2,
  },
];

export default function AgentsPage() {
  return (
    <div>
      <Header title="Agent Control Panel" subtitle="Monitor and manually trigger all autonomous agents" />
      <div className="p-6 space-y-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-800/20 px-4 py-3 text-xs text-zinc-500">
          All agents are in stub mode during Phase 0. Agent implementation begins in Phase 2 (Weeks 6–10).
          API keys required: Anthropic, Supabase, YouTube, ElevenLabs.
        </div>
        {agents.map((agent) => (
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
                <span className="text-[10px] text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full">Phase {agent.phase}</span>
                <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-zinc-600 inline-block" />
                  Idle
                </span>
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
        ))}
      </div>
    </div>
  );
}
