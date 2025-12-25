import type { TowerType } from "../model/types";

export type TowerView = {
    glyph: string;
    name: string;
};

export const TOWER_VIEW: Record<TowerType, TowerView> = {
    CANNON: {
        glyph: "💥",
        name: "Пушка",
    },
    FROST: {
        glyph: "❄️",
        name: "Лёд",
    },
    SNIPER: {
        glyph: "🎯",
        name: "Снайпер",
    },
};
