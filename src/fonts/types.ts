export type FontEntry = {
  font: any; // text-shaper Font instance
  label: string;
  glyphCache: Map<string, ShapedCluster>;
  boundsCache: Map<number, number>;
  colorGlyphTexts: Map<number, string>;
  glyphIds: Set<number>;
  atlas: any | null;
  fontSizePx: number;
  atlasScale: number;
  advanceUnits: number;
  constraintSignature?: string;
};

export type ShapedCluster = {
  glyphs: ShapedGlyph[];
  advance: number;
};

export type ShapedGlyph = {
  glyphId: number;
  xAdvance: number;
  yAdvance: number;
  xOffset: number;
  yOffset: number;
};

export type FontManagerState = {
  font: any | null;
  fonts: FontEntry[];
  fontSizePx: number;
  sizeMode: "height" | "width" | "upem";
  fontPickCache: Map<string, number>;
};

export type FallbackFontSource = {
  name: string;
  url: string;
  matchers: string[];
};

export type FontScaleOverride = {
  match: RegExp;
  scale: number;
};
