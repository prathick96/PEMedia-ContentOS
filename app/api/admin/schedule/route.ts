/**
 * app/api/admin/schedule/route.ts
 *
 * Admin endpoint to manage the daily CEO QStash schedule.
 * Call once after deploy to register the cron; use GET to inspect, DELETE to remove.
 *
 *   POST   /api/admin/schedule  → create/update the daily CEO schedule (idempotent)
 *   GET    /api/admin/schedule  → current schedule status
 *   DELETE /api/admin/schedule  → remove the schedule
 *
 * Protected by a bearer secret (NOT QStash-signed — this is operator tooling):
 *   Authorization: Bearer <CRON_ADMIN_SECRET>
 *
 * Example:
 *   curl -X POST https://your-app.vercel.app/api/admin/schedule \
 *        -H "Authorization: Bearer $CRON_ADMIN_SECRET"
 */

import { NextResponse } from "next/server";
import {
  registerCeoSchedule,
  getCeoSchedule,
  removeCeoSchedule,
  CEO_SCHEDULE_ID,
  CEO_CRON,
} from "@/lib/scheduling/ceo-schedule";

/** Constant-time-ish bearer check against CRON_ADMIN_SECRET. */
function authorize(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  const secret = process.env.CRON_ADMIN_SECRET;
  if (!secret) {
    return { ok: false, status: 500, error: "CRON_ADMIN_SECRET is not configured on the server" };
  }
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token !== secret) {
    return { ok: false, status: 401, error: "Unauthorized — invalid or missing bearer token" };
  }
  return { ok: true };
}

export async function POST(req: Request) {
  const auth = authorize(req);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  try {
    const info = await registerCeoSchedule();
    return NextResponse.json({
      success: true,
      message: `Daily CEO schedule registered (${CEO_CRON} UTC)`,
      schedule: info,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const auth = authorize(req);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  try {
    const schedule = await getCeoSchedule();
    return NextResponse.json({
      success: true,
      registered: schedule !== null,
      scheduleId: CEO_SCHEDULE_ID,
      cron: CEO_CRON,
      schedule,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = authorize(req);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  try {
    await removeCeoSchedule();
    return NextResponse.json({ success: true, message: "Daily CEO schedule removed" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
