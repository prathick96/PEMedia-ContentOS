import { NextResponse } from "next/server";
import { listPendingApprovals, resolveApproval } from "@/lib/approvals";

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
    return NextResponse.json({ success: true, approval });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
