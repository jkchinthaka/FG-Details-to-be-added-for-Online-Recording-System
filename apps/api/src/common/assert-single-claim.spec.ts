import { assertSingleClaim } from "./assert-single-claim";
import { StaleStateException } from "./stale-state.exception";

describe("assertSingleClaim", () => {
  it("accepts exactly one update", () => {
    expect(() => assertSingleClaim({ count: 1 })).not.toThrow();
  });

  it("throws STALE_STATE when zero rows claimed", () => {
    try {
      assertSingleClaim({ count: 0 });
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(StaleStateException);
      const body = (error as StaleStateException).getResponse() as {
        code: string;
      };
      expect(body.code).toBe("STALE_STATE");
    }
  });
});
