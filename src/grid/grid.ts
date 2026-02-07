import type { CellMetrics, GridConfig, GridState } from "./types";

export type FontMetricsProvider = {
  scaleForSize(sizePx: number, sizeMode: string): number;
  glyphIdForChar(char: string): number | undefined | null;
  advanceWidth(glyphId: number): number;
  readonly ascender: number;
  readonly descender?: number;
  readonly height?: number;
  readonly upem: number;
};

export type ShapeResult = {
  advance: number;
};

export function fontHeightUnits(font: FontMetricsProvider): number {
  if (!font) return 0;
  const height = font.height;
  if (height !== undefined && Number.isFinite(height) && height > 0) return height;
  const asc = font.ascender ?? 0;
  const desc = font.descender ?? 0;
  const fallback = asc - desc;
  if (Number.isFinite(fallback) && fallback > 0) return fallback;
  return font.upem || 1000;
}

export function computeCellMetrics(
  font: FontMetricsProvider,
  config: GridConfig,
  dpr: number,
  shapeCluster: (text: string) => ShapeResult,
): CellMetrics | null {
  if (!font) return null;

  const fontSizePx = Math.max(1, Math.round(config.fontSize * dpr));
  const scale = font.scaleForSize(fontSizePx, config.sizeMode);
  const glyphId = font.glyphIdForChar("M");
  const advanceUnits =
    glyphId !== undefined && glyphId !== null
      ? font.advanceWidth(glyphId)
      : shapeCluster("M").advance;
  const cellW = Math.max(1, Math.round(advanceUnits * scale));
  const lineHeight = fontHeightUnits(font) * scale;
  const cellH = Math.max(1, Math.round(lineHeight));
  const baselineOffset = font.ascender * scale;
  const yPad = Math.max(0, (cellH - lineHeight) * 0.5);

  return { cellW, cellH, fontSizePx, scale, lineHeight, baselineOffset, yPad };
}

export function createGridState(): GridState {
  return {
    cols: 0,
    rows: 0,
    cellW: 0,
    cellH: 0,
    fontSizePx: 0,
    scale: 1,
    lineHeight: 0,
    baselineOffset: 0,
    yPad: 0,
  };
}

export function updateGridState(
  state: GridState,
  metrics: CellMetrics,
  canvasWidth: number,
  canvasHeight: number,
): { changed: boolean; cols: number; rows: number } {
  const cols = Math.max(1, Math.floor(canvasWidth / metrics.cellW));
  const rows = Math.max(1, Math.floor(canvasHeight / metrics.cellH));

  if (!Number.isFinite(cols) || !Number.isFinite(rows)) {
    return { changed: false, cols: state.cols, rows: state.rows };
  }

  const changed =
    cols !== state.cols ||
    rows !== state.rows ||
    metrics.fontSizePx !== state.fontSizePx ||
    metrics.cellW !== state.cellW ||
    metrics.cellH !== state.cellH;

  Object.assign(state, metrics, { cols, rows });

  return { changed, cols, rows };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
