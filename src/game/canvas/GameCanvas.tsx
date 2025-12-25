import React, { useEffect, useMemo, useRef, useState } from "react";
import type { GameState, Cell } from "../model/types";
import { computeMetrics, worldToCell } from "../render/metrics";
import { draw } from "../render/draw";
import { startLoop } from "../engine/gameLoop";
import { getCanvasPointerPos } from "../engine/input";
import { inBounds } from "../model/grid";
import {placeTower, canPlaceTower, step, towerAt, setSelectedTowerId, clearPlacement} from "../model/state";

type Props = {
    state: GameState;
    setState: React.Dispatch<React.SetStateAction<GameState>>;
};

export function GameCanvas({ state, setState }: Props) {
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const [hoverCell, setHoverCell] = useState<Cell | null>(null);
    const [cssSize, setCssSize] = useState<{ w: number; h: number }>({ w: 300, h: 300 });

    const [hoverReason, setHoverReason] = useState<string | null>(null);
    const hideTimerRef = useRef<number | null>(null);

    const dpr = useMemo(() => Math.max(1, Math.min(2.5, window.devicePixelRatio || 1)), []);

    const showReason = (text: string | null, autoHideMs?: number) => {
        // очистить предыдущий таймер
        if (hideTimerRef.current !== null) {
            window.clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }

        setHoverReason(text);

        if (text && autoHideMs && autoHideMs > 0) {
            hideTimerRef.current = window.setTimeout(() => {
                setHoverReason(null);
                hideTimerRef.current = null;
            }, autoHideMs);
        }
    };

    // следим за размером контейнера
    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;

        let alive = true;

        const ro = new ResizeObserver(entries => {
            if (!alive) return;
            const rect = entries[0].contentRect;
            if (!rect) return;
            setCssSize({ w: rect.width, h: rect.height });
        });
        ro.observe(el);
        return () => {
            alive = false;
            ro.disconnect();
        }
    }, []);

    // основной цикл: resize canvas + draw
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const loop = startLoop((dtMs) => {
            const dtSec = Math.min(0.05, dtMs / 1000);

            //Обновление мира
            setState(prev => step(prev, dtSec));

            // рисование будет на следующем рендере с новым state
            const m = computeMetrics(state.grid, cssSize.w, cssSize.h, dpr);
            if (canvas.width !== m.canvasW || canvas.height !== m.canvasH) {
                canvas.width = m.canvasW;
                canvas.height = m.canvasH;
            }
            draw(ctx, state, m, hoverCell);
        });

        return () => loop.stop();
    }, [state, cssSize.w, cssSize.h, dpr, hoverCell, setState]);

    // pointer events (и мышь, и тач)
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const onMove = (e: PointerEvent) => {
            const m = computeMetrics(state.grid, cssSize.w, cssSize.h, dpr);
            const p = getCanvasPointerPos(e, canvas);
            const cell = worldToCell(m, p.x, p.y);
            if (!cell || !inBounds(state.grid, cell)) {
                setHoverCell(null);
                return;
            }
            setHoverCell(cell);

            const selected = state.placement.selectedTower;
            if (!selected) {
                showReason(null);
            } else {
                const check = canPlaceTower(state, cell);
                showReason(check.ok ? null : (check.reason ?? "Нельзя строить"));
            }
        };

        const onDown = (e: PointerEvent) => {
            // чтобы браузер не превращал это в скролл/зум
            e.preventDefault();

            const m = computeMetrics(state.grid, cssSize.w, cssSize.h, dpr);
            const p = getCanvasPointerPos(e, canvas);
            const cell = worldToCell(m, p.x, p.y);
            if (!cell || !inBounds(state.grid, cell)) return;

            // 1) если тапнули по башне — выбираем её
            const tappedTower = towerAt(state, cell);
            if (tappedTower) {
                setState(prev => ({
                    ...setSelectedTowerId(prev, tappedTower.id), placement: { selectedTower: null }
                }));
                return;
            }

            // если тапнули мимо башни — снимаем выбор башни
            setState(prev => setSelectedTowerId(prev, null));

            // 2) если выбран тип башни — пробуем поставить
            const selectedType = state.placement.selectedTower;
            if (selectedType) {
                const check = canPlaceTower(state, cell);

                if (!check.ok) {
                    showReason(check.reason ?? "Нельзя строить", 1500);
                    return;
                }

                showReason("Построено", 800);
                setState(prev => placeTower(prev, cell));
                return;
            }

            // 3) иначе — просто очистим режим установки (на всякий)
            setState(prev => clearPlacement(prev));

            setHoverCell(cell);

        };

        canvas.addEventListener("pointermove", onMove, { passive: false });
        canvas.addEventListener("pointerdown", onDown, { passive: false });

        return () => {
            canvas.removeEventListener("pointermove", onMove);
            canvas.removeEventListener("pointerdown", onDown);
        };
    }, [state, cssSize.w, cssSize.h, dpr, setState]);

    return (
        <div ref={wrapRef} style={{ width: "100%", height: "100%", flex: 1, position: "relative" }}>
            <canvas
                ref={canvasRef}
                style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.04)",
                    touchAction: "none",
                }}
            />
            {hoverReason && (
                <div
                    style={{
                        position: "absolute",
                        left: 12,
                        right: 12,
                        top: 12,
                        padding: "10px 12px",
                        borderRadius: 12,
                        background: "rgba(0,0,0,0.45)",
                        color: "rgba(255,255,255,0.95)",
                        fontSize: 16,
                        fontWeight: 600,
                        lineHeight: 1.2,
                        backdropFilter: "blur(6px)",
                        pointerEvents: "none",
                    }}
                >
                    {hoverReason}
                </div>
            )}
        </div>
    );
}
