import type { Enemy, EnemyType } from "./types";
import { makeId } from "./id";

type EnemyDef = {
    hp: number;
    speed: number;
    reward: number;
    shield?: number;
    leakDamage: number;
};

const DEF: Record<EnemyType, EnemyDef> = {
    RUNNER: { hp: 34, speed: 1.3, reward: 5, leakDamage: 1 },
    TANK: { hp: 140, speed: 0.7, reward: 12, leakDamage: 2 },
    SHIELDED: { hp: 78, speed: 0.95, reward: 9, shield: 50, leakDamage: 1 },
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
        leakDamage: d.leakDamage,
        progress: 0,
        slowMul: 1,
        slowTimerSec: 0,
        isBoss: false,
    };
}

export function createBossTank(hpMult: number, speedMult: number, rewardMult: number): Enemy {
    const base = DEF.TANK;
    const hp = Math.round(base.hp * hpMult);
    const speed = base.speed * speedMult;
    const reward = Math.round(base.reward * rewardMult);

    return {
        id: makeId("enemy"),
        type: "TANK",
        hp,
        maxHp: hp,
        shield: 0,
        maxShield: 0,
        speedCellsPerSec: speed,
        reward,
        leakDamage: 5,
        progress: 0,
        slowMul: 1,
        slowTimerSec: 0,
        isBoss: true,
    };
}