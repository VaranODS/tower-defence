import type { Cell, GridSize } from "./types";

export function validatePath(grid: GridSize, path: Cell[]): void {
    if (path.length < 2) throw new Error("Level path must have at least 2 cells");

    const seen = new Set<string>();

    const total = grid.cols * grid.rows;
    const free = total - path.length;

    if (free / total < 0.55) {
        console.warn("Level path occupies too much space:", {
            free,
            total,
            ratio: free / total,
        });
    }

    for (let i = 0; i < path.length; i++) {
        const c = path[i];

        if (c.col < 0 || c.row < 0 || c.col >= grid.cols || c.row >= grid.rows) {
            throw new Error(`Path cell out of bounds at index ${i}: (${c.col},${c.row})`);
        }

        const k = `${c.col},${c.row}`;
        if (seen.has(k)) {
            throw new Error(`Duplicate cell in path at index ${i}: (${c.col},${c.row})`);
        }
        seen.add(k);

        if (i > 0) {
            const p = path[i - 1];
            const manhattan = Math.abs(c.col - p.col) + Math.abs(c.row - p.row);
            if (manhattan !== 1) {
                throw new Error(
                    `Non-adjacent path step at index ${i - 1}->${i}: (${p.col},${p.row}) -> (${c.col},${c.row})`
                );
            }
        }
    }
}
