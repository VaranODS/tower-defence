import type { GameState, Cell, Tower } from "../model/types";
import { cellKey } from "../model/grid";
import { cellToWorld } from "./metrics";
import type { Metrics} from "./metrics"
import { canPlaceTower } from "../model/state";
import { TOWER_VIEW } from "../ui/towerView";
import { cellCenter, posOnPath } from "../model/coords";
import { getTowerParams} from "../model/towerParams";


export function draw(ctx: CanvasRenderingContext2D, state: GameState, m: Metrics, hoverCell: Cell | null) {
    ctx.clearRect(0, 0, m.canvasW, m.canvasH);

    const tSec = performance.now() / 1000;

    // фон из палитры уровня
    ctx.fillStyle = state.palette.bg;
    ctx.fillRect(0, 0, m.canvasW, m.canvasH);

    drawGrid(ctx, state, m);
    drawPath(ctx, state, m, tSec);
    drawEnemies(ctx, state, m);
    drawBullets(ctx, state, m);
    drawRange(ctx, state, m, hoverCell);
    drawTowers(ctx, state, m);

    if (hoverCell) drawHover(ctx, state, m, hoverCell);
}

function drawGrid(ctx: CanvasRenderingContext2D, state: GameState, m: Metrics) {
    ctx.save();
    ctx.strokeStyle = state.palette.grid;
    ctx.lineWidth = 1.05 * m.dpr;

    for (let r = 0; r <= state.grid.rows; r++) {
        const y = m.boardY + r * m.cellSize;
        ctx.beginPath();
        ctx.moveTo(m.boardX, y);
        ctx.lineTo(m.boardX + m.boardW, y);
        ctx.stroke();
    }

    for (let c = 0; c <= state.grid.cols; c++) {
        const x = m.boardX + c * m.cellSize;
        ctx.beginPath();
        ctx.moveTo(x, m.boardY);
        ctx.lineTo(x, m.boardY + m.boardH);
        ctx.stroke();
    }

    ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
}

function drawPathArrows(ctx: CanvasRenderingContext2D, state: GameState, m: Metrics) {
    const step = 4; // каждые 4 клетки
    const size = Math.max(6 * m.dpr, Math.floor(m.cellSize * 0.18));

    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.38)";

    for (let i = 0; i + 1 < state.path.length; i += step) {
        const a = state.path[i];
        const b = state.path[i + 1];

        const ax = m.boardX + (a.col + 0.5) * m.cellSize;
        const ay = m.boardY + (a.row + 0.5) * m.cellSize;
        const bx = m.boardX + (b.col + 0.5) * m.cellSize;
        const by = m.boardY + (b.row + 0.5) * m.cellSize;

        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.hypot(dx, dy);
        if (len < 1e-6) continue;

        const ux = dx / len;
        const uy = dy / len;

        // центр стрелки — на клетке i
        const cx = ax;
        const cy = ay;

        // треугольник
        const tipX = cx + ux * size;
        const tipY = cy + uy * size;
        const leftX = cx + (-uy) * (size * 0.55);
        const leftY = cy + (ux) * (size * 0.55);
        const rightX = cx + (uy) * (size * 0.55);
        const rightY = cy + (-ux) * (size * 0.55);

        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(leftX, leftY);
        ctx.lineTo(rightX, rightY);
        ctx.closePath();
        ctx.fill();
    }

    ctx.restore();
}

