import { getServerClient } from "@/lib/db/client";

/**
 * Human-in-the-loop approval gate.
 *
 * Per Council Brief 001 (decision #4), high-stakes actions — anything that
 * publishes content, spends money, or launches a channel — must pause for the
 * operator's sign-off. This is the venture's compliance moat, not a bottleneck.
 *
 * Flow:
 *   1. An agent calls requireApproval(action, payload) → inserts a 'pending' row.
 *   2. The agent HALTS (does not perform the action) while status is 'pending'.
 *   3. The operator resolves it (dashboard / API) → resolveApproval(id, 'approved').
 *   4. A later agent run sees 'approved' and proceeds.
 *
 * Fail-closed: if the action is not explicitly 'approved', the caller must not act.
 */

export type ApprovalAction =
  | "launch_channel"
  | "publish_video"
  | "schedule_video"
  | "spend_money";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface Approval {
  id: string;
  action: ApprovalAction;
  status: ApprovalStatus;
  /** Arbitrary structured context the operator needs to decide. */
  payload: Record<string, unknown>;
  /** Optional council verdict attached to inform the human decision. */
  council_verdict: Record<string, unknown> | null;
  /** Optional links back to the entity awaiting approval. */
  entity_type: string | null;
  entity_id: string | null;
  note: string | null;
  requested_by: string;
  created_at: string;
  resolved_at: string | null;
}

export interface RequireApprovalOptions {
  entityType?: string;
  entityId?: string;
  requestedBy?: string;
  councilVerdict?: Record<string, unknown>;
}

/** Create a pending approval. The caller MUST NOT perform the action until approved. */
export async function requireApproval(
  action: ApprovalAction,
  payload: Record<string, unknown>,
  opts: RequireApprovalOptions = {}
): Promise<Approval> {
  const db = getServerClient();
  const { data, error } = await db
    .from("approvals")
    .insert({
      action,
      status: "pending",
      payload,
      council_verdict: opts.councilVerdict ?? null,
      entity_type: opts.entityType ?? null,
      entity_id: opts.entityId ?? null,
      requested_by: opts.requestedBy ?? "system",
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create approval: ${error.message}`);
  return data as Approval;
}

export async function getApproval(id: string): Promise<Approval | null> {
  const db = getServerClient();
  const { data } = await db.from("approvals").select("*").eq("id", id).single();
  return (data as Approval) ?? null;
}

/** True only when the approval exists and is explicitly approved (fail-closed). */
export async function isApproved(id: string): Promise<boolean> {
  const a = await getApproval(id);
  return a?.status === "approved";
}

export async function listPendingApprovals(): Promise<Approval[]> {
  const db = getServerClient();
  const { data } = await db
    .from("approvals")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  return (data as Approval[]) ?? [];
}

/** Operator resolves an approval. Called from the dashboard / approvals API route. */
export async function resolveApproval(
  id: string,
  decision: "approved" | "rejected",
  note?: string
): Promise<Approval> {
  const db = getServerClient();
  const { data, error } = await db
    .from("approvals")
    .update({
      status: decision,
      note: note ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending") // only resolve still-pending rows
    .select()
    .single();

  if (error) throw new Error(`Failed to resolve approval: ${error.message}`);
  return data as Approval;
}
