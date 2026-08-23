import { describe, it, expect } from "vitest";
import { chunkArray, classifyMatchStatus, extractDomain, primaryEmailForMatch } from "./hubspot";

describe("extractDomain", () => {
  it("strips protocol and www", () => {
    expect(extractDomain("https://www.Example.com/path?x=1")).toBe("example.com");
    expect(extractDomain("http://example.com")).toBe("example.com");
  });

  it("adds a protocol when the sheet stored a bare host", () => {
    expect(extractDomain("example.com")).toBe("example.com");
    expect(extractDomain("www.example.com")).toBe("example.com");
  });

  it("lowercases the host", () => {
    expect(extractDomain("HTTPS://Example.COM")).toBe("example.com");
  });

  it("returns null for blank or unparseable input", () => {
    expect(extractDomain(null)).toBeNull();
    expect(extractDomain(undefined)).toBeNull();
    expect(extractDomain("")).toBeNull();
    expect(extractDomain("   ")).toBeNull();
    expect(extractDomain("not a url at all ///")).toBeNull();
  });
});

describe("primaryEmailForMatch", () => {
  it("returns the single email unchanged", () => {
    expect(primaryEmailForMatch("Buyer@Example.com")).toBe("buyer@example.com");
  });

  it("picks the first address out of a multi-email field", () => {
    expect(primaryEmailForMatch("a@x.com; b@y.com")).toBe("a@x.com");
    expect(primaryEmailForMatch("a@x.com,b@y.com")).toBe("a@x.com");
    expect(primaryEmailForMatch("a@x.com/b@y.com")).toBe("a@x.com");
  });

  it("returns null when there's no valid email", () => {
    expect(primaryEmailForMatch(null)).toBeNull();
    expect(primaryEmailForMatch("")).toBeNull();
    expect(primaryEmailForMatch("not an email")).toBeNull();
  });
});

describe("classifyMatchStatus", () => {
  it("is skipped when the lead has neither an email nor a domain", () => {
    expect(
      classifyMatchStatus({ hasEmail: false, hasDomain: false, contactMatched: false, companyMatched: false })
    ).toBe("skipped");
  });

  it("is matched when the contact is found, even without a company match", () => {
    expect(
      classifyMatchStatus({ hasEmail: true, hasDomain: false, contactMatched: true, companyMatched: false })
    ).toBe("matched");
  });

  it("is matched when the company is found, even without a contact match", () => {
    expect(
      classifyMatchStatus({ hasEmail: false, hasDomain: true, contactMatched: false, companyMatched: true })
    ).toBe("matched");
  });

  it("is not_found when identifiers exist but neither side matched in HubSpot", () => {
    expect(
      classifyMatchStatus({ hasEmail: true, hasDomain: true, contactMatched: false, companyMatched: false })
    ).toBe("not_found");
  });
});

describe("chunkArray", () => {
  it("splits into chunks of the given size, last chunk may be smaller", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns a single chunk when size exceeds the array length", () => {
    expect(chunkArray([1, 2], 100)).toEqual([[1, 2]]);
  });

  it("returns an empty array for empty input", () => {
    expect(chunkArray([], 100)).toEqual([]);
  });
});
