import { NextResponse } from "next/server";
import { listPendingApprovals, resolveApproval } from "@/lib/approvals";
import { getServerClient } from "@/lib/db/client";
import { publishApprovedVideo, shouldAutoPublishOnApproval } from "@/lib/publishing/youtube-publish";

/** GET /api/approvals — list everything awaiting the operator's sign-off. */
export async function GET() {
  try {
    const pending = await listPendingApprovals();
    return NextResponse.json({ success: true, pending });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** POST /api/approvals — resolve one: { id, decision: 'approved'|'rejected', note? }. */
export async function POST(req: Request) {
  try {
    const { id, decision, note } = await req.json();
    if (!id || (decision !== "approved" && decision !== "rejected")) {
      return NextResponse.json(
        { success: false, error: "Provide { id, decision: 'approved'|'rejected', note? }" },
        { status: 400 }
      );
    }
    const approval = await resolveApproval(id, decision, note);

    // Approve→upload bridge: approving a publish_video request triggers the actual
    // YouTube upload (Council Brief 003 — upload happens only after human approval).
    // The approval is already resolved; report upload failures without un-resolving it.
    if (shouldAutoPublishOnApproval(approval.action, approval.status) && approval.entity_id) {
      try {
        const publish = await publishApprovedVideo(getServerClient(), approval.entity_id);
        return NextResponse.json({ success: true, approval, publish: { ok: true, ...publish } });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        return NextResponse.json({ success: true, approval, publish: { ok: false, error: message } });
      }
    }

    return NextResponse.json({ success: true, approval });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
