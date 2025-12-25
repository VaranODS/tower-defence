import type {
    GameState,
    GridSize,
    TowerType,
    Cell,
    Tower,
    Enemy,
    EnemyType,
    Bullet,
    WaveStatus,
} from "./types";
import {cellKey, inBounds} from "./grid";
import {getLevelDef} from "./levels";
import {makeId} from "./id";
import {createEnemy} from "./enemies";
import {getWaveQueue} from "./waves";
import {posOnPath, cellCenter} from "./coords";

export const DEFAULT_GRID: GridSize = {cols: 12, rows: 18};

export const TOWER_COST: Record<TowerType, number> = {
    CANNON: 50,
    FROST: 65,
    SNIPER: 90,
};

// // Башня "Пушка" для MVP
// const CANNON = {
//     rangeCells: 2.6,
//     damage: 12,
//     fireCooldownSec: 0.6,
//     bulletSpeedCellsPerSec: 8.5,
// };

type TowerParams = {
    rangeCells: number;
    damage: number;
    fireCooldownSec: number;
    bulletSpeedCellsPerSec: number;

    slowMul?: number;
    slowDurationSec?: number;

    critChance?: number; // 0..1
    critMult?: number;   // например 2
};

function getTowerParams(type: TowerType, level: 1 | 2 | 3): TowerParams {
    if (type === "CANNON") {
        // как было
        const dmg = level === 1 ? 12 : level === 2 ? Math.round(12 * 1.25) : Math.round(12 * 1.25 * 1.25);
        const cd = level === 3 ? 0.6 * 0.85 : 0.6;
        const range = level >= 2 ? 2.6 * 1.1 : 2.6;
        return { rangeCells: range, damage: dmg, fireCooldownSec: cd, bulletSpeedCellsPerSec: 8.5 };
    }

    if (type === "FROST") {
        // базовые: 2.2 range, dmg 6, cd 0.8, slow -35% на 1.2с
        if (level === 1) {
            return { rangeCells: 2.2, damage: 6, fireCooldownSec: 0.8, bulletSpeedCellsPerSec: 8.0, slowMul: 0.65, slowDurationSec: 1.2 };
        }
        if (level === 2) {
            return { rangeCells: 2.2, damage: 6, fireCooldownSec: 0.8, bulletSpeedCellsPerSec: 8.0, slowMul: 0.55, slowDurationSec: 1.4 };
        }
        // level 3
        return { rangeCells: 2.2, damage: Math.round(6 * 1.2), fireCooldownSec: 0.8, bulletSpeedCellsPerSec: 8.0, slowMul: 0.45, slowDurationSec: 1.4 };
    }

    // SNIPER
    if (level === 1) {
        return { rangeCells: 4.2, damage: 35, fireCooldownSec: 1.4, bulletSpeedCellsPerSec: 12.0 };
    }
    if (level === 2) {
        return { rangeCells: 4.2, damage: Math.round(35 * 1.3), fireCooldownSec: 1.4, bulletSpeedCellsPerSec: 12.0 };
    }
    return { rangeCells: 4.2, damage: 35, fireCooldownSec: 1.4, bulletSpeedCellsPerSec: 12.0, critChance: 0.15, critMult: 2 };
}

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
        enemies: [],
        bullets: [],

        waveState: {
            status: "READY",
            queue: [],
            spawnTimerSec: 0,
            spawnIntervalSec: 0.6,
        },

        stats: {baseHp: 20, money: 120, wave: 1},
        mode: "IDLE",
        placement: {selectedTower: null},
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
    };

    return {
        ...state,
        towers: [...state.towers, tower],
        stats: {...state.stats, money: state.stats.money - cost},
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

    const queue = getWaveQueue(state.stats.wave);
    return {
        ...state,
        mode: "RUNNING",
        waveState: {
            ...state.waveState,
            status: "SPAWNING",
            queue,
            spawnTimerSec: 0,
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

    // 5) game over
    if (next.stats.baseHp <= 0) {
        return {...next, mode: "GAME_OVER"};
    }

    return next;
}

function spawnStep(state: GameState, dtSec: number): GameState {
    if (state.waveState.status !== "SPAWNING") return state;

    let timer = state.waveState.spawnTimerSec - dtSec;
    const queue = state.waveState.queue.slice();
    const enemies = state.enemies.slice();

    while (timer <= 0 && queue.length > 0) {
        const type = queue.shift() as EnemyType;
        enemies.push(createEnemy(type));
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

        enemies.push({...e, progress: newProg, slowTimerSec: slowTimer, slowMul });
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

    if (spawningDone && noEnemies) {
        return {
            ...state,
            waveState: {...state.waveState, status: "READY", queue: [], spawnTimerSec: 0},
            stats: {...state.stats, wave: state.stats.wave + 1},
            mode: "PAUSED",
        };
    }

    return state;
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
            best = { e, scoreA, scoreB };
        }
    }

    return best?.e ?? null;
}
