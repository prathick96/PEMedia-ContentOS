"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ApprovalActionsProps {
  approvalId: string;
}

export function ApprovalActions({ approvalId }: ApprovalActionsProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(decision: "approved" | "rejected") {
    if (pendingAction) return;
    setPendingAction(decision);
    setError(null);
    try {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: approvalId, decision }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.error ?? `Failed (HTTP ${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setPendingAction(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => resolve("approved")}
        disabled={pendingAction !== null}
        className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
      >
        {pendingAction === "approved" ? "Approving…" : "Approve"}
      </button>
      <button
        onClick={() => resolve("rejected")}
        disabled={pendingAction !== null}
        className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
      >
        {pendingAction === "rejected" ? "Rejecting…" : "Reject"}
      </button>
      {error && <span className="text-[10px] text-red-400 max-w-[220px] truncate" title={error}>{error}</span>}
    </div>
  );
}
