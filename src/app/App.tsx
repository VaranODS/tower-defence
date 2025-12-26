import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from "react";
import "./App.css";
import {GameCanvas} from "../game/canvas/GameCanvas";
import {
  canUpgradeSelectedTower,
  createInitialState,
  getUpgradeCost,
  nextLevel,
  resetGame,
  sellSelectedTower,
  setSelectedTower,
  startWave,
  TOWER_COST,
  togglePause,
  upgradeSelectedTower,
  goToLevel, getSellRefund,
} from "../game/model/state";
import type {GameState, Tower, TowerType} from "../game/model/types";
import {TOWER_VIEW} from "../game/ui/towerView";
import {saveProgress} from "../game/model/persist";
import {getLevelDef, getAllLevelDefs} from "../game/model/levels";
import {getTowerParams} from "../game/model/towerParams";

export default function App() {
  const [state, setState] = useState(() => createInitialState());
  const stateRef = useRef<GameState>(state);

  // единый dispatch: применяем редьюсер к stateRef и сразу обновляем UI
  const dispatch = useCallback((reduce: (s: GameState) => GameState) => {
    const next = reduce(stateRef.current);
    stateRef.current = next;
    setState(next);
  }, []);

  // canvas loop вызывает syncUi редко (throttle)
  const syncUi = useCallback((s: GameState) => {
    setState(s);
  }, []);

  const selectedBuildType = state.placement.selectedTower;

  const selectedTower: Tower | null =
    state.selectedTowerId ? state.towers.find(t => t.id === state.selectedTowerId) ?? null : null;

  // проверка апгрейда (пусть функция сама решает, можно ли апгрейдить)
  const upgradeCheck = canUpgradeSelectedTower(state);

  const upgradeCost =
    selectedTower && selectedTower.level < 3
      ? getUpgradeCost(selectedTower.type, (selectedTower.level + 1) as 2 | 3)
      : 0;

  const wavesTotal = getLevelDef(state.levelId).wavesPerLevel;

  const hint = useMemo(() => {
    if (!selectedBuildType) return "Выбери башню и тапни по клетке (не по пути).";
    return `Режим установки: ${label(selectedBuildType)}. Тап по клетке для постройки.`;
  }, [selectedBuildType]);

  // IMPORTANT: через dispatch, чтобы stateRef был актуален
  const toggleBuildType = (t: TowerType) => {
    dispatch(prev => setSelectedTower(prev, prev.placement.selectedTower === t ? null : t));
  };

  const isNarrow = useIsNarrow(420);

  // bottom sheet (привязываем к towerId, без useEffect)
  const [sheetTowerId, setSheetTowerId] = useState<string | null>(null);
  const isSheetOpen = Boolean(selectedTower) && sheetTowerId === state.selectedTowerId;

  const [levelPickerOpen, setLevelPickerOpen] = useState(false);
  const allLevels = useMemo(() => getAllLevelDefs(), []);

  useEffect(() => {
    saveProgress({levelId: state.levelId});
  }, [state.levelId]);

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbarStats">
          <div className="pill">{isNarrow ? `❤ ${state.stats.baseHp}` : `HP: ${state.stats.baseHp}`}</div>
          <div className="pill">💰 {state.stats.money}</div>
          <div className="pill">
            {isNarrow ? `W ${state.stats.waveInLevel}/${wavesTotal}` : `Wave: ${state.stats.waveInLevel} / ${wavesTotal}`}
          </div>
          <div className="pill">
            {isNarrow ? `L${state.levelId}` : `Level: ${state.levelId}`}
            {!isNarrow && <span className="pillSub">— {state.levelName}</span>}
          </div>

          {state.waveState.status === "READY" && state.waveState.intermissionSec > 0 && (
            <div className="pill">
              {isNarrow ? `Next ${Math.ceil(state.waveState.intermissionSec)}s` : `Next wave: ${Math.ceil(state.waveState.intermissionSec)}s`}
            </div>
          )}
        </div>

        <div className="topbarActions">
          <button className="btnSmall" onClick={() => dispatch(prev => startWave(prev))}>
            {isNarrow ? "Start" : "Start Wave"}
          </button>
          <button className="btnSmall" onClick={() => dispatch(prev => togglePause(prev))}>
            {state.mode === "PAUSED" ? "Resume" : "Pause"}
          </button>
          <button className="btnSmall" onClick={() => setLevelPickerOpen(true)}>
            {isNarrow ? "Lvls" : "Levels"}
          </button>

        </div>
      </div>

      <div className="main">
        <GameCanvas stateRef={stateRef} dispatch={dispatch} syncUi={syncUi}/>
      </div>

      {/* LEVEL COMPLETE */}
      {state.mode === "LEVEL_COMPLETE" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "rgba(0,0,0,0.55)",
            padding: 16,
            zIndex: 50,
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
            <div style={{fontSize: 18, fontWeight: 800, marginBottom: 8}}>Уровень пройден!</div>
            <div style={{opacity: 0.9, marginBottom: 12}}>
              {state.levelId} — {state.levelName}
            </div>

            <div style={{display: "flex", gap: 10, justifyContent: "flex-end"}}>
              <button onClick={() => dispatch(prev => nextLevel(prev))}>Next level</button>
              <button onClick={() => dispatch(prev => resetGame(prev, null))}>Restart</button>
            </div>
          </div>
        </div>
      )}

      {/* END SCREEN */}
      {state.endScreen && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "rgba(0,0,0,0.60)",
            padding: 16,
            zIndex: 60,
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
            <div style={{fontSize: 20, fontWeight: 900, marginBottom: 8}}>
              {state.endScreen.kind === "GAME_OVER" ? "Поражение" : "Все уровни пройдены!"}
            </div>

            <div style={{opacity: 0.9, marginBottom: 14}}>
              {state.endScreen.kind === "GAME_OVER"
                ? "База уничтожена. Прогресс сброшен на 1 уровень."
                : "Поздравляю! Прогресс сброшен на 1 уровень."}
            </div>

            <div style={{display: "flex", gap: 10, justifyContent: "flex-end"}}>
              <button
                onClick={() =>
                  dispatch(prev => ({
                    ...prev,
                    endScreen: null,
                    selectedTowerId: null,
                    placement: {selectedTower: null},
                  }))
                }
              >
                Ок
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="hint">{hint}</div>

      {/* ===== BOTTOM BAR ===== */}
      <div className={`bottombar ${isNarrow ? "bottombarNarrow" : ""}`}>
        {!selectedTower ? (
          <div className="shopRow">
            <button
              className="btnSmall"
              aria-pressed={selectedBuildType === "CANNON"}
              onClick={() => toggleBuildType("CANNON")}
              title={TOWER_VIEW.CANNON.name}
            >
              {TOWER_VIEW.CANNON.glyph} {TOWER_COST.CANNON}
            </button>

            <button
              className="btnSmall"
              aria-pressed={selectedBuildType === "FROST"}
              onClick={() => toggleBuildType("FROST")}
              title={TOWER_VIEW.FROST.name}
            >
              {TOWER_VIEW.FROST.glyph} {TOWER_COST.FROST}
            </button>

            <button
              className="btnSmall"
              aria-pressed={selectedBuildType === "SNIPER"}
              onClick={() => toggleBuildType("SNIPER")}
              title={TOWER_VIEW.SNIPER.name}
            >
              {TOWER_VIEW.SNIPER.glyph} {TOWER_COST.SNIPER}
            </button>
          </div>
        ) : (
          <div className="dockRow">
            <div className="pill">
              {towerGlyph(selectedTower.type)} {stars(selectedTower.level)}{" "}
              <span className="pillSub">({selectedTower.type})</span>
            </div>

            <div className="manageBtns" style={{marginLeft: "auto"}}>
              <button
                className="btnSmall"
                onClick={() => dispatch(prev => upgradeSelectedTower(prev))}
                disabled={!upgradeCheck.ok || selectedTower.level >= 3}
                title={upgradeCheck.ok ? `Upgrade за ${upgradeCost}` : (upgradeCheck.reason ?? "Нельзя")}
              >
                Upgrade {selectedTower.level < 3 ? upgradeCost : "MAX"}
              </button>

              <button className="btnSmall" onClick={() => dispatch(prev => sellSelectedTower(prev))}>
                Sell +{getSellRefund(selectedTower)}
              </button>

              <button className="btnSmall" onClick={() => setSheetTowerId(selectedTower.id)}>
                Info
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== BOTTOM SHEET (DETAILS) ===== */}
      {selectedTower && isSheetOpen && (
        <div className="sheetOverlay" onClick={() => setSheetTowerId(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheetHeader">
              <div className="sheetTitle">
                {towerGlyph(selectedTower.type)} {stars(selectedTower.level)}{" "}
                <span style={{opacity: 0.85}}>({selectedTower.type})</span>
              </div>
              <button className="btnSmall" onClick={() => setSheetTowerId(null)}>
                Close
              </button>
            </div>

            <TowerStatsPreview tower={selectedTower} money={state.stats.money}/>
          </div>
        </div>
      )}

      {/* ===== LEVEL SELECT ===== */}
      {levelPickerOpen && (
        <div className="levelOverlay" onClick={() => setLevelPickerOpen(false)}>
          <div className="levelModal" onClick={(e) => e.stopPropagation()}>
            <div className="levelHeader">
              <div className="levelTitle">Выбор уровня</div>
              <button className="btnSmall" onClick={() => setLevelPickerOpen(false)}>
                Close
              </button>
            </div>

            <div className="levelGrid">
              {allLevels.map((lv) => (
                <button
                  key={lv.id}
                  className={`levelCard ${lv.id === state.levelId ? "levelCardActive" : ""}`}
                  onClick={() => {
                    dispatch((prev) => goToLevel(prev, lv.id));
                    saveProgress({ levelId: lv.id });
                    setLevelPickerOpen(false);
                  }}
                >
                  <div className="levelCardTop">
                    <div className="levelBadge">L{lv.id}</div>
                    <div className="levelName">{lv.name}</div>
                  </div>
                  <div className="levelMeta">Waves: {lv.wavesPerLevel}</div>
                </button>
              ))}
            </div>

            <div className="levelFooter">
              <div className="levelHint">
                Выбор уровня запускает уровень “с нуля” (HP/💰/волна сбрасываются).
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function label(t: TowerType) {
  if (t === "CANNON") return "Пушка";
  if (t === "FROST") return "Лёд";
  return "Снайпер";
}

function towerGlyph(type: Tower["type"]): string {
  if (type === "CANNON") return "💥";
  if (type === "FROST") return "❄️";
  return "🎯";
}

function stars(level: 1 | 2 | 3) {
  return level === 1 ? "★" : level === 2 ? "★★" : "★★★";
}

/* ===== Sheet content: preview of stats after upgrade ===== */

type TowerStatsPreviewProps = {
  tower: Tower;
  money: number;
};

function TowerStatsPreview({tower, money}: TowerStatsPreviewProps) {
  const cur = getTowerParams(tower.type, tower.level);

  const nextLevel = tower.level < 3 ? ((tower.level + 1) as 2 | 3) : null;
  const next = nextLevel ? getTowerParams(tower.type, nextLevel) : null;

  const upgradeCost = nextLevel ? getUpgradeCost(tower.type, nextLevel) : 0;
  const canUpgrade = Boolean(nextLevel) && money >= upgradeCost;

  if (!next) {
    return <div className="shopHint">Максимальный уровень башни.</div>;
  }

  return (
    <div className="manageStats">
      <div className="shopHint" style={{marginBottom: 6}}>
        Upgrade: {upgradeCost} {canUpgrade ? "" : "(не хватает золота)"}
      </div>

      <StatRow label="Range" from={fmtCells(cur.rangeCells)} to={fmtCells(next.rangeCells)}/>
      <StatRow label="Damage" from={`${cur.damage}`} to={`${next.damage}`}/>
      <StatRow label="Cooldown" from={fmtSec(cur.fireCooldownSec)} to={fmtSec(next.fireCooldownSec)}/>
      <StatRow label="Bullet" from={fmtCells(cur.bulletSpeedCellsPerSec)} to={fmtCells(next.bulletSpeedCellsPerSec)}/>

      <StatRow label="Slow" from={fmtSlow(cur.slowMul, cur.slowDurationSec)}
               to={fmtSlow(next.slowMul, next.slowDurationSec)}/>
      <StatRow label="Crit" from={fmtCrit(cur.critChance, cur.critMult)} to={fmtCrit(next.critChance, next.critMult)}/>
    </div>
  );
}

function StatRow(props: { label: string; from: string; to: string }) {
  const {label, from, to} = props;
  return (
    <div className="statRow">
      <div className="statLabel">{label}</div>
      <div className="statVal">{from}</div>
      <div className="statArrow">→</div>
      <div className="statVal">{to}</div>
    </div>
  );
}

function fmtSec(v: number): string {
  return `${v.toFixed(2)}s`;
}

function fmtCells(v: number): string {
  return v.toFixed(2);
}

function fmtSlow(mul?: number, dur?: number): string {
  if (mul === undefined || dur === undefined) return "—";
  const pct = Math.round((1 - mul) * 100);
  return `-${pct}% / ${dur.toFixed(1)}s`;
}

function fmtCrit(ch?: number, mult?: number): string {
  if (ch === undefined || mult === undefined) return "—";
  const pct = Math.round(ch * 100);
  return `${pct}% ×${mult.toFixed(1)}`;
}

/* ===== Responsive hook (no deprecated, no setState in effect) ===== */

function useIsNarrow(maxWidth: number): boolean {
  const query = `(max-width: ${maxWidth}px)`;

  const subscribe = (onStoreChange: () => void) => {
    if (typeof window === "undefined") return () => undefined;
    const mq = window.matchMedia(query);
    mq.addEventListener("change", onStoreChange);
    return () => mq.removeEventListener("change", onStoreChange);
  };

  const getSnapshot = () => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  };

  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
