import type { ImeState, CursorPosition } from "./types";

export function createImeState(): ImeState {
  return {
    composing: false,
    preedit: "",
    selectionStart: 0,
    selectionEnd: 0,
  };
}

export function setPreedit(
  state: ImeState,
  text: string,
  imeInput?: HTMLInputElement | null,
): void {
  state.preedit = text || "";
  if (imeInput) {
    imeInput.value = state.preedit;
  }
}

export function clearPreedit(
  state: ImeState,
  imeInput?: HTMLInputElement | null,
): void {
  state.preedit = "";
  state.selectionStart = 0;
  state.selectionEnd = 0;
  if (imeInput) {
    imeInput.value = "";
  }
}

export function startComposition(
  state: ImeState,
  data: string,
  imeInput?: HTMLInputElement | null,
): void {
  state.composing = true;
  setPreedit(state, data || imeInput?.value || "");
}

export function updateComposition(
  state: ImeState,
  data: string,
  imeInput?: HTMLInputElement | null,
): void {
  setPreedit(state, data || imeInput?.value || "");
}

export function endComposition(state: ImeState): string {
  state.composing = false;
  const text = state.preedit;
  state.preedit = "";
  state.selectionStart = 0;
  state.selectionEnd = 0;
  return text;
}

export function syncImeSelection(state: ImeState, imeInput: HTMLInputElement | null): void {
  if (!imeInput) return;
  const start = imeInput.selectionStart ?? 0;
  const end = imeInput.selectionEnd ?? start;
  state.selectionStart = Math.max(0, Math.min(start, imeInput.value.length));
  state.selectionEnd = Math.max(state.selectionStart, Math.min(end, imeInput.value.length));
}

export function updateImePosition(
  imeInput: HTMLInputElement | null,
  cursor: CursorPosition | null,
  cellW: number,
  cellH: number,
  dpr: number,
  canvasRect: DOMRect,
): void {
  if (!imeInput || !cursor) return;
  const scale = dpr || 1;
  const x = canvasRect.left + cursor.col * (cellW / scale);
  const y = canvasRect.top + cursor.row * (cellH / scale);
  imeInput.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

// IME colors (can be customized)
export const PREEDIT_BG = [0.16, 0.16, 0.2, 0.9] as const;
export const PREEDIT_ACTIVE_BG = [0.3, 0.32, 0.42, 0.95] as const;
export const PREEDIT_FG = [0.95, 0.95, 0.98, 1.0] as const;
export const PREEDIT_UL = [0.7, 0.7, 0.8, 0.9] as const;
export const PREEDIT_CARET = [0.95, 0.95, 0.98, 1.0] as const;
