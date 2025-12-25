export type GridSize = { cols: number; rows: number };

export type Cell = { col: number; row: number };

export type TowerType = "CANNON" | "FROST" | "SNIPER";

export type Tower = {
    id: string;
    type: TowerType;
    level: 1 | 2 | 3;
    cell: Cell;

    // для стрельбы
    cooldownSec: number;
};

export type EnemyType = "RUNNER" | "TANK" | "SHIELDED";

export type Enemy = {
    id: string;
    type: EnemyType;

    hp: number;
    maxHp: number;

    shield: number;     // для SHIELDED
    maxShield: number;

    speedCellsPerSec: number;
    reward: number;

    // прогресс по пути: 0..(path.length-1)
    // i = floor(progress) — индекс клетки в path
    progress: number;

    slowMul: number;        // 1.0 = нет замедления, 0.65 = -35% скорости
    slowTimerSec: number;   // сколько ещё действует
};

export type Bullet = {
    id: string;

    // позиция в "клеточных координатах":
    // центр клетки (col+0.5, row+0.5)
    x: number;
    y: number;

    vx: number;
    vy: number;

    speedCellsPerSec: number;
    damage: number;

    targetEnemyId: string;

    traveledCells: number;     // сколько пролетела
    maxTravelCells: number;    // предел (дальность башни)

    slowMul?: number;         // если есть — применяем замедление
    slowDurationSec?: number; // длительность
};

export type GameStats = {
    baseHp: number;
    money: number;
    wave: number;
};

export type GameMode = "IDLE" | "RUNNING" | "PAUSED" | "GAME_OVER";

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

export type WaveStatus = "READY" | "SPAWNING" | "IN_PROGRESS";

export type WaveState = {
    status: WaveStatus;
    queue: EnemyType[];        // кого осталось заспавнить
    spawnTimerSec: number;     // таймер между спавнами
    spawnIntervalSec: number;  // например 0.6
};
export type GameState = {
    levelId: number;
    levelName: string;
    palette: Palette;

    grid: GridSize;
    path: Cell[]; // ordered path cells
    towers: Tower[];
    enemies: Enemy[];
    bullets: Bullet[];

    waveState: WaveState;

    stats: GameStats;
    mode: GameMode;
    placement: Placement;
};
