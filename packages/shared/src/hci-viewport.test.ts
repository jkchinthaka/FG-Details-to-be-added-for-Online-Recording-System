import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("FG-ACC-001 zoom and reflow foundations", () => {
  it("does not pin maximumScale to 1 in the root viewport", () => {
    const layout = readFileSync(
      resolve(__dirname, "../../../apps/web/src/app/layout.tsx"),
      "utf8",
    );
    expect(layout).not.toMatch(/maximumScale\s*:\s*1/);
  });

  it("documents responsive viewport targets used for HCI validation", () => {
    const report = readFileSync(
      resolve(__dirname, "../../../reports/hci/responsive/responsive-report.md"),
      "utf8",
    );
    for (const size of [
      "320x568",
      "360x800",
      "390x844",
      "412x915",
      "768x1024",
      "1024x768",
      "1366x768",
      "1920x1080",
    ]) {
      expect(report).toContain(size);
    }
  });
});
