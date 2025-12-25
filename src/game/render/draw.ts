import type { GameState, Cell, Tower } from "../model/types";
import { cellKey } from "../model/grid";
import { cellToWorld } from "./metrics";
import type { Metrics} from "./metrics"
import { canPlaceTower } from "../model/state";
import { TOWER_VIEW } from "../ui/towerView";

export function draw(ctx: CanvasRenderingContext2D, state: GameState, m: Metrics, hoverCell: Cell | null) {
    ctx.clearRect(0, 0, m.canvasW, m.canvasH);

    // фон из палитры уровня
    ctx.fillStyle = state.palette.bg;
    ctx.fillRect(0, 0, m.canvasW, m.canvasH);

    drawGrid(ctx, state, m);
    drawPath(ctx, state, m);
    drawTowers(ctx, state, m);

    if (hoverCell) drawHover(ctx, state, m, hoverCell);

    drawStartFinish(ctx, state, m);
}

function drawGrid(ctx: CanvasRenderingContext2D, state: GameState, m: Metrics) {
    ctx.save();
    ctx.strokeStyle = state.palette.grid;
    ctx.lineWidth = 1 * m.dpr;

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

function drawPath(ctx: CanvasRenderingContext2D, state: GameState, m: Metrics) {
    const pathSet = new Set(state.path.map(cellKey));

    for (let row = 0; row < state.grid.rows; row++) {
        for (let col = 0; col < state.grid.cols; col++) {
            const k = `${col},${row}`;
            if (!pathSet.has(k)) continue;

            const { x, y } = cellToWorld(m, { col, row });
            ctx.fillStyle = state.palette.pathFill;
            ctx.fillRect(x, y, m.cellSize, m.cellSize);
        }
    }

    ctx.save();
    ctx.strokeStyle = state.palette.pathStroke;
    ctx.lineWidth = 2 * m.dpr;
    ctx.beginPath();

    for (let i = 0; i < state.path.length; i++) {
        const cell = state.path[i];
        const p = cellToWorld(m, cell);
        const cx = p.x + m.cellSize / 2;
        const cy = p.y + m.cellSize / 2;
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
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

function drawStartFinish(ctx: CanvasRenderingContext2D, state: GameState, m: Metrics) {
    const start = state.path[0];
    const end = state.path[state.path.length - 1];
    const s = cellToWorld(m, start);
    const e = cellToWorld(m, end);

    ctx.save();
    ctx.font = `${Math.floor(m.cellSize * 0.24)}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "rgba(120,255,160,0.85)";
    ctx.fillText("IN", s.x + m.cellSize / 2, s.y + m.cellSize / 2);

    ctx.fillStyle = "rgba(255,120,120,0.85)";
    ctx.fillText("OUT", e.x + m.cellSize / 2, e.y + m.cellSize / 2);

    ctx.restore();
}
