import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FormErrorSummary } from "./FormErrorSummary";
import { Input } from "./Input";

describe("FG-ACC-002 accessible form errors", () => {
  it("renders a focusable error summary", () => {
    const html = renderToStaticMarkup(
      createElement(FormErrorSummary, {
        errors: ["Enter your current password", "New password must include a number"],
      }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("tabindex=\"-1\"");
    expect(html).toContain("Enter your current password");
  });

  it("wires aria-invalid and aria-describedby for field errors", () => {
    const html = renderToStaticMarkup(
      createElement(Input, {
        label: "New password",
        error: "New password must include a symbol",
      }),
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("aria-describedby=");
    expect(html).toContain('role="alert"');
    expect(html).toContain("New password must include a symbol");
  });
});
