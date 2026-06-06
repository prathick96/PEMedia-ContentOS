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

export abstract class BaseAgent {
  abstract readonly type: AgentType;
  abstract readonly systemPrompt: string;

  protected db = getServerClient();

  async run(input: AgentInput): Promise<AgentOutput> {
    const job = await this.createJob(input);
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

  protected async callClaude(prompt: string): Promise<string> {
    return generateText(this.systemPrompt, prompt);
  }

  private async createJob(input: AgentInput) {
    const { data, error } = await this.db
      .from("agent_jobs")
      .insert({
        agent_type: this.type,
        status: "running",
        input,
        triggered_by: "manual",
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
