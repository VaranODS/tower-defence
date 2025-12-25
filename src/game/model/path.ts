import type { Cell, GridSize } from "./types";

/**
 * buildSnakePath(grid, level)
 * level влияет на то, какие строки занимает змейка (чтобы оставлять место под башни),
 * а дальше можно будет расширять: разные формы путей на уровне.
 */
export function buildSnakePath(grid: GridSize, level: number): Cell[] {
    // Базово: путь занимает 4 строки, но их положение зависит от уровня
    // (позже можно заменить на любые схемы)
    let startRow = 2;
    let endRow = 5;

    if (level === 2) {
        startRow = 1; endRow = 4; // выше
    } else if (level === 3) {
        startRow = 3; endRow = 6; // ниже
    }

    const sr = clamp(startRow, 0, grid.rows - 1);
    const er = clamp(endRow, 0, grid.rows - 1);

    const path: Cell[] = [];
    for (let row = sr; row <= er; row++) {
        const leftToRight = (row - sr) % 2 === 0;
        if (leftToRight) {
            for (let col = 0; col < grid.cols; col++) path.push({ col, row });
        } else {
            for (let col = grid.cols - 1; col >= 0; col--) path.push({ col, row });
        }
    }

    return path;
}

function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
}
