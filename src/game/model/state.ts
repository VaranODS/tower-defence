import type {
    GameState,
    GridSize,
    TowerType,
    Cell,
    Tower,
    Enemy,
    Bullet,
    WaveStatus,
} from "./types";
import {cellKey, inBounds} from "./grid";
import {getFirstLevelId, getLevelDef, hasLevel} from "./levels";
import {makeId} from "./id";
import {createEnemy, createBossTank} from "./enemies";
import {getWaveQueue} from "./waves";
import {posOnPath, cellCenter} from "./coords";
import {getTowerParams} from "./towerParams";

import type {SpawnUnit} from "./waves";
import {loadProgress, resetProgress} from "./persist";
import {validatePath} from "./pathValidate.ts";

export const DEFAULT_GRID: GridSize = {cols: 12, rows: 18};

export const TOWER_COST: Record<TowerType, number> = {
    CANNON: 50,
    FROST: 65,
    SNIPER: 90,
};

export const START_MONEY = 120;
export const START_BASE_HP = 20;

const SELL_REFUND_MULT = 0.7;  // возврат = 70% от вложенного

export function createInitialState(): GameState {
    const grid = DEFAULT_GRID;

    const p = loadProgress();
    const levelId = p?.levelId ?? 1;
    const level = getLevelDef(levelId);
    validatePath(grid, level.path);
    const pathSet = new Set(level.path.map(cellKey));

    return {
        levelId,
        levelName: level.name,
        palette: level.palette,

        grid,
        path: level.path,
        pathSet,
        towers: [],
        enemies: [],
        bullets: [],

        waveState: {
            status: "READY",
            queue: [],
            spawnTimerSec: 0,
            spawnIntervalSec: 0.6,
            intermissionSec: 0,
        },

        stats: {baseHp: START_BASE_HP, money: START_MONEY, waveInLevel: 1},
        mode: "IDLE",
        placement: {selectedTower: null},
        endScreen: null,
        selectedTowerId: null,
    };
}

export function isPathCell(state: GameState, cell: Cell): boolean {
    return state.pathSet.has(cellKey(cell));
}

export function towerAt(state: GameState, cell: Cell): Tower | undefined {
    const k = cellKey(cell);
    return state.towers.find(t => cellKey(t.cell) === k);
}

export function canPlaceTower(state: GameState, cell: Cell): { ok: boolean; reason?: string } {
    if (!inBounds(state.grid, cell)) return {ok: false, reason: "Вне поля"};
    if (isPathCell(state, cell)) return {ok: false, reason: "Нельзя строить на пути"};
    if (towerAt(state, cell)) return {ok: false, reason: "Клетка занята"};

    const type = state.placement.selectedTower;
    if (!type) return {ok: false, reason: "Выбери башню"};
    const cost = TOWER_COST[type];
    if (state.stats.money < cost) return {ok: false, reason: "Не хватает денег"};

    return {ok: true};
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
        cooldownSec: 0,
        invested: cost,
    };

    return {
        ...state,
        towers: [...state.towers, tower],
        stats: {...state.stats, money: state.stats.money - cost},
        placement: { selectedTower: null },
    };
}

export function setSelectedTower(state: GameState, type: TowerType | null): GameState {
    return {...state, placement: {selectedTower: type}};
}

export function togglePause(state: GameState): GameState {
    if (state.mode === "GAME_OVER") return state;
    if (state.mode === "RUNNING") return {...state, mode: "PAUSED"};
    if (state.mode === "PAUSED" || state.mode === "IDLE") return {...state, mode: "RUNNING"};
    return state;
}

export function startWave(state: GameState): GameState {
    if (state.mode === "GAME_OVER") return state;
    if (state.waveState.status !== "READY") return state;

    const queue = getWaveQueue(state.stats.waveInLevel);
    const interval = Math.max(0.35, 0.65 - state.stats.waveInLevel * 0.02);

    return {
        ...state,
        mode: "RUNNING",
        waveState: {
            ...state.waveState,
            status: "SPAWNING",
            queue,
            spawnTimerSec: 0,
            spawnIntervalSec: interval,
        },
    };
}

/** Основной шаг симуляции */
export function step(state: GameState, dtSec: number): GameState {
    if (state.mode !== "RUNNING") return state;

    // 1) волна: спавн
    let next = spawnStep(state, dtSec);

    // 2) движение врагов
    next = moveEnemies(next, dtSec);

    // 3) стрельба башен + движение пуль + попадания
    next = towersAndBullets(next, dtSec);

    // 4) окончание волны
    next = waveCompletion(next);

    // 5) автостарт следующей волны
    next = autoStartWaveIfNeeded(next, dtSec);

    // 6) game over
    if (next.stats.baseHp <= 0) {
        return resetGame(next, "GAME_OVER");
    }

    return next;
}

