"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ApprovalActionsProps {
  approvalId: string;
}

interface PublishInfo {
  ok: boolean;
  error?: string;
  url?: string;
  privacyStatus?: string;
  requiresStudioDisclosure?: boolean;
}

export function ApprovalActions({ approvalId }: ApprovalActionsProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; kind: "ok" | "warn" } | null>(null);

  async function resolve(decision: "approved" | "rejected") {
    if (pendingAction) return;
    setPendingAction(decision);
    setError(null);
    setNotice(null);
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

      const publish = json.publish as PublishInfo | undefined;
      if (publish) {
        if (publish.ok) {
          const disclosure = publish.requiresStudioDisclosure
            ? " Set the AI disclosure in YouTube Studio, then publish."
            : "";
          setNotice({ text: `Uploaded as ${publish.privacyStatus}.${disclosure}`, kind: "ok" });
        } else {
          setNotice({
            text: `Approved, but upload failed: ${publish.error} — retry via /api/youtube/publish.`,
            kind: "warn",
          });
        }
        // Give the operator a moment to read the upload outcome before the row clears.
        setTimeout(() => router.refresh(), 6000);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setPendingAction(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
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
      </div>
      {error && <span className="text-[10px] text-red-400 max-w-[260px] truncate" title={error}>{error}</span>}
      {notice && (
        <span
          className={`text-[10px] max-w-[300px] ${notice.kind === "ok" ? "text-emerald-400" : "text-amber-400"}`}
          title={notice.text}
        >
          {notice.text}
        </span>
      )}
    </div>
  );
}
