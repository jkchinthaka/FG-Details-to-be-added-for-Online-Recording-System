import { describe, expect, it } from "vitest";
import { formatDashboardDate, greetingForHour, toneForTaskCardBucket } from "./format";

describe("greetingForHour", () => {
  it("greets good morning before noon", () => {
    expect(greetingForHour(8)).toBe("Good morning");
  });

  it("greets good afternoon from noon to 5pm", () => {
    expect(greetingForHour(14)).toBe("Good afternoon");
  });

  it("greets good evening after 5pm", () => {
    expect(greetingForHour(19)).toBe("Good evening");
  });

  it("greets good night in the small hours", () => {
    expect(greetingForHour(2)).toBe("Good night");
  });
});

describe("formatDashboardDate", () => {
  it("formats as a long weekday, day, month and year", () => {
    // Constructed from local components (not a UTC ISO string) so the
    // expectation can't drift with the test runner's timezone offset.
    expect(formatDashboardDate(new Date(2026, 6, 14))).toBe("Tuesday, 14 July 2026");
  });
});

describe("toneForTaskCardBucket", () => {
  it("maps completed to success, pending to gold and attention to danger", () => {
    expect(toneForTaskCardBucket("completed")).toBe("success");
    expect(toneForTaskCardBucket("pending")).toBe("gold");
    expect(toneForTaskCardBucket("attention")).toBe("danger");
  });
});