function spawnStep(state: GameState, dtSec: number): GameState {
    if (state.waveState.status !== "SPAWNING") return state;

    let timer = state.waveState.spawnTimerSec - dtSec;
    const queue = state.waveState.queue.slice();
    const enemies = state.enemies.slice();

    while (timer <= 0 && queue.length > 0) {
        const unit = queue.shift() as SpawnUnit;

        if (unit.type === "TANK_BOSS") {
            enemies.push(createBossTank(unit.hpMult, unit.speedMult, unit.rewardMult));
        } else {
            enemies.push(createEnemy(unit.type));
        }

        timer += state.waveState.spawnIntervalSec;
    }

    const status: WaveStatus =
        queue.length === 0 ? "IN_PROGRESS" : "SPAWNING";

    return {
        ...state,
        enemies,
        waveState: {...state.waveState, status, queue, spawnTimerSec: timer},
    };
}

function moveEnemies(state: GameState, dtSec: number): GameState {
    const maxProgress = Math.max(0, state.path.length - 1);

    let baseHp = state.stats.baseHp;
    const enemies: typeof state.enemies = [];

    for (const e of state.enemies) {
        const slowTimer = Math.max(0, e.slowTimerSec - dtSec);
        const slowMul = slowTimer > 0 ? e.slowMul : 1;

        const newProg = e.progress + (e.speedCellsPerSec * slowMul) * dtSec;

        if (newProg >= maxProgress) {
            // дошёл до конца
            baseHp -= 1;
            continue;
        }

        enemies.push({...e, progress: newProg, slowTimerSec: slowTimer, slowMul});
    }

    return {...state, enemies, stats: {...state.stats, baseHp}};
}

function towersAndBullets(state: GameState, dtSec: number): GameState {
    // a) обновляем cooldown + стреляем (пока только CANNON)
    const towers = state.towers.map(t => ({...t, cooldownSec: Math.max(0, t.cooldownSec - dtSec)}));
    const bullets = state.bullets.slice();

    for (let i = 0; i < towers.length; i++) {
        const t = towers[i];
        const params = getTowerParams(t.type, t.level);
        if (t.cooldownSec > 0) continue;

        const towerPos = cellCenter(t.cell);

        const target = pickTargetInRangeByPriority(state, t.type, towerPos.x, towerPos.y, params.rangeCells);
        if (!target) continue;

        const enemyPos = posOnPath(state.path, target.progress);
        const dir = norm(enemyPos.x - towerPos.x, enemyPos.y - towerPos.y);
        if (!dir) continue;

        // крит для снайпера (и вообще для любой башни, если появится)
        let dmg = params.damage;
        if (params.critChance && params.critMult) {
            if (Math.random() < params.critChance) {
                dmg = Math.round(dmg * params.critMult);
            }
        }

        const maxTravel = params.rangeCells + 0.35;

        const b: Bullet = {
            id: makeId("bullet"),
            x: towerPos.x,
            y: towerPos.y,
            vx: dir.x,
            vy: dir.y,
            speedCellsPerSec: params.bulletSpeedCellsPerSec,
            damage: dmg,
            targetEnemyId: target.id,
            traveledCells: 0,
            maxTravelCells: maxTravel,
            slowMul: params.slowMul,
            slowDurationSec: params.slowDurationSec,
        };

        bullets.push(b);
        towers[i] = {...t, cooldownSec: params.fireCooldownSec};
    }

    // b) двигаем пули и проверяем попадания
    const moved: Bullet[] = [];
    const enemies = state.enemies.slice();
    let money = state.stats.money;

    const hitRadius = 0.22; // в "клетках"
    const hitRadius2 = hitRadius * hitRadius;

    for (const b of bullets) {
        const idx = enemies.findIndex(e => e.id === b.targetEnemyId);
        if (idx === -1) {
            // цель уже умерла
            continue;
        }

        const e = enemies[idx];
        const ep = posOnPath(state.path, e.progress);

        // homing: каждый тик летим в текущую позицию цели
        const d = norm(ep.x - b.x, ep.y - b.y);
        if (!d) continue;

        const stepDist = b.speedCellsPerSec * dtSec;

        const nx = b.x + d.x * stepDist;
        const ny = b.y + d.y * stepDist;


        // segment hit test: проверяем минимальную дистанцию от цели до отрезка (b->n)
        const dist2 = pointToSegmentDist2(ep.x, ep.y, b.x, b.y, nx, ny);
        if (dist2 <= hitRadius2) {
            const hit = applyDamage(e, b.damage);
            if (hit.dead) {
                money += e.reward;
                enemies.splice(idx, 1);
            } else {
                let updated = hit.enemy;

                // применяем замедление (если у пули оно есть)
                if (b.slowMul !== undefined && b.slowDurationSec !== undefined) {
                    const stronger = Math.min(updated.slowMul, b.slowMul); // меньше = сильнее замедление
                    const newMul = Math.min(stronger, b.slowMul);

                    const newTimer = Math.max(updated.slowTimerSec, b.slowDurationSec);

                    updated = {
                        ...updated,
                        slowMul: newMul,
                        slowTimerSec: newTimer,
                    };
                }

                enemies[idx] = updated;
            }
            continue;
        }

        const traveled = b.traveledCells + stepDist;
        if (traveled >= b.maxTravelCells) {
            // пролетела дальше радиуса башни — удаляем
            continue;
        }

        moved.push({
            ...b,
            x: nx,
            y: ny,
            vx: d.x,
            vy: d.y,
            traveledCells: traveled,
        });
    }

    return {
        ...state,
        towers,
        bullets: moved,
        enemies,
        stats: {...state.stats, money},
    };
}

