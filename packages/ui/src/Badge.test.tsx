import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders its label text", () => {
    render(<Badge tone="success">Verified</Badge>);
    expect(screen.getByText("Verified")).toBeTruthy();
  });

  it("defaults to the neutral tone", () => {
    render(<Badge>Assigned</Badge>);
    expect(screen.getByText("Assigned").className).toContain("nelna-badge-neutral");
  });

  it("applies the requested tone class for styling", () => {
    render(<Badge tone="danger">Rejected</Badge>);
    expect(screen.getByText("Rejected").className).toContain("nelna-badge-danger");
  });
});
