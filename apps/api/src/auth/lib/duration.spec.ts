import { parseDurationMs } from "./duration";

describe("parseDurationMs", () => {
  it("parses minutes", () => {
    expect(parseDurationMs("15m")).toBe(15 * 60 * 1000);
  });

  it("parses days", () => {
    expect(parseDurationMs("7d")).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("parses seconds and hours", () => {
    expect(parseDurationMs("30s")).toBe(30 * 1000);
    expect(parseDurationMs("2h")).toBe(2 * 60 * 60 * 1000);
  });

  it("is case-insensitive and tolerates surrounding whitespace", () => {
    expect(parseDurationMs(" 15M ")).toBe(15 * 60 * 1000);
  });

  it("throws on an unrecognised format", () => {
    expect(() => parseDurationMs("banana")).toThrow(/Invalid duration/);
    expect(() => parseDurationMs("15")).toThrow(/Invalid duration/);
    expect(() => parseDurationMs("15y")).toThrow(/Invalid duration/);
  });
});
