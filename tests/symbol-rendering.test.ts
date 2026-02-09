import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isSymbolCp } from "../src/renderer/shapes";

test("transport-control symbols are treated as symbol-like glyphs", () => {
  expect(isSymbolCp(0x23f5)).toBe(true); // ⏵
  expect(isSymbolCp(0x23fa)).toBe(true); // ⏺
  expect(isSymbolCp(0x41)).toBe(false); // A
});

test("both render loops center unconstrained symbol-font glyphs vertically", () => {
  const source = readFileSync(join(process.cwd(), "src/app/index.ts"), "utf8");
  const matches = source.match(/x = item\.x \+ \(maxWidth - gw\) \* 0\.5;\s+y = rowY \+ \(cellH - gh\) \* 0\.5;/g) ?? [];
  expect(matches.length).toBe(2);
});
