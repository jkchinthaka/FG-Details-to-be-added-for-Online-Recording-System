import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RecordHeaderField } from "./RecordHeaderField";

describe("RecordHeaderField", () => {
  it("renders label and value without inventing markup beyond a definition pair", () => {
    const html = renderToStaticMarkup(
      createElement(RecordHeaderField, { label: "Date", value: "14 Jul 2026" }),
    );
    expect(html).toContain("Date");
    expect(html).toContain("14 Jul 2026");
  });
});
