/**
 * LLM Council — type definitions.
 *
 * The council is a multi-persona, single-model decision engine: one Claude
 * model reasons independently from each of five expert "seats", then a
 * Chairman pass synthesizes a ranked decision. It operates in two modes:
 *   - strategic:  convene() — open-ended high-stakes decisions for the CEO agent
 *   - tactical:   reviewGate() — binary approve/reject checkpoints in the pipeline
 *
 * See docs/strategy/council-brief-001.md for the design rationale.
 */

export type SeatId = "strategist" | "growth" | "risk" | "finance" | "tech";

export interface Seat {
  id: SeatId;
  title: string;
  systemPrompt: string;
  /** Seats reason with mild diversity; the Chairman synthesizes at low temp. */
  temperature: number;
}

/** One seat's independent opinion on the convening question. */
export interface SeatOpinion {
  seat: SeatId;
  title: string;
  position: string;
  recommendation: string;
  /** 0–1 self-reported confidence. */
  confidence: number;
  risks: string[];
  /** Full raw model text, retained for audit. Empty if the seat errored. */
  raw: string;
}

export type CouncilContext = Record<string, unknown>;

export interface RankedAction {
  action: string;
  priority: "high" | "medium" | "low";
  reason: string;
}

/** Output of a strategic convene(). */
export interface CouncilDecision {
  mode: "strategic";
  question: string;
  decision: string;
  rationale: string;
  /** 0–1 chairman confidence in the synthesized decision. */
  confidence: number;
  rankedActions: RankedAction[];
  /** Preserved minority positions — never averaged away. */
  dissents: string[];
  opinions: SeatOpinion[];
  convenedAt: string;
}

/** Tactical decision gates wired into the content pipeline. */
export type GateKind = "channel_launch" | "topic_greenlight" | "series_kill";

/** Output of a tactical reviewGate(). */
export interface GateVerdict {
  mode: "tactical";
  kind: GateKind;
  approved: boolean;
  confidence: number;
  rationale: string;
  /** Conditions that must hold for the approval to stand. */
  conditions: string[];
  opinions: SeatOpinion[];
  convenedAt: string;
}

export interface ConveneOptions {
  /** Override the chairman model (e.g. "claude-opus-4-6" for high-stakes). */
  chairmanModel?: string;
  /** Persist the decision to council_decisions. Default true; best-effort. */
  persist?: boolean;
}
