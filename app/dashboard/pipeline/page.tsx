import { Header } from "@/components/dashboard/Header";
import { PipelineRunner } from "@/components/dashboard/PipelineRunner";
import { getPipelineVideos, type VideoWithContext } from "@/lib/db/queries";
import type { VideoStatus } from "@/lib/db/schema";
import { formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** The 12 video statuses collapse into 6 visual stages. */
const stages: { id: string; label: string; statuses: VideoStatus[]; color: string; bg: string }[] = [
  { id: "idea", label: "Ideas", statuses: ["IDEA", "SCRIPT_PENDING"], color: "text-zinc-400", bg: "bg-zinc-800/50" },
  { id: "script", label: "Script Ready", statuses: ["SCRIPT_DONE", "VOICE_PENDING"], color: "text-sky-400", bg: "bg-sky-500/10" },
  { id: "voice", label: "Voice Ready", statuses: ["VOICE_DONE", "VIDEO_PENDING"], color: "text-purple-400", bg: "bg-purple-500/10" },
  { id: "video", label: "Video Ready", statuses: ["VIDEO_DONE", "THUMBNAIL_DONE"], color: "text-blue-400", bg: "bg-blue-500/10" },
  { id: "ready", label: "Ready to Publish", statuses: ["READY", "SCHEDULED"], color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { id: "published", label: "Published", statuses: ["PUBLISHED", "ARCHIVED"], color: "text-orange-400", bg: "bg-orange-500/10" },
];

function VideoCard({ video }: { video: VideoWithContext }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 space-y-1.5">
      <div className="text-xs text-zinc-200 font-medium leading-snug">{video.title ?? video.topic}</div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-500 truncate">
          {video.series?.channels?.name ?? "—"} · {video.series?.name ?? "—"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-zinc-600 bg-zinc-800/80 px-1.5 py-0.5 rounded font-mono">{video.status}</span>
        <span className="text-[9px] text-zinc-600">{formatRelativeTime(video.created_at)}</span>
      </div>
    </div>
  );
}

export default async function PipelinePage() {
  const videos = await getPipelineVideos();

  const byStage = stages.map((stage) => ({
    ...stage,
    videos: videos.filter((v) => (stage.statuses as string[]).includes(v.status)),
  }));

  return (
    <div>
      <Header title="Content Pipeline" subtitle="Video production status across all channels" />
      <div className="p-6">
        <PipelineRunner />
        <div className="flex gap-3 overflow-x-auto pb-4">
          {byStage.map((stage) => (
            <div key={stage.id} className="flex-none w-52">
              <div className={`flex items-center gap-2 mb-2 px-3 py-1.5 rounded-md ${stage.bg}`}>
                <span className={`text-xs font-medium ${stage.color}`}>{stage.label}</span>
                <span className="ml-auto text-xs text-zinc-600">{stage.videos.length}</span>
              </div>
              <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/20 p-2 min-h-[200px] space-y-2">
                {stage.videos.length === 0 ? (
                  <div className="text-xs text-zinc-700 text-center mt-8">No videos</div>
                ) : (
                  stage.videos.map((v) => <VideoCard key={v.id} video={v} />)
                )}
              </div>
            </div>
          ))}
        </div>
        {videos.length === 0 && (
          <div className="mt-4 text-xs text-zinc-600 text-center">
            Pipeline populates when the Production Agent begins generating content
          </div>
        )}
      </div>
    </div>
  );
}
