import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

type Constraint = Record<string, string | number>;

type Entry = {
  start: number;
  end: number;
  constraint: Constraint;
};

const sourcePath = join(process.cwd(), "reference/ghostty/src/font/nerd_font_attributes.zig");
const outputPath = join(process.cwd(), "src/fonts/nerd-constraints.ts");

const input = readFileSync(sourcePath, "utf8");

const entries: Entry[] = [];

const pattern = /((?:0x[0-9a-fA-F]+(?:\.\.\.0x[0-9a-fA-F]+)?\s*,\s*)+)=>\s*\.\{([\s\S]*?)\n\s*\},/g;
let match: RegExpExecArray | null;

const parseConstraint = (block: string): Constraint => {
  const constraint: Constraint = {};
  const lineRe = /\.(\w+)\s*=\s*([^,]+),/g;
  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(block))) {
    const key = m[1];
    const raw = m[2].trim();
    let value: string | number = raw;
    if (raw.startsWith(".")) {
      value = raw.slice(1);
    } else if (/^-?\d+\.\d+$/.test(raw)) {
      value = Number(raw);
    } else if (/^-?\d+$/.test(raw)) {
      value = Number(raw);
    }
    constraint[key] = value;
  }
  return constraint;
};

while ((match = pattern.exec(input))) {
  const cpList = match[1];
  const block = match[2];
  const constraint = parseConstraint(block);
  const tokens = cpList
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  for (const token of tokens) {
    if (!token.startsWith("0x")) continue;
    if (token.includes("...")) {
      const [a, b] = token.split("...");
      const start = Number.parseInt(a, 16);
      const end = Number.parseInt(b, 16);
      entries.push({ start, end, constraint });
    } else {
      const start = Number.parseInt(token, 16);
      entries.push({ start, end: start, constraint });
    }
  }
}

entries.sort((a, b) => a.start - b.start || a.end - b.end);

mkdirSync(join(process.cwd(), "src/fonts"), { recursive: true });

const header = `// Generated from ghostty nerd_font_attributes.zig. Do not edit by hand.\n`;
const content = `${header}
export type NerdConstraint = {
  size?: "none" | "fit" | "cover" | "fit_cover1" | "stretch";
  align_horizontal?: "none" | "start" | "end" | "center" | "center1";
  align_vertical?: "none" | "start" | "end" | "center" | "center1";
  height?: "cell" | "icon";
  pad_left?: number;
  pad_right?: number;
  pad_top?: number;
  pad_bottom?: number;
  relative_width?: number;
  relative_height?: number;
  relative_x?: number;
  relative_y?: number;
  max_xy_ratio?: number;
  max_constraint_width?: number;
};

export type NerdConstraintRange = {
  start: number;
  end: number;
  constraint: NerdConstraint;
};

export const NERD_CONSTRAINTS: NerdConstraintRange[] = ${JSON.stringify(entries, null, 2)} as const;

export function getNerdConstraint(cp: number): NerdConstraint | null {
  let lo = 0;
  let hi = NERD_CONSTRAINTS.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const entry = NERD_CONSTRAINTS[mid];
    if (cp < entry.start) {
      hi = mid - 1;
    } else if (cp > entry.end) {
      lo = mid + 1;
    } else {
      return entry.constraint;
    }
  }
  return null;
}
`;

writeFileSync(outputPath, content);
console.log(`Wrote ${entries.length} constraint ranges to ${outputPath}`);
