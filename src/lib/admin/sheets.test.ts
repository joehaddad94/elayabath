import { describe, expect, it } from "vitest";
import { csvLine, normaliseHeader, parseDelimited, protectCell, unprotectCell } from "./sheets";

describe("parseDelimited", () => {
  it("reads quoted fields, doubled quotes and line breaks inside quotes", () => {
    const text = 'Item code,Name,Description\r\nA-1,"Basin, round","Says ""hello""\nover two lines"\r\n';
    expect(parseDelimited(text)).toEqual([
      ["Item code", "Name", "Description"],
      ["A-1", "Basin, round", 'Says "hello"\nover two lines'],
    ]);
  });

  it("drops a byte-order mark and blank lines", () => {
    expect(parseDelimited("﻿a,b\n\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("reads semicolons when the header uses them", () => {
    expect(parseDelimited("Item code;Name\nA-1;Basin")).toEqual([["Item code", "Name"], ["A-1", "Basin"]]);
  });

  it("reads tab-separated files", () => {
    expect(parseDelimited("a\tb\n1\t2", "\t")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("keeps an empty last cell", () => {
    expect(parseDelimited("a,b\n1,")).toEqual([["a", "b"], ["1", ""]]);
  });
});

describe("csvLine", () => {
  it("round-trips through the parser", () => {
    const cells = ["A-1", 'Basin, "round"', "two\nlines", "=SUM(A1)", ""];
    const [row] = parseDelimited(csvLine(cells));
    expect(row!.map(unprotectCell)).toEqual(cells);
  });
});

describe("formula protection", () => {
  it("guards cells a spreadsheet would run", () => {
    expect(protectCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(protectCell("@cmd")).toBe("'@cmd");
    expect(protectCell("Basin")).toBe("Basin");
  });

  it("leaves an ordinary apostrophe alone", () => {
    expect(unprotectCell("'s-Hertogenbosch")).toBe("'s-Hertogenbosch");
  });
});

describe("normaliseHeader", () => {
  it("matches headers written differently", () => {
    expect(normaliseHeader("Item Code")).toBe(normaliseHeader("item_code"));
    expect(normaliseHeader("The Name")).toBe("name");
  });
});
