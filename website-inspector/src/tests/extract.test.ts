import { normalizeText } from "@/lib/extract";

describe("normalizeText", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeText("  Hello\n  world \t ")).toBe("Hello world");
  });
});
