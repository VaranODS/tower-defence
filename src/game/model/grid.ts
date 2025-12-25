import type { Cell, GridSize } from "./types";

export const cellKey = (c: Cell) => `${c.col},${c.row}`;

export const inBounds = (grid: GridSize, c: Cell) =>
    c.col >= 0 && c.col < grid.cols && c.row >= 0 && c.row < grid.rows;
