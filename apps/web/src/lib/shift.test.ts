import { describe, expect, it } from "vitest";
import { detectCurrentShift } from "./shift";

describe("detectCurrentShift", () => {
  it("returns morning before 14:00", () => {
    expect(detectCurrentShift(new Date("2026-07-13T08:30:00"))).toBe("MORNING");
  });

  it("returns afternoon between 14:00 and 22:00", () => {
    expect(detectCurrentShift(new Date("2026-07-13T16:00:00"))).toBe(
      "AFTERNOON",
    );
  });

  it("returns night from 22:00", () => {
    expect(detectCurrentShift(new Date("2026-07-13T23:15:00"))).toBe("NIGHT");
  });
});
