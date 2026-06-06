/**
 * LLM Council — public surface.
 *
 *   import { convene, reviewGate } from "@/lib/council";
 *
 *   // Strategic (CEO agent, high-stakes):
 *   const decision = await convene("Which niche do we launch first, and when?", { channels, revenue });
 *
 *   // Tactical (pipeline gate):
 *   const verdict = await reviewGate("channel_launch", { niche: "tech", brandDoc });
 *   if (!verdict.approved) return; // halt
 */
export { convene, reviewGate } from "./council";
export { SEATS, GATE_SEATS, GATE_LABELS } from "./seats";
export type {
  SeatId,
  Seat,
  SeatOpinion,
  CouncilContext,
  CouncilDecision,
  RankedAction,
  GateKind,
  GateVerdict,
  ConveneOptions,
} from "./types";
