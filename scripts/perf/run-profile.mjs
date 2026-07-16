#!/usr/bin/env node
/**
 * FG-PERF-001 — isolated non-production performance smoke harness.
 * Never point PERF_BASE_URL at production.
 *
 * Profiles: smoke|normal|load|target|spike|soak (concurrency only; duration short).
 */
"use strict";

const { performance } = require("node:perf_hooks");

function env(name, fallback = "") {
  return (process.env[name] || fallback).trim();
}

const BASE = env("PERF_BASE_URL", "http://127.0.0.1:3001").replace(/\/$/, "");
const PROFILE = env("PERF_PROFILE", "smoke");
const ALLOW_PROD = env("PERF_ALLOW_PRODUCTION") === "YES";

const PROFILES = {
  smoke: { users: 1, iterations: 3 },
  normal: { users: 10, iterations: 5 },
  load: { users: 50, iterations: 3 },
  target: { users: 100, iterations: 2 },
  spike: { users: 80, iterations: 2 },
  soak: { users: 10, iterations: 20 },
};

if (/nelna\.lk|onrender\.com|workers\.dev/i.test(BASE) && !ALLOW_PROD) {
  console.error("Refusing to load-test a production-like URL without PERF_ALLOW_PRODUCTION=YES");
  process.exit(2);
}

const profile = PROFILES[PROFILE] || PROFILES.smoke;

const ENDPOINTS = [
  { name: "health_live", path: "/health/live", auth: false },
  { name: "health", path: "/health", auth: false },
  { name: "health_ready", path: "/health/ready", auth: false },
  { name: "release", path: "/health/release", auth: false },
];

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function timedFetch(path) {
  const started = performance.now();
  let status = 0;
  let ok = false;
  let timedOut = false;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15_000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    status = res.status;
    ok = res.ok;
    await res.arrayBuffer();
  } catch {
    ok = false;
  } finally {
    clearTimeout(timer);
  }
  return {
    durationMs: performance.now() - started,
    status,
    ok,
    timedOut,
  };
}

async function worker(iterations) {
  const samples = [];
  for (let i = 0; i < iterations; i += 1) {
    for (const endpoint of ENDPOINTS) {
      const sample = await timedFetch(endpoint.path);
      samples.push({ endpoint: endpoint.name, ...sample });
    }
  }
  return samples;
}

async function main() {
  console.log(
    JSON.stringify({
      event: "perf_start",
      base: BASE,
      profile: PROFILE,
      users: profile.users,
      iterations: profile.iterations,
    }),
  );

  const workers = Array.from({ length: profile.users }, () =>
    worker(profile.iterations),
  );
  const nested = await Promise.all(workers);
  const samples = nested.flat();
  const byEndpoint = {};
  for (const sample of samples) {
    byEndpoint[sample.endpoint] ||= [];
    byEndpoint[sample.endpoint].push(sample);
  }

  const summary = {};
  for (const [name, list] of Object.entries(byEndpoint)) {
    const durations = list.map((s) => s.durationMs).sort((a, b) => a - b);
    const errors = list.filter((s) => !s.ok).length;
    const timeouts = list.filter((s) => s.timedOut).length;
    const totalMs = durations.reduce((a, b) => a + b, 0);
    summary[name] = {
      count: list.length,
      p50: percentile(durations, 50),
      p95: percentile(durations, 95),
      p99: percentile(durations, 99),
      errorRate: list.length ? errors / list.length : 0,
      timeoutRate: list.length ? timeouts / list.length : 0,
      throughputRps: totalMs > 0 ? list.length / (totalMs / 1000) : null,
    };
  }

  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    profile: PROFILE,
    summary,
    note: "Auth-bearing routes require a separate UAT session harness; this smoke hits public health/release only.",
  };
  console.log(JSON.stringify(report, null, 2));

  const health = summary.health_live;
  if (!health || health.errorRate > 0.05) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
