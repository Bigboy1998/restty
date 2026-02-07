export type ImeState = {
  composing: boolean;
  preedit: string;
  selectionStart: number;
  selectionEnd: number;
};

export type CursorPosition = {
  row: number;
  col: number;
};
