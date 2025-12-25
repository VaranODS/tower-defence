import type { TowerType } from "./types";

export type TowerParams = {
    rangeCells: number;
    damage: number;
    fireCooldownSec: number;
    bulletSpeedCellsPerSec: number;

    slowMul?: number;
    slowDurationSec?: number;

    critChance?: number;
    critMult?: number;
};

export function getTowerParams(type: TowerType, level: 1 | 2 | 3): TowerParams {
    if (type === "CANNON") {
        const base = 12;
        const dmg = level === 1 ? base : level === 2 ? Math.round(base * 1.25) : Math.round(base * 1.25 * 1.25);
        const cd = level === 3 ? 0.6 * 0.85 : 0.6;
        const range = level >= 2 ? 2.6 * 1.1 : 2.6;
        return { rangeCells: range, damage: dmg, fireCooldownSec: cd, bulletSpeedCellsPerSec: 8.5 };
    }

    if (type === "FROST") {
        if (level === 1) {
            return { rangeCells: 2.2, damage: 6, fireCooldownSec: 0.8, bulletSpeedCellsPerSec: 8.0, slowMul: 0.65, slowDurationSec: 1.2 };
        }
        if (level === 2) {
            return { rangeCells: 2.2, damage: 6, fireCooldownSec: 0.8, bulletSpeedCellsPerSec: 8.0, slowMul: 0.55, slowDurationSec: 1.4 };
        }
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
