export type GridSize = { cols: number; rows: number };

export type Cell = { col: number; row: number };

export type TowerType = "CANNON" | "FROST" | "SNIPER";

export type Tower = {
    id: string;
    type: TowerType;
    level: 1 | 2 | 3;
    cell: Cell;
};

export type GameStats = {
    baseHp: number;
    money: number;
    wave: number;
};

export type GameMode = "IDLE" | "RUNNING" | "PAUSED";

export type Placement = {
    selectedTower: TowerType | null;
};

export type Palette = {
    bg: string;
    grid: string;
    pathFill: string;
    pathStroke: string;
    towerFill: string;
};

export type GameState = {
    levelId: number;
    levelName: string;
    palette: Palette;

    grid: GridSize;
    path: Cell[]; // ordered path cells
    towers: Tower[];

    stats: GameStats;
    mode: GameMode;
    placement: Placement;
};
