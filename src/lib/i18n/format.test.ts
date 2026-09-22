import { describe, expect, test } from "vitest";
import { format } from "./format";

describe("format", () => {
  test("fills named placeholders", () => {
    expect(format("Showing {shown} of {total}", { shown: 12, total: 50 })).toBe(
      "Showing 12 of 50",
    );
  });

  test("fills the same placeholder more than once", () => {
    expect(format("{a} and {a}", { a: "x" })).toBe("x and x");
  });

  test("leaves an unknown placeholder visible rather than blanking it", () => {
    // A missing value has to show up in review, not ship as a gap.
    expect(format("Item {sku}", {})).toBe("Item {sku}");
  });

  test("leaves a string with no placeholders untouched", () => {
    expect(format("Request a quote", { sku: "E02" })).toBe("Request a quote");
  });
});
