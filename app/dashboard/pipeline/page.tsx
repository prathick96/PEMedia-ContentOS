import { Header } from "@/components/dashboard/Header";

const stages = [
  { id: "IDEA", label: "Ideas", color: "text-zinc-400", bg: "bg-zinc-800/50" },
  { id: "SCRIPT_DONE", label: "Script Ready", color: "text-sky-400", bg: "bg-sky-500/10" },
  { id: "VOICE_DONE", label: "Voice Ready", color: "text-purple-400", bg: "bg-purple-500/10" },
  { id: "VIDEO_DONE", label: "Video Ready", color: "text-blue-400", bg: "bg-blue-500/10" },
  { id: "READY", label: "Ready to Publish", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { id: "PUBLISHED", label: "Published", color: "text-orange-400", bg: "bg-orange-500/10" },
];

export default function PipelinePage() {
  return (
    <div>
      <Header title="Content Pipeline" subtitle="Video production status across all channels" />
      <div className="p-6">
        <div className="flex gap-3 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <div key={stage.id} className="flex-none w-52">
              <div className={`flex items-center gap-2 mb-2 px-3 py-1.5 rounded-md ${stage.bg}`}>
                <span className={`text-xs font-medium ${stage.color}`}>{stage.label}</span>
                <span className="ml-auto text-xs text-zinc-600">0</span>
              </div>
              <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/20 p-3 min-h-[200px]">
                <div className="text-xs text-zinc-700 text-center mt-8">No videos</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-xs text-zinc-600 text-center">
          Pipeline populates when the Production Agent begins generating content
        </div>
      </div>
    </div>
  );
}
