import { generateText } from "@/lib/anthropic";
import { getServerClient } from "@/lib/db/client";
import type { AgentType, AgentJob } from "@/lib/db/schema";

export interface AgentInput {
  [key: string]: unknown;
}

export interface AgentOutput {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

/** Provenance for an agent run — recorded on agent_jobs.triggered_by. */
export type TriggeredBy = "ceo" | "manual" | "cron";

export interface RunOptions {
  /** Who triggered this run. Defaults to "manual". Cron schedules pass "cron". */
  triggeredBy?: TriggeredBy;
}

export abstract class BaseAgent {
  abstract readonly type: AgentType;
  abstract readonly systemPrompt: string;

  protected db = getServerClient();

  async run(input: AgentInput, opts?: RunOptions): Promise<AgentOutput> {
    const job = await this.createJob(input, opts?.triggeredBy ?? "manual");
    const startedAt = Date.now();

    try {
      const output = await this.execute(input);
      await this.updateJob(job.id, "completed", output, Date.now() - startedAt);
      return { success: true, data: output };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await this.updateJob(job.id, "failed", {}, Date.now() - startedAt, error);
      return { success: false, error };
    }
  }

  protected abstract execute(input: AgentInput): Promise<Record<string, unknown>>;

  protected async callClaude(prompt: string, opts?: { maxTokens?: number }): Promise<string> {
    return generateText(this.systemPrompt, prompt, { maxTokens: opts?.maxTokens });
  }

  private async createJob(input: AgentInput, triggeredBy: TriggeredBy) {
    const { data, error } = await this.db
      .from("agent_jobs")
      .insert({
        agent_type: this.type,
        status: "running",
        input,
        triggered_by: triggeredBy,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create agent job: ${error.message}`);
    return data as AgentJob;
  }

  private async updateJob(
    id: string,
    status: "completed" | "failed",
    output: Record<string, unknown>,
    durationMs: number,
    error?: string
  ) {
    await this.db
      .from("agent_jobs")
      .update({
        status,
        output,
        duration_ms: durationMs,
        error: error ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", id);
  }
}
