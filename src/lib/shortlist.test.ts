import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SHORTLIST_KEY,
  addToShortlist,
  clearShortlist,
  getShortlistServerSnapshot,
  getShortlistSnapshot,
  parseShortlist,
  removeFromShortlist,
  shortlistCodes,
  shortlistFinishes,
} from "./shortlist";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
});
vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {} });

const item = (sku: string, finish?: string) => ({
  sku,
  slug: sku.toLowerCase(),
  name: `Product ${sku}`,
  ...(finish ? { finish } : {}),
});

describe("shortlist", () => {
  beforeEach(() => {
    store.clear();
  });

  it("starts empty and renders empty on the server", () => {
    expect(parseShortlist(getShortlistSnapshot())).toEqual([]);
    expect(getShortlistServerSnapshot()).toBe("[]");
  });

  it("adds and removes items", () => {
    addToShortlist(item("E01"));
    addToShortlist(item("E02"));
    expect(parseShortlist(getShortlistSnapshot()).map((i) => i.sku)).toEqual([
      "E01",
      "E02",
    ]);
    removeFromShortlist("E01");
    expect(parseShortlist(getShortlistSnapshot()).map((i) => i.sku)).toEqual(["E02"]);
  });

  it("updates the finish instead of duplicating the item", () => {
    addToShortlist(item("E01", "SS04"));
    addToShortlist(item("E01", "C00"));
    const items = parseShortlist(getShortlistSnapshot());
    expect(items).toHaveLength(1);
    expect(items[0]?.finish).toBe("C00");
  });

  it("returns a snapshot that compares equal when nothing changed", () => {
    // useSyncExternalStore compares with Object.is, so an unchanged store has
    // to yield an identical value or the component re-renders forever.
    addToShortlist(item("E01"));
    expect(getShortlistSnapshot()).toBe(getShortlistSnapshot());
  });

  it("survives anything already sitting in storage", () => {
    expect(parseShortlist("not json")).toEqual([]);
    expect(parseShortlist('{"not":"an array"}')).toEqual([]);
    expect(parseShortlist('[{"sku":"E01"}]')).toEqual([]);
    expect(parseShortlist('[null,3,"x"]')).toEqual([]);
  });

  it("formats codes and finishes for the enquiry form", () => {
    const items = [item("E01", "SS04"), item("E02")];
    expect(shortlistCodes(items)).toBe("E01, E02");
    expect(shortlistFinishes(items)).toBe("E01: SS04");
  });

  it("clears", () => {
    addToShortlist(item("E01"));
    clearShortlist();
    expect(parseShortlist(getShortlistSnapshot())).toEqual([]);
  });

  it("keeps working when storage throws, as in a private window", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => addToShortlist(item("E01"))).not.toThrow();
    expect(parseShortlist(getShortlistSnapshot())).toEqual([]);
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  });

  it("uses a namespaced key", () => {
    expect(SHORTLIST_KEY).toBe("elaya-shortlist");
  });
});
