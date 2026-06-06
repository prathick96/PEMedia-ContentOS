import { Header } from "@/components/dashboard/Header";

export default function ChannelDetailPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <Header title="Channel Detail" subtitle={`Channel ID: ${params.id}`} />
      <div className="p-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center">
          <div className="text-sm text-zinc-500">Channel detail page — populated when channels are launched in Phase 1</div>
        </div>
      </div>
    </div>
  );
}
