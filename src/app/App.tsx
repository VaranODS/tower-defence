import { useMemo, useState } from "react";
import "./App.css";
import { GameCanvas } from "../game/canvas/GameCanvas";
import { createInitialState, setSelectedTower, TOWER_COST } from "../game/model/state";
import type { TowerType } from "../game/model/types";
import { TOWER_VIEW } from "../game/ui/towerView";

export default function App() {
    const [state, setState] = useState(createInitialState());

    const selected = state.placement.selectedTower;

    const hint = useMemo(() => {
        if (!selected) return "Выбери башню и тапни по клетке (не по пути).";
        return `Режим установки: ${label(selected)}. Тап по клетке для постройки.`;
    }, [selected]);

    const toggle = (t: TowerType) => {
        setState(prev => setSelectedTower(prev, prev.placement.selectedTower === t ? null : t));
    };

    return (
        <div className="app">
            <div className="topbar">
                <div className="pill">HP: {state.stats.baseHp}</div>
                <div className="pill">💰 {state.stats.money}</div>
                <div className="pill">Wave: {state.stats.wave}</div>
                <div className="pill">Level: {state.levelId} — {state.levelName}</div>

            </div>

            <div className="main">
                <GameCanvas state={state} setState={setState} />
            </div>

            <div className="bottombar">
                <div className="shop">
                    <button
                        aria-pressed={selected === "CANNON"}
                        onClick={() => toggle("CANNON")}
                        title={TOWER_VIEW.CANNON.name}
                    >
                        {TOWER_VIEW.CANNON.glyph} {TOWER_COST.CANNON}
                    </button>

                    <button
                        aria-pressed={selected === "FROST"}
                        onClick={() => toggle("FROST")}
                        title={TOWER_VIEW.FROST.name}
                    >
                        {TOWER_VIEW.FROST.glyph} {TOWER_COST.FROST}
                    </button>

                    <button
                        aria-pressed={selected === "SNIPER"}
                        onClick={() => toggle("SNIPER")}
                        title={TOWER_VIEW.SNIPER.name}
                    >
                        {TOWER_VIEW.SNIPER.glyph} {TOWER_COST.SNIPER}
                    </button>
                </div>

                <div className="hint">{hint}</div>
            </div>
        </div>
    );
}

function label(t: TowerType) {
    if (t === "CANNON") return "Пушка";
    if (t === "FROST") return "Лёд";
    return "Снайпер";
}
