import { generateText, parseJsonResponse, MODELS } from "@/lib/anthropic";
import { getServerClient } from "@/lib/db/client";
import {
  SEATS,
  SEATS_BY_ID,
  GATE_SEATS,
  GATE_LABELS,
  CHAIRMAN_PROMPT,
  gateChairmanPrompt,
} from "./seats";
import type {
  Seat,
  SeatOpinion,
  CouncilContext,
  CouncilDecision,
  ConveneOptions,
  GateKind,
  GateVerdict,
  RankedAction,
} from "./types";

const clamp01 = (n: unknown): number => {
  const v = typeof n === "number" ? n : Number(n);
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
};

interface RawSeatJson {
  position?: string;
  recommendation?: string;
  confidence?: number;
  risks?: string[];
}

/** Run one seat against the question. Never throws — a failed seat is recorded, not fatal. */
async function runSeat(
  seat: Seat,
  question: string,
  context: CouncilContext
): Promise<SeatOpinion> {
  const userMessage = `CONVENING QUESTION:
${question}

CONTEXT (JSON):
${JSON.stringify(context, null, 2)}

Respond as the ${seat.title} seat. Output strict JSON only.`;

  try {
    const raw = await generateText(seat.systemPrompt, userMessage, {
      temperature: seat.temperature,
    });
    const p = parseJsonResponse<RawSeatJson>(raw);
    return {
      seat: seat.id,
      title: seat.title,
      position: p.position ?? "",
      recommendation: p.recommendation ?? "",
      confidence: clamp01(p.confidence),
      risks: Array.isArray(p.risks) ? p.risks : [],
      raw,
    };
  } catch (err) {
    return {
      seat: seat.id,
      title: seat.title,
      position: "(seat failed to respond)",
      recommendation: "",
      confidence: 0,
      risks: [err instanceof Error ? err.message : String(err)],
      raw: "",
    };
  }
}

/** Compact opinions for the chairman prompt (drop raw text to save tokens). */
const forChairman = (o: SeatOpinion) => ({
  seat: o.title,
  position: o.position,
  recommendation: o.recommendation,
  confidence: o.confidence,
  risks: o.risks,
});

interface RawChairmanJson {
  decision?: string;
  rationale?: string;
  confidence?: number;
  ranked_actions?: RankedAction[];
  dissents?: string[];
}

/**
 * STRATEGIC mode. Convene all five seats in parallel, then synthesize a ranked
 * decision via the Chairman. Used by the CEO agent for high-stakes calls.
 */
export async function convene(
  question: string,
  context: CouncilContext = {},
  opts: ConveneOptions = {}
): Promise<CouncilDecision> {
  const opinions = await Promise.all(SEATS.map((s) => runSeat(s, question, context)));

  const chairmanUser = `CONVENING QUESTION:
${question}

SEAT OPINIONS (JSON):
${JSON.stringify(opinions.map(forChairman), null, 2)}

Synthesize the council's decision. Output strict JSON only.`;

  const raw = await generateText(CHAIRMAN_PROMPT, chairmanUser, {
    model: opts.chairmanModel ?? MODELS.chairman,
    temperature: 0.2,
  });
  const c = parseJsonResponse<RawChairmanJson>(raw);

  const decision: CouncilDecision = {
    mode: "strategic",
    question,
    decision: c.decision ?? "",
    rationale: c.rationale ?? "",
    confidence: clamp01(c.confidence),
    rankedActions: Array.isArray(c.ranked_actions) ? c.ranked_actions : [],
    dissents: Array.isArray(c.dissents) ? c.dissents : [],
    opinions,
    convenedAt: new Date().toISOString(),
  };

  if (opts.persist !== false) await persist("strategic", question, decision);
  return decision;
}

interface RawGateJson {
  approved?: boolean;
  confidence?: number;
  rationale?: string;
  conditions?: string[];
}

/**
 * TACTICAL mode. A focused binary gate wired into the content pipeline:
 * channel-launch greenlight, topic greenlight, or series-kill review. Convenes
 * only the relevant seats. Returns approved=false on any internal failure
 * (fail-closed — never auto-approve a high-stakes action on an error).
 */
export async function reviewGate(
  kind: GateKind,
  payload: CouncilContext,
  context: CouncilContext = {},
  opts: ConveneOptions = {}
): Promise<GateVerdict> {
  const label = GATE_LABELS[kind];
  const seats = GATE_SEATS[kind].map((id) => SEATS_BY_ID[id]);

  const question = `TACTICAL GATE — ${label}.
Proposal under review (JSON):
${JSON.stringify(payload, null, 2)}

Should this proceed? Judge strictly within your mandate.`;

  const opinions = await Promise.all(seats.map((s) => runSeat(s, question, context)));

  let verdict: GateVerdict = {
    mode: "tactical",
    kind,
    approved: false,
    confidence: 0,
    rationale: "",
    conditions: [],
    opinions,
    convenedAt: new Date().toISOString(),
  };

  try {
    const chairmanUser = `GATE: ${label}
PROPOSAL (JSON):
${JSON.stringify(payload, null, 2)}

SEAT OPINIONS (JSON):
${JSON.stringify(opinions.map(forChairman), null, 2)}

Render the binary verdict. Output strict JSON only.`;

    const raw = await generateText(gateChairmanPrompt(kind, label), chairmanUser, {
      model: opts.chairmanModel ?? MODELS.chairman,
      temperature: 0.1,
    });
    const g = parseJsonResponse<RawGateJson>(raw);
    verdict = {
      ...verdict,
      approved: g.approved === true,
      confidence: clamp01(g.confidence),
      rationale: g.rationale ?? "",
      conditions: Array.isArray(g.conditions) ? g.conditions : [],
    };
  } catch (err) {
    verdict.rationale = `Gate failed closed: ${err instanceof Error ? err.message : String(err)}`;
  }

  if (opts.persist !== false) await persist(kind, label, verdict);
  return verdict;
}

/** Best-effort audit log. Never throws — a missing DB must not break a decision. */
async function persist(
  kind: string,
  question: string,
  result: CouncilDecision | GateVerdict
): Promise<void> {
  try {
    const db = getServerClient();
    await db.from("council_decisions").insert({
      kind,
      question,
      mode: result.mode,
      decision: result.mode === "strategic" ? result.decision : result.rationale,
      approved: result.mode === "tactical" ? result.approved : null,
      confidence: result.confidence,
      payload: result,
      convened_at: result.convenedAt,
    });
  } catch {
    // Phase 1 may run before Supabase is configured; logging is non-critical.
  }
}
