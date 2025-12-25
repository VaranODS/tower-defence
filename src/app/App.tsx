import {useEffect, useMemo, useState} from "react";
import "./App.css";
import {GameCanvas} from "../game/canvas/GameCanvas";
import {
    createInitialState,
    setSelectedTower,
    TOWER_COST,
    startWave,
    togglePause,
    upgradeSelectedTower,
    sellSelectedTower,
    canUpgradeSelectedTower,
    getUpgradeCost, nextLevel
} from "../game/model/state";
import type {TowerType} from "../game/model/types";
import {TOWER_VIEW} from "../game/ui/towerView";
import {saveProgress} from "../game/model/persist";
import {getLevelDef} from "../game/model/levels";

export default function App() {
    const [state, setState] = useState(createInitialState());

    const selected = state.placement.selectedTower;

    const selectedTower = state.selectedTowerId
        ? state.towers.find(t => t.id === state.selectedTowerId) ?? null
        : null;

    const upgradeCheck = canUpgradeSelectedTower(state);
    const upgradeCost =
        selectedTower && selectedTower.level < 3
            ? getUpgradeCost(selectedTower.type, (selectedTower.level + 1) as 2 | 3)
            : 0;

    const wavesTotal = getLevelDef(state.levelId).wavesPerLevel;

    const hint = useMemo(() => {
        if (!selected) return "Выбери башню и тапни по клетке (не по пути).";
        return `Режим установки: ${label(selected)}. Тап по клетке для постройки.`;
    }, [selected]);

    const toggle = (t: TowerType) => {
        setState(prev => setSelectedTower(prev, prev.placement.selectedTower === t ? null : t));
    };

    useEffect(() => {
        saveProgress({ levelId: state.levelId });
    }, [state.levelId]);

    return (
        <div className="app">
            <div className="topbar">
                <div className="pill">HP: {state.stats.baseHp}</div>
                <div className="pill">💰 {state.stats.money}</div>
                <div className="pill">Wave: {state.stats.waveInLevel} / {wavesTotal}</div>
                <div className="pill">Level: {state.levelId} — {state.levelName}</div>
                <button onClick={() => setState(prev => startWave(prev))}>
                    Start Wave
                </button>

                <button onClick={() => setState(prev => togglePause(prev))}>
                    {state.mode === "RUNNING" ? "Pause" : "Resume"}
                </button>
                <div className="pill">Mode: {state.mode}</div>
            </div>

            <div className="main">
                <GameCanvas state={state} setState={setState}/>
            </div>
            {state.mode === "LEVEL_COMPLETE" && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "grid",
                        placeItems: "center",
                        background: "rgba(0,0,0,0.55)",
                        padding: 16,
                    }}
                >
                    <div
                        style={{
                            width: "min(520px, 92vw)",
                            borderRadius: 16,
                            padding: 16,
                            background: "rgba(255,255,255,0.08)",
                            backdropFilter: "blur(10px)",
                            color: "white",
                        }}
                    >
                        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                            Уровень пройден!
                        </div>
                        <div style={{ opacity: 0.9, marginBottom: 12 }}>
                            {state.levelId} — {state.levelName}
                        </div>

                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                            <button onClick={() => setState(prev => nextLevel(prev))}>
                                Next level
                            </button>
                            <button onClick={() => setState(createInitialState())}>
                                Restart
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
                {selectedTower && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="pill">
                            {TOWER_VIEW[selectedTower.type].glyph} {stars(selectedTower.level)}
                        </div>

                        <button
                            onClick={() => setState(prev => upgradeSelectedTower(prev))}
                            disabled={!upgradeCheck.ok}
                            title={upgradeCheck.ok ? `Upgrade за ${upgradeCost}` : (upgradeCheck.reason ?? "Нельзя")}
                        >
                            Upgrade {upgradeCost}
                        </button>

                        <button onClick={() => setState(prev => sellSelectedTower(prev))}>
                            Sell
                        </button>
                    </div>
                )}
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

function stars(level: 1 | 2 | 3) {
    return level === 1 ? "★" : level === 2 ? "★★" : "★★★";
}
