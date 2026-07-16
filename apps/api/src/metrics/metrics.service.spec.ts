import { MetricsService } from "./metrics.service";

describe("FG-MON-001 MetricsService", () => {
  it("records counters and durations without PII fields", () => {
    const metrics = new MetricsService();
    metrics.increment("http_requests_total");
    metrics.observeDuration("http_request", 12.5);
    const snap = metrics.snapshot({
      buildId: "abcdef012345",
      commitSha: "abcdef0123456789abcdef0123456789abcdef01",
      service: "nelna-fg-api",
    });
    expect(snap.counters).toMatchObject({ http_requests_total: 1 });
    expect(JSON.stringify(snap)).not.toMatch(/password|cookie|authorization|DATABASE_URL/i);
    expect(snap.buildId).toBe("abcdef012345");
  });
});
