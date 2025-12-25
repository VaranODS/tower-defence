import type { Cell, GridSize } from "./types";
import { buildSnakePath } from "./path";

export type Palette = {
    bg: string;
    grid: string;
    pathFill: string;
    pathStroke: string;
    towerFill: string;
};

export type LevelDef = {
    id: number;
    name: string;
    palette: Palette;
    buildPath: (grid: GridSize) => Cell[];
};

// Несколько примеров уровней (можно расширять)
const LEVELS: Record<number, LevelDef> = {
    1: {
        id: 1,
        name: "Тренировочный полигон",
        palette: {
            bg: "#0b1020",
            grid: "rgba(255,255,255,0.10)",
            pathFill: "rgba(255, 210, 100, 0.22)",
            pathStroke: "rgba(255, 210, 100, 0.40)",
            towerFill: "rgba(120, 220, 255, 0.18)",
        },
        // змейка в центре (есть зоны для башен сверху/снизу)
        buildPath: (grid) => buildSnakePath(grid, 1),
    },

    2: {
        id: 2,
        name: "Песчаные барханы",
        palette: {
            bg: "#1b140c",
            grid: "rgba(255,240,200,0.10)",
            pathFill: "rgba(255, 170, 70, 0.20)",
            pathStroke: "rgba(255, 170, 70, 0.42)",
            towerFill: "rgba(170, 255, 200, 0.16)",
        },
        // змейка ближе к верхней части
        buildPath: (grid) => buildSnakePath(grid, 2),
    },

    3: {
        id: 3,
        name: "Неоновый квартал",
        palette: {
            bg: "#070812",
            grid: "rgba(190,170,255,0.10)",
            pathFill: "rgba(180, 120, 255, 0.18)",
            pathStroke: "rgba(180, 120, 255, 0.45)",
            towerFill: "rgba(120, 255, 220, 0.16)",
        },
        // змейка ближе к низу
        buildPath: (grid) => buildSnakePath(grid, 3),
    },
};

export function getLevelDef(levelId: number): LevelDef {
    return LEVELS[levelId] ?? LEVELS[1];
}
