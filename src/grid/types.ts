export type GridState = {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  fontSizePx: number;
  scale: number;
  lineHeight: number;
  baselineOffset: number;
  yPad: number;
};

export type CellMetrics = {
  cellW: number;
  cellH: number;
  fontSizePx: number;
  scale: number;
  lineHeight: number;
  baselineOffset: number;
  yPad: number;
};

export type GridConfig = {
  fontSize: number;
  sizeMode: "height" | "width" | "upem";
};