function drawPathSparks(ctx: CanvasRenderingContext2D, state: GameState, m: Metrics, tSec: number) {
    if (state.path.length < 2) return;

    const speed = 2.2; // клеток/сек
    const count = 3;   // искр одновременно

    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.55)";

    for (let k = 0; k < count; k++) {
        const p = (tSec * speed + k * (state.path.length / count)) % (state.path.length - 1);

        const i = Math.floor(p);
        const t = p - i;

        const a = state.path[i];
        const b = state.path[i + 1];

        const ax = (a.col + 0.5);
        const ay = (a.row + 0.5);
        const bx = (b.col + 0.5);
        const by = (b.row + 0.5);

        const cx = m.boardX + (ax + (bx - ax) * t) * m.cellSize;
        const cy = m.boardY + (ay + (by - ay) * t) * m.cellSize;

        const r = Math.max(2 * m.dpr, Math.floor(m.cellSize * 0.06));
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

function drawPathEndpoints(ctx: CanvasRenderingContext2D, state: GameState, m: Metrics) {
    const start = state.path[0];
    const end = state.path[state.path.length - 1];
    if (!start || !end) return;

    const drawTag = (c: { col: number; row: number }, text: string, color: string) => {
        const x = m.boardX + (c.col + 0.5) * m.cellSize;
        const y = m.boardY + (c.row + 0.5) * m.cellSize;

        ctx.save();
        ctx.font = `${Math.max(12 * m.dpr, Math.floor(m.cellSize * 0.22))}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillStyle = "rgba(0,0,0,0.45)";
        const w = Math.max(34 * m.dpr, Math.floor(m.cellSize * 0.8));
        const h = Math.max(18 * m.dpr, Math.floor(m.cellSize * 0.34));
        roundRect(ctx, x - w / 2, y - h / 2, w, h, Math.floor(h * 0.45));
        ctx.fill();

        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        ctx.restore();
    };

    drawTag(start, "IN", "rgba(120,255,160,0.85)");
    drawTag(end, "OUT", "rgba(255,120,120,0.85)");
}

function drawPath(ctx: CanvasRenderingContext2D, state: GameState, m: Metrics, tSec: number) {
    const pathSet = new Set(state.path.map(cellKey));

    for (let row = 0; row < state.grid.rows; row++) {
        for (let col = 0; col < state.grid.cols; col++) {
            const k = `${col},${row}`;
            if (!pathSet.has(k)) continue;

            const { x, y } = cellToWorld(m, { col, row });
            ctx.fillStyle = state.palette.pathFill;
            const pad = Math.floor(m.cellSize * 0.10);
            roundRect(ctx, x + pad, y + pad, m.cellSize - pad * 2, m.cellSize - pad * 2, Math.floor(m.cellSize * 0.18));
            ctx.fill();
            ctx.stroke();
        }
    }

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = state.palette.pathStroke;
    ctx.lineWidth = Math.max(3 * m.dpr, Math.floor(m.cellSize * 0.14));
    ctx.shadowColor = state.palette.pathStroke;
    ctx.shadowBlur = Math.max(6 * m.dpr, Math.floor(m.cellSize * 0.18));
    ctx.beginPath();

    for (let i = 0; i < state.path.length; i++) {
        const c = state.path[i];
        const px = m.boardX + (c.col + 0.5) * m.cellSize;
        const py = m.boardY + (c.row + 0.5) * m.cellSize;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();

    drawPathArrows(ctx, state, m);
    drawPathSparks(ctx, state, m, tSec);
    drawPathEndpoints(ctx, state, m);

}

function drawEnemies(ctx: CanvasRenderingContext2D, state: GameState, m: Metrics) {
    for (const e of state.enemies) {
        const p = posOnPath(state.path, e.progress);
        const x = m.boardX + p.x * m.cellSize;
        const y = m.boardY + p.y * m.cellSize;

        const baseR = Math.max(6 * m.dpr, Math.floor(m.cellSize * 0.22));
        const r = e.isBoss ? Math.floor(baseR * 1.55) : baseR;
        ctx.save();

        if (e.isBoss) {
            // босс: более "тяжёлый" цвет
            ctx.fillStyle = "rgba(255, 90, 120, 0.92)";
        } else {
            ctx.fillStyle =
                e.type === "TANK"
                    ? "rgba(255,160,160,0.85)"
                    : e.type === "SHIELDED"
                        ? "rgba(160,200,255,0.85)"
                        : "rgba(200,255,180,0.85)";
        }

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // Визуальный эффект замедления
        if (e.slowTimerSec > 0) {
            // интенсивность (чем ближе к концу — тем слабее)
            const k = Math.max(0, Math.min(1, e.slowTimerSec / 1.5));

            ctx.save();

            // лёгкая голубая "аура"
            ctx.fillStyle = `rgba(140, 200, 255, ${0.10 + 0.10 * k})`;
            ctx.beginPath();
            ctx.arc(x, y, r * 1.55, 0, Math.PI * 2);
            ctx.fill();

            // контур кольца
            ctx.strokeStyle = `rgba(140, 200, 255, ${0.45 + 0.25 * k})`;
            ctx.lineWidth = Math.max(2 * m.dpr, Math.floor(r * 0.18));
            ctx.beginPath();
            ctx.arc(x, y, r * 1.55, 0, Math.PI * 2);
            ctx.stroke();

            // снежинка-иконка над врагом
            ctx.fillStyle = "rgba(220, 245, 255, 0.95)";
            ctx.font = `${Math.floor(r * 1.2)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji"`;
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText("❄️", x, y - r * 1.65);

            ctx.restore();
        }


        // обводка (у босса — жирнее)
        ctx.strokeStyle = e.isBoss ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.18)";
        ctx.lineWidth = e.isBoss ? Math.max(3 * m.dpr, Math.floor(r * 0.16)) : Math.max(2 * m.dpr, 2);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();

        // метка босса: 👑 + текст BOSS
        if (e.isBoss) {
            ctx.fillStyle = "rgba(255,255,255,0.95)";
            ctx.font = `${Math.floor(r * 0.85)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji"`;
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText("👑", x, y - r * 0.95);

            // крупнее + с обводкой, чтобы читалось на любом фоне
            const bossFont = Math.max(14 * m.dpr, Math.floor(r * 0.60));
            ctx.font = `${bossFont}px system-ui`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";

            // обводка
            ctx.lineWidth = Math.max(3 * m.dpr, Math.floor(bossFont * 0.12));
            ctx.strokeStyle = "rgba(0,0,0,0.55)";
            ctx.strokeText("BOSS", x, y + r * 0.62);

            // заливка
            ctx.fillStyle = "rgba(255,255,255,0.95)";
            ctx.fillText("BOSS", x, y + r * 0.62);
        }

        // ===== HP / Shield bars =====
        const w = e.isBoss ? r * 3.2 : r * 2.4;
        const h = Math.max(4 * m.dpr, Math.floor(r * (e.isBoss ? 0.22 : 0.20)));
        const bx = x - w / 2;
        const by = y - r - h - (e.isBoss ? 8 : 4) * m.dpr;

        // фон полоски
        ctx.fillStyle = "rgba(0,0,0,0.40)";
        ctx.fillRect(bx, by, w, h);

        const hpRatio = e.hp / e.maxHp;
        ctx.fillStyle = e.isBoss ? "rgba(255, 240, 120, 0.92)" : "rgba(120,255,160,0.85)";
        ctx.fillRect(bx, by, w * hpRatio, h);

        // рамка полоски
        ctx.strokeStyle = "rgba(255,255,255,0.22)";
        ctx.lineWidth = Math.max(m.dpr, 1);
        ctx.strokeRect(bx, by, w, h);

        // Shield bar (если есть)
        if (e.maxShield > 0) {
            const sy = by - h - 3 * m.dpr;
            ctx.fillStyle = "rgba(0,0,0,0.35)";
            ctx.fillRect(bx, sy, w, h);

            const sRatio = e.shield / e.maxShield;
            ctx.fillStyle = "rgba(160,200,255,0.85)";
            ctx.fillRect(bx, sy, w * sRatio, h);

            ctx.strokeStyle = "rgba(255,255,255,0.18)";
            ctx.strokeRect(bx, sy, w, h);
        }

        ctx.restore();
    }
}

