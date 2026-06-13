import { Header } from "@/components/dashboard/Header";
import { ApprovalActions } from "@/components/dashboard/ApprovalActions";
import { getPendingApprovals, getResolvedApprovals } from "@/lib/db/queries";
import { formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, { label: string; description: string }> = {
  launch_channel: { label: "Launch Channel", description: "Move a channel from building → active" },
  publish_video: { label: "Publish Video", description: "Allow the uploader to push this video live" },
  schedule_video: { label: "Schedule Video", description: "Confirm the scheduled publish slot" },
  spend_money: { label: "Spend Money", description: "Authorize a paid service or upgrade" },
};

interface CouncilVerdictView {
  approved?: boolean;
  confidence?: number;
  rationale?: string;
  conditions?: string[];
}

export default async function ApprovalsPage() {
  const [pending, resolved] = await Promise.all([getPendingApprovals(), getResolvedApprovals(15)]);

  return (
    <div>
      <Header
        title="Approvals"
        subtitle="High-stakes actions pause here for your sign-off — nothing publishes or launches without you"
      />
      <div className="p-6 space-y-6">

        <section>
          <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">
            Pending ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
              <div className="text-3xl mb-3 text-zinc-700">✓</div>
              <div className="text-sm font-medium text-zinc-400 mb-1">Nothing awaiting approval</div>
              <div className="text-xs text-zinc-600 max-w-sm mx-auto">
                When an agent wants to launch a channel, publish a video, or spend money,
                the request appears here and the agent halts until you decide.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((approval) => {
                const meta = ACTION_LABELS[approval.action] ?? { label: approval.action, description: "" };
                const verdict = approval.council_verdict as CouncilVerdictView | null;
                return (
                  <div key={approval.id} className="rounded-xl border border-orange-500/20 bg-zinc-900/40 p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-zinc-100">{meta.label}</span>
                          <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                            requested by {approval.requested_by}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {meta.description} · {formatRelativeTime(approval.created_at)}
                        </div>
                      </div>
                      <ApprovalActions approvalId={approval.id} />
                    </div>

                    {verdict && (
                      <div className={`rounded-lg border p-3 ${verdict.approved ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                        <div className="text-[10px] uppercase tracking-wider mb-1 text-zinc-500">
                          Council verdict — {verdict.approved ? "approved" : "not approved"}
                          {typeof verdict.confidence === "number" && ` · confidence ${(verdict.confidence * 100).toFixed(0)}%`}
                        </div>
                        {verdict.rationale && <div className="text-xs text-zinc-400">{verdict.rationale}</div>}
                        {verdict.conditions && verdict.conditions.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5">
                            {verdict.conditions.map((c, i) => (
                              <li key={i} className="text-[10px] text-zinc-500">• {c}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    <details>
                      <summary className="text-[10px] text-zinc-500 cursor-pointer hover:text-zinc-300">
                        Full request payload
                      </summary>
                      <pre className="mt-2 text-[10px] text-zinc-500 bg-zinc-900/80 rounded-lg p-3 max-h-64 overflow-auto whitespace-pre-wrap">
{JSON.stringify(approval.payload, null, 2)}
                      </pre>
                    </details>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {resolved.length > 0 && (
          <section>
            <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Recently Resolved</h2>
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Action</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Decision</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Requested by</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Resolved</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {resolved.map((a) => (
                    <tr key={a.id} className="border-b border-zinc-800/50 last:border-0">
                      <td className="px-4 py-3 text-zinc-300 text-xs">{ACTION_LABELS[a.action]?.label ?? a.action}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${a.status === "approved" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{a.requested_by}</td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{formatRelativeTime(a.resolved_at)}</td>
                      <td className="px-4 py-3 text-zinc-600 text-xs">{a.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
