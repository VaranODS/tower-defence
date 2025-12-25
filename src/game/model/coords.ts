import type { Cell } from "./types";

export function cellCenter(c: Cell): { x: number; y: number } {
    return { x: c.col + 0.5, y: c.row + 0.5 };
}

// Интерполяция позиции по progress
export function posOnPath(path: Cell[], progress: number): { x: number; y: number } {
    if (path.length === 0) return { x: 0, y: 0 };

    const max = path.length - 1;
    const p = clamp(progress, 0, max);

    const i = Math.floor(p);
    const t = p - i;

    const a = cellCenter(path[i]);
    const b = cellCenter(path[Math.min(i + 1, max)]);

    return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
    };
}

function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
}