function pointToSegmentDist2(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const abx = bx - ax;
    const aby = by - ay;

    const apx = px - ax;
    const apy = py - ay;

    const abLen2 = abx * abx + aby * aby;
    if (abLen2 <= 1e-9) {
        return apx * apx + apy * apy;
    }

    let t = (apx * abx + apy * aby) / abLen2;
    t = Math.max(0, Math.min(1, t));

    const cx = ax + abx * t;
    const cy = ay + aby * t;

    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy;
}

function waveCompletion(state: GameState): GameState {
    if (state.waveState.status === "READY") return state;

    const spawningDone = state.waveState.status !== "SPAWNING" && state.waveState.queue.length === 0;
    const noEnemies = state.enemies.length === 0;

    if (!(spawningDone && noEnemies)) return state;

    const level = getLevelDef(state.levelId);
    const nextWave = state.stats.waveInLevel + 1;

    // волна закончилась
    if (nextWave > level.wavesPerLevel) {
        // уровень пройден
        return {
            ...state,
            waveState: { ...state.waveState, status: "READY", queue: [], spawnTimerSec: 0 },
            mode: "LEVEL_COMPLETE",
        };
    }

    // следующий раунд
    return {
        ...state,
        waveState: { ...state.waveState, status: "READY", queue: [], spawnTimerSec: 0, intermissionSec: 4 },
        stats: { ...state.stats, waveInLevel: nextWave },
        mode: "RUNNING",
    };
}


function norm(x: number, y: number): { x: number; y: number } | null {
    const len = Math.hypot(x, y);
    if (len <= 1e-6) return null;
    return {x: x / len, y: y / len};
}

function applyDamage(e: Enemy, dmg: number): { enemy: Enemy; dead: boolean } {
    let shield = e.shield;
    let hp = e.hp;

    let left = dmg;

    if (shield > 0) {
        const s = Math.min(shield, left);
        shield -= s;
        left -= s;
    }

    if (left > 0) {
        hp = Math.max(0, hp - left);
    }

    const enemy = {...e, shield, hp};
    return {enemy, dead: enemy.hp <= 0};
}

function pickTargetInRangeByPriority(
    state: GameState,
    towerType: TowerType,
    tx: number,
    ty: number,
    range: number
) {
    const range2 = range * range;

    let best: { e: import("./types").Enemy; scoreA: number; scoreB: number } | null = null;

    for (const e of state.enemies) {
        const p = posOnPath(state.path, e.progress);
        const dx = p.x - tx;
        const dy = p.y - ty;
        if (dx * dx + dy * dy > range2) continue;

        // scoreA — главный критерий, scoreB — тай-брейк
        let scoreA = 0;
        let scoreB = 0;

        if (towerType === "FROST") {
            // самый быстрый (фактическая скорость)
            const mul = e.slowTimerSec > 0 ? e.slowMul : 1;
            scoreA = e.speedCellsPerSec * mul;
            scoreB = e.progress;
        } else {
            // CANNON / SNIPER: ближе к выходу (макс progress)
            scoreA = e.progress;
            scoreB = e.maxHp - e.hp; // тай-брейк: уже подбитый
        }

        if (!best || scoreA > best.scoreA || (scoreA === best.scoreA && scoreB > best.scoreB)) {
            best = {e, scoreA, scoreB};
        }
    }

    return best?.e ?? null;
}

export function setSelectedTowerId(state: GameState, id: string | null): GameState {
    return {...state, selectedTowerId: id};
}

export function clearPlacement(state: GameState): GameState {
    return {...state, placement: {selectedTower: null}};
}

export function getUpgradeCost(type: TowerType, nextLevel: 2 | 3): number {
    const base =TOWER_COST[type];
    const raw = nextLevel === 2 ? base * 1.2 : base * 1.6;
    return Math.ceil(raw);
}

