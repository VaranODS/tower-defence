import type { Enemy, EnemyType } from "./types";
import { makeId } from "./id";

type EnemyDef = {
    hp: number;
    speed: number;
    reward: number;
    shield?: number;
};

const DEF: Record<EnemyType, EnemyDef> = {
    RUNNER: { hp: 30, speed: 1.25, reward: 6 },
    TANK: { hp: 120, speed: 0.65, reward: 14 },
    SHIELDED: { hp: 70, speed: 0.9, reward: 10, shield: 40 },
};

export function createEnemy(type: EnemyType): Enemy {
    const d = DEF[type];
    const shield = d.shield ?? 0;

    return {
        id: makeId("enemy"),
        type,
        hp: d.hp,
        maxHp: d.hp,
        shield,
        maxShield: shield,
        speedCellsPerSec: d.speed,
        reward: d.reward,
        progress: 0,
        slowMul: 1,
        slowTimerSec: 0,
    };
}
