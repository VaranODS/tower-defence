import type { EnemyType } from "./types";

export type SpawnUnit =
    | { type: EnemyType }
    | { type: "TANK_BOSS"; hpMult: number; speedMult: number; rewardMult: number };

export function getWaveQueue(waveNumber: number): SpawnUnit[] {
    const w = Math.max(1, waveNumber);

    // базовое количество врагов растёт
    const baseCount = 8 + Math.floor(w * 1.6);

    // доли типов (плавно)
    const tankRate = clamp((w - 2) * 0.05, 0, 0.35);     // до 35%
    const shieldRate = clamp((w - 3) * 0.05, 0, 0.35);   // до 35%

    const tanks = Math.floor(baseCount * tankRate);
    const shields = Math.floor(baseCount * shieldRate);
    const runners = Math.max(0, baseCount - tanks - shields);

    const queue: SpawnUnit[] = [];
    for (let i = 0; i < runners; i++) queue.push({ type: "RUNNER" });
    for (let i = 0; i < shields; i++) queue.push({ type: "SHIELDED" });
    for (let i = 0; i < tanks; i++) queue.push({ type: "TANK" });

    // перемешаем, чтобы не шли блоками
    shuffle(queue);

    // каждая 5-я волна — босс
    if (w % 5 === 0) {
        queue.push({ type: "TANK_BOSS", hpMult: 4, speedMult: 0.85, rewardMult: 4 });
    }

    return queue;
}

function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
}

function shuffle<T>(arr: T[]) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}
