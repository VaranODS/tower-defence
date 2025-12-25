import type { EnemyType } from "./types";

// Пока 3 волны для MVP (можно расширять)
const makeWave = (length: number, type: EnemyType): EnemyType[] =>
    Array.from({ length }, () => type);

export const WAVES: EnemyType[][] = [
    makeWave(10, "RUNNER"),
    makeWave(12, "RUNNER"),
    [...makeWave(8, "RUNNER"), "TANK", "TANK"],
];

export function getWaveQueue(waveNumber: number): EnemyType[] {
    const idx = Math.max(1, waveNumber) - 1;
    return (WAVES[idx] ?? WAVES[WAVES.length - 1]).slice();
}

