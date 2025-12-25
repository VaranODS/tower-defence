const KEY = "td_progress_v1";

export type Progress = {
    levelId: number;
};

export function loadProgress(): Progress | null {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const data = JSON.parse(raw) as unknown;
        if (isProgress(data)) return data;
        return null;
    } catch {
        return null;
    }
}

export function saveProgress(p: Progress) {
    try {
        localStorage.setItem(KEY, JSON.stringify(p));
    } catch {
        // игнорируем, если storage недоступен
    }
}

function isProgress(x: unknown): x is Progress {
    if (typeof x !== "object" || x === null) return false;
    const v = x as Record<string, unknown>;
    return typeof v.levelId === "number";
}
