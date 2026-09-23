import { describe, expect, it } from "vitest";
import { readFinish, withFinish } from "./product-finish";
import { routes } from "./routes";

describe("finish in the URL", () => {
  it("reads nothing when none is chosen", () => {
    expect(readFinish("")).toBeNull();
    expect(readFinish("?product=X")).toBeNull();
  });

  it("round-trips a slug", () => {
    expect(readFinish(`?${withFinish("", "ss04-thunder")}`)).toBe("ss04-thunder");
  });

  it("replaces rather than appends, so choosing twice leaves one value", () => {
    const once = withFinish("", "ss04-thunder").toString();
    const twice = withFinish(`?${once}`, "c00-white");
    expect(twice.getAll("finish")).toEqual(["c00-white"]);
  });

  it("keeps other parameters intact", () => {
    expect(withFinish("?product=E02", "c00-white").get("product")).toBe("E02");
  });
});

describe("routes.quote", () => {
  it("carries the item code alone when no finish is chosen", () => {
    expect(routes.quote("E02-SW30008")).toBe(
      "/contact?product=E02-SW30008#enquiry",
    );
  });

  it("carries the finish when there is one", () => {
    expect(routes.quote("E02-SW30008", "en", "SS04")).toBe(
      "/contact?product=E02-SW30008&finish=SS04#enquiry",
    );
  });

  it("escapes a code containing a space and a plus", () => {
    // Two of the client's SKUs are two codes in one field.
    const href = routes.quote("E01-SW1 +P01", "en");
    expect(href).toContain("product=E01-SW1+%2BP01");
  });
});
