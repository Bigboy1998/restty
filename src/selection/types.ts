export type CellPosition = {
  row: number;
  col: number;
};

export type SelectionState = {
  active: boolean;
  dragging: boolean;
  anchor: CellPosition | null;
  focus: CellPosition | null;
};

export type SelectionRange = {
  start: number;
  end: number;
};
