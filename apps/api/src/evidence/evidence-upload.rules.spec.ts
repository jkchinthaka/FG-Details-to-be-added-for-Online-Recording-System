import {
  assertAllowedEvidenceExtension,
  normalizeEvidenceFileName,
} from "./evidence-upload.rules";

describe("evidence-upload.rules", () => {
  it("accepts allowed extensions", () => {
    expect(() => assertAllowedEvidenceExtension("photo.JPG")).not.toThrow();
    expect(() => assertAllowedEvidenceExtension("scan.pdf")).not.toThrow();
  });

  it("rejects spoofed extensions", () => {
    expect(() => assertAllowedEvidenceExtension("payload.exe")).toThrow(/not allowed/i);
  });

  it("normalizes unsafe names", () => {
    expect(normalizeEvidenceFileName("../a\\b:c.png")).toBe(".._a_b_c.png");
  });
});