export function canUpgradeSelectedTower(state: GameState): { ok: boolean; reason?: string; cost?: number } {
    const id = state.selectedTowerId;
    if (!id) return {ok: false, reason: "Башня не выбрана"};

    const t = state.towers.find(x => x.id === id);
    if (!t) return {ok: false, reason: "Башня не найдена"};
    if (t.level >= 3) return {ok: false, reason: "Макс. уровень"};

    const nextLevel = (t.level + 1) as 2 | 3;
    const cost = getUpgradeCost(t.type, nextLevel);

    if (state.stats.money < cost) return {ok: false, reason: "Не хватает денег", cost};

    return {ok: true, cost};
}

export function upgradeSelectedTower(state: GameState): GameState {
    const id = state.selectedTowerId;
    if (!id) return state;

    const idx = state.towers.findIndex(x => x.id === id);
    if (idx === -1) return state;

    const t = state.towers[idx];
    if (t.level >= 3) return state;

    const nextLevel = (t.level + 1) as 2 | 3;
    const cost = getUpgradeCost(t.type, nextLevel);

    if (state.stats.money < cost) return state;

    const updated: Tower = {
        ...t,
        level: nextLevel,
        invested: t.invested + cost,
    };

    const towers = state.towers.slice();
    towers[idx] = updated;

    return {
        ...state,
        towers,
        stats: {...state.stats, money: state.stats.money - cost},
    };
}

export function sellSelectedTower(state: GameState): GameState {
    const id = state.selectedTowerId;
    if (!id) return state;

    const t = state.towers.find(x => x.id === id);
    if (!t) return {...state, selectedTowerId: null};

    const refund = Math.floor(t.invested * SELL_REFUND_MULT);

    return {
        ...state,
        towers: state.towers.filter(x => x.id !== id),
        stats: {...state.stats, money: state.stats.money + refund},
        selectedTowerId: null,
    };
}

export function loadLevel(state: GameState, levelId: number): GameState {
    const level = getLevelDef(levelId);
    validatePath(state.grid, level.path);
    const pathSet = new Set(level.path.map(cellKey));

    return {
        ...state,
        levelId,
        levelName: level.name,
        palette: level.palette,
        path: level.path,
        pathSet,
        towers: [],
        enemies: [],
        bullets: [],
        selectedTowerId: null,

        waveState: { ...state.waveState, status: "READY", queue: [], spawnTimerSec: 0 },

        stats: { ...state.stats, waveInLevel: 1 },
        mode: "PAUSED",
        placement: { selectedTower: null },
    };
}

export function nextLevel(state: GameState): GameState {
    const nextId = state.levelId + 1;
    if (!hasLevel(nextId)) {
        return resetGame(state, "ALL_LEVELS_COMPLETE");
    }
    return loadLevel(state, nextId);
}

function autoStartWaveIfNeeded(state: GameState, dtSec: number): GameState {
    if (state.mode !== "RUNNING") return state;
    if (state.waveState.status !== "READY") return state;
    if (state.waveState.intermissionSec <= 0) return state;

    const left = Math.max(0, state.waveState.intermissionSec - dtSec);

    // ещё ждём
    if (left > 0) {
        return { ...state, waveState: { ...state.waveState, intermissionSec: left } };
    }

    // стартуем новую волну
    const queue = getWaveQueue(state.stats.waveInLevel);
    const interval = Math.max(0.35, 0.65 - state.stats.waveInLevel * 0.02);

    return {
        ...state,
        waveState: {
            ...state.waveState,
            status: "SPAWNING",
            queue,
            spawnTimerSec: 0,
            spawnIntervalSec: interval,
            intermissionSec: 0,
        },
    };
}

export function resetGame(
    state: GameState,
    endScreen: "GAME_OVER" | "ALL_LEVELS_COMPLETE" | null
): GameState {
    // сбрасываем localStorage
    resetProgress();

    // загружаем первый уровень
    const base = loadLevel(state, getFirstLevelId());

    return {
        ...base,
        stats: {
            ...base.stats,
            money: START_MONEY,
            baseHp: START_BASE_HP,
            waveInLevel: 1,
        },
        endScreen: endScreen ? { kind: endScreen } : null,
        mode: "IDLE",
    };
}

export function getSellRefund(t: Tower): number {
    return Math.floor(t.invested * SELL_REFUND_MULT);
}

export function goToLevel(state: GameState, levelId: number): GameState {
    const def = getLevelDef(levelId);

    const base = loadLevel(state, def.id);

    return {
        ...base,
        mode: "IDLE",
        endScreen: null,
        selectedTowerId: null,
        placement: { selectedTower: null },

        // важно: тест уровня начинаем "как новую игру"
        stats: {
            ...base.stats,
            money: START_MONEY,
            baseHp: START_BASE_HP,
            waveInLevel: 1,
        },
    };
}