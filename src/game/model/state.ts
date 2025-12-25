import type { GameState, GridSize, TowerType, Cell, Tower } from "./types";
import { cellKey } from "./grid";
import { getLevelDef } from "./levels";
import { makeId } from "./id.ts";

export const DEFAULT_GRID: GridSize = { cols: 12, rows: 18 };

export const TOWER_COST: Record<TowerType, number> = {
    CANNON: 50,
    FROST: 65,
    SNIPER: 90,
};

export function createInitialState(): GameState {
    const grid = DEFAULT_GRID;

    const levelId = 1;
    const level = getLevelDef(levelId);

    return {
        levelId,
        levelName: level.name,
        palette: level.palette,

        grid,
        path: level.buildPath(grid),
        towers: [],
        stats: { baseHp: 20, money: 120, wave: 1 },
        mode: "IDLE",
        placement: { selectedTower: null },
    };
}

export function isPathCell(state: GameState, cell: Cell): boolean {
    const set = new Set(state.path.map(cellKey));
    return set.has(cellKey(cell));
}

export function towerAt(state: GameState, cell: Cell): Tower | undefined {
    const k = cellKey(cell);
    return state.towers.find(t => cellKey(t.cell) === k);
}

export function canPlaceTower(state: GameState, cell: Cell): { ok: boolean; reason?: string } {
    if (isPathCell(state, cell)) return { ok: false, reason: "Нельзя строить на пути" };
    if (towerAt(state, cell)) return { ok: false, reason: "Клетка занята" };

    const type = state.placement.selectedTower;
    if (!type) return { ok: false, reason: "Башня не выбрана" };
    const cost = TOWER_COST[type];
    if (state.stats.money < cost) return { ok: false, reason: "Не хватает денег" };

    return { ok: true };
}

export function placeTower(state: GameState, cell: Cell): GameState {
    const type = state.placement.selectedTower;
    if (!type) return state;

    const check = canPlaceTower(state, cell);
    if (!check.ok) return state;

    const cost = TOWER_COST[type];
    const tower: Tower = {
        id: makeId("tower"),
        type,
        level: 1,
        cell,
    };

    return {
        ...state,
        towers: [...state.towers, tower],
        stats: { ...state.stats, money: state.stats.money - cost },
    };
}

export function setSelectedTower(state: GameState, type: TowerType | null): GameState {
    return { ...state, placement: { selectedTower: type } };
}

/**
 * Заготовка под будущее: переход на следующий уровень
 * (пока не используем, но всё готово)
 */
export function loadLevel(state: GameState, levelId: number): GameState {
    const level = getLevelDef(levelId);
    return {
        ...state,
        levelId,
        levelName: level.name,
        palette: level.palette,
        path: level.buildPath(state.grid),
        towers: [],
        stats: { ...state.stats, wave: 1 },
        placement: { selectedTower: null },
    };
}