function drawBullets(ctx: CanvasRenderingContext2D, state: GameState, m: Metrics) {
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.9)";

    for (const b of state.bullets) {
        const x = m.boardX + b.x * m.cellSize;
        const y = m.boardY + b.y * m.cellSize;
        const r = Math.max(2 * m.dpr, Math.floor(m.cellSize * 0.06));
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

function drawTowers(ctx: CanvasRenderingContext2D, state: GameState, m: Metrics) {
    for (const t of state.towers) drawTower(ctx, state, m, t);
}

function drawTower(ctx: CanvasRenderingContext2D, state: GameState, m: Metrics, t: Tower) {
    const { x, y } = cellToWorld(m, t.cell);
    const pad = Math.floor(m.cellSize * 0.18);
    const rx = x + pad;
    const ry = y + pad;
    const rw = m.cellSize - pad * 2;
    const rh = m.cellSize - pad * 2;

    // база башни
    ctx.fillStyle = state.palette.towerFill;
    ctx.fillRect(rx, ry, rw, rh);

    // символ типа (по центру)
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const glyph = TOWER_VIEW[t.type].glyph;

    // Emoji/символы лучше читаются чуть крупнее
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `${Math.floor(m.cellSize * 0.48)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji"`;
    ctx.fillText(glyph, x + m.cellSize / 2, y + m.cellSize * 0.48);

    // звёзды уровня (внизу)
    const stars = levelStars(t.level);
    ctx.fillStyle = "rgba(255,255,255,0.90)";
    ctx.font = `${Math.floor(m.cellSize * 0.22)}px system-ui`;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(stars, x + m.cellSize / 2, y + m.cellSize * 0.90);

    ctx.restore();
}

function levelStars(level: 1 | 2 | 3): string {
    return level === 1 ? "★" : level === 2 ? "★★" : "★★★";
}

function drawHover(ctx: CanvasRenderingContext2D, state: GameState, m: Metrics, cell: Cell) {
    if (cell.col < 0 || cell.row < 0 || cell.col >= state.grid.cols || cell.row >= state.grid.rows) return;

    const { x, y } = cellToWorld(m, cell);

    const selected = state.placement.selectedTower;
    const check = selected ? canPlaceTower(state, cell) : { ok: false, reason: "Выбери башню" };

    // заливка (зел/красн/нейтр)
    ctx.save();
    if (!selected) {
        ctx.fillStyle = "rgba(255,255,255,0.06)";
    } else if (check.ok) {
        ctx.fillStyle = "rgba(120, 255, 160, 0.20)";
    } else {
        ctx.fillStyle = "rgba(255, 120, 120, 0.20)";
    }
    ctx.fillRect(x, y, m.cellSize, m.cellSize);

    // рамка
    ctx.lineWidth = 3 * m.dpr;
    if (!selected) {
        ctx.strokeStyle = "rgba(255,255,255,0.20)";
    } else if (check.ok) {
        ctx.strokeStyle = "rgba(120, 255, 160, 0.55)";
    } else {
        ctx.strokeStyle = "rgba(255, 120, 120, 0.55)";
    }
    ctx.strokeRect(x + 1, y + 1, m.cellSize - 2, m.cellSize - 2);

    // подпись причины (если нельзя)
    if (selected && !check.ok && check.reason) {
        ctx.font = `${Math.floor(m.cellSize * 0.18)}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "rgba(255,255,255,0.85)";
    }

    ctx.restore();
}

function drawRange(ctx: CanvasRenderingContext2D, state: GameState, m: Metrics, hoverCell: Cell | null) {
    // 1) если выбрана башня на поле — показываем её радиус
    if (state.selectedTowerId) {
        const t = state.towers.find(x => x.id === state.selectedTowerId);
        if (t) {
            const p = getTowerParams(t.type, t.level);
            const c = cellCenter(t.cell);
            drawRangeCircle(ctx, m, c.x, c.y, p.rangeCells);
        }
    }

    // 2) если выбран тип башни и есть hoverCell — показываем радиус предполагаемой установки
    const selectedType = state.placement.selectedTower;
    if (selectedType && hoverCell) {
        // радиус будущей башни (уровень 1)
        const p = getTowerParams(selectedType, 1);
        const c = cellCenter(hoverCell);
        drawRangeCircle(ctx, m, c.x, c.y, p.rangeCells);
    }
}

function drawRangeCircle(ctx: CanvasRenderingContext2D, m: Metrics, cxCells: number, cyCells: number, rangeCells: number) {
    const cx = m.boardX + cxCells * m.cellSize;
    const cy = m.boardY + cyCells * m.cellSize;
    const r = rangeCells * m.cellSize;

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = Math.max(2 * m.dpr, Math.floor(m.cellSize * 0.05));
    ctx.setLineDash([6 * m.dpr, 6 * m.dpr]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}
