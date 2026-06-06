import { Header } from "@/components/dashboard/Header";

export default function SeriesDetailPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <Header title="Series Detail" subtitle={`Series ID: ${params.id}`} />
      <div className="p-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center">
          <div className="text-sm text-zinc-500">Series detail page — populated when the Creative Agent generates series in Phase 2</div>
        </div>
      </div>
    </div>
  );
}
