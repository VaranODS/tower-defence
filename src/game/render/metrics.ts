import type { Cell, GridSize } from "../model/types";

export type Metrics = {
    dpr: number;
    canvasW: number;
    canvasH: number;

    // область поля внутри canvas
    boardX: number;
    boardY: number;
    boardW: number;
    boardH: number;

    cellSize: number;
};

export function computeMetrics(
    grid: GridSize,
    cssW: number,
    cssH: number,
    dpr: number
): Metrics {
    const canvasW = Math.floor(cssW * dpr);
    const canvasH = Math.floor(cssH * dpr);

    // немного отступов
    const pad = 12 * dpr;
    const boardW = canvasW - pad * 2;
    const boardH = canvasH - pad * 2;

    const cellSize = Math.floor(Math.min(boardW / grid.cols, boardH / grid.rows));

    const usedW = cellSize * grid.cols;
    const usedH = cellSize * grid.rows;

    const boardX = Math.floor((canvasW - usedW) / 2);
    const boardY = Math.floor((canvasH - usedH) / 2);

    return {
        dpr,
        canvasW,
        canvasH,
        boardX,
        boardY,
        boardW: usedW,
        boardH: usedH,
        cellSize,
    };
}

export function cellToWorld(m: Metrics, cell: Cell) {
    const x = m.boardX + cell.col * m.cellSize;
    const y = m.boardY + cell.row * m.cellSize;
    return { x, y };
}

export function worldToCell(m: Metrics, x: number, y: number): Cell | null {
    const relX = x - m.boardX;
    const relY = y - m.boardY;
    if (relX < 0 || relY < 0) return null;

    const col = Math.floor(relX / m.cellSize);
    const row = Math.floor(relY / m.cellSize);

    if (col < 0 || row < 0) return null;
    return { col, row };
}
