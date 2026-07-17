import { Injectable } from "@nestjs/common";

type CounterMap = Map<string, number>;
type DurationBucket = { count: number; sumMs: number; maxMs: number };

/**
 * FG-MON-001 — process-local RED metrics (safe labels only; no PII).
 * Multi-instance deployments should scrape each instance or attach a shared backend later.
 */
@Injectable()
export class MetricsService {
  private readonly counters: CounterMap = new Map();
  private readonly durations = new Map<string, DurationBucket>();
  private readonly startedAt = Date.now();

  increment(name: string, by = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }

  observeDuration(name: string, durationMs: number): void {
    const current = this.durations.get(name) ?? { count: 0, sumMs: 0, maxMs: 0 };
    current.count += 1;
    current.sumMs += durationMs;
    current.maxMs = Math.max(current.maxMs, durationMs);
    this.durations.set(name, current);
  }

  snapshot(labels: {
    buildId: string;
    commitSha: string;
    service: string;
  }): Record<string, unknown> {
    const counters: Record<string, number> = {};
    for (const [key, value] of this.counters.entries()) counters[key] = value;

    const durationMs: Record<
      string,
      { count: number; avgMs: number; maxMs: number }
    > = {};
    for (const [key, value] of this.durations.entries()) {
      durationMs[key] = {
        count: value.count,
        avgMs: value.count === 0 ? 0 : Math.round((value.sumMs / value.count) * 10) / 10,
        maxMs: Math.round(value.maxMs * 10) / 10,
      };
    }

    return {
      service: labels.service,
      buildId: labels.buildId,
      commitSha: labels.commitSha,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      generatedAt: new Date().toISOString(),
      counters,
      durationMs,
      notes: [
        "Process-local metrics only — aggregate across instances externally.",
        "No personal data or secrets are included.",
      ],
    };
  }
}
