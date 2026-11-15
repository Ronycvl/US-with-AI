import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import {
  forecast,
  formatShortDateTime,
  GaugeUnit,
  getTank,
  PlantState,
  TANKS,
  toDateStr,
} from '../lib/plantLogic';
import { playDoubleBeep, triggerVibration } from '../lib/audioAndPdf';

interface LogLevelScreenProps {
  state: PlantState;
  now: number;
  initialTankId?: string;
  operatorLabel: string;
  onToggleOnline: () => void;
  onSaveReading: (payload: { tankId: string; pct: number; time: number; by: string }) => {
    synced: boolean;
  };
}

export const LogLevelScreen: React.FC<LogLevelScreenProps> = ({
  state,
  now,
  initialTankId,
  operatorLabel,
  onToggleOnline,
  onSaveReading,
}) => {
  const todayStr = toDateStr(now);

  // Determine which tanks have already been logged today (field readings)
  const loggedTodayMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const t of TANKS) {
      map[t.id] = state.readings.some(
        (r) => r.tankId === t.id && r.source === 'field' && toDateStr(r.time) === todayStr
      );
    }
    return map;
  }, [state.readings, todayStr]);

  const firstUnlogged = TANKS.find((t) => !loggedTodayMap[t.id])?.id ?? TANKS[0].id;
  const [selectedTankId, setSelectedTankId] = useState<string>(initialTankId ?? firstUnlogged);
  const selectedTank = getTank(selectedTankId);

  const latestTankPct = useMemo(() => {
    const list = state.readings
      .filter((r) => r.tankId === selectedTankId)
      .sort((a, b) => b.time - a.time);
    return list[0]?.pct ?? 50;
  }, [state.readings, selectedTankId]);

  const [unit, setUnit] = useState<GaugeUnit>(selectedTank.gaugeUnit);
  const [pctValue, setPctValue] = useState<number>(latestTankPct);
  const [confirmOutOfRange, setConfirmOutOfRange] = useState<{ expectedPct: number; diff: number } | null>(null);
  const [confirmationMsg, setConfirmationMsg] = useState<string | null>(null);
  const [deviceTime, setDeviceTime] = useState<number>(Date.now());
  const entryStartRef = useRef<number>(Date.now());

  useEffect(() => {
    const id = setInterval(() => setDeviceTime(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  // When switching tanks, load tank's default gauge unit & latest reading and restart entry timer
  useEffect(() => {
    const t = getTank(selectedTankId);
    const list = state.readings
      .filter((r) => r.tankId === selectedTankId)
      .sort((a, b) => b.time - a.time);
    setUnit(t.gaugeUnit);
    setPctValue(list[0]?.pct ?? 50);
    setConfirmOutOfRange(null);
    entryStartRef.current = Date.now();
  }, [selectedTankId]);

  const currentFt = Number(((pctValue / 100) * selectedTank.heightFt).toFixed(2));
  const queuedReadings = state.readings
    .filter((r) => !r.synced)
    .sort((a, b) => b.time - a.time);

  const stepByPct = (deltaPct: number) => {
    setPctValue((prev) => Math.max(0, Math.min(100, Number((prev + deltaPct).toFixed(1)))));
    setConfirmOutOfRange(null);
  };

  const stepByFt = (deltaFt: number) => {
    const nextFt = Math.max(0, Math.min(selectedTank.heightFt, currentFt + deltaFt));
    const nextPct = (nextFt / selectedTank.heightFt) * 100;
    setPctValue(Math.max(0, Math.min(100, Number(nextPct.toFixed(1)))));
    setConfirmOutOfRange(null);
  };

  const commitSave = () => {
    const saveTime = Date.now();
    const elapsedSec = Math.max(1, Math.round((saveTime - entryStartRef.current) / 1000));
    const res = onSaveReading({
      tankId: selectedTankId,
      pct: Number(pctValue.toFixed(1)),
      time: saveTime,
      by: operatorLabel,
    });

    playDoubleBeep();
    triggerVibration();

    const formattedTime = new Date(saveTime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    setConfirmationMsg(
      `${res.synced ? 'Saved & Synced' : 'Queued Offline'}: ${selectedTank.name} at ${pctValue.toFixed(1)}% · ${formattedTime} · Entry took ${elapsedSec}s`
    );
    setConfirmOutOfRange(null);

    // Move to next tank not yet logged today
    const nextTank = TANKS.find(
      (t) => t.id !== selectedTankId && !loggedTodayMap[t.id]
    );
    if (nextTank) {
      setSelectedTankId(nextTank.id);
    } else {
      entryStartRef.current = Date.now();
    }
  };

  const handlePressSave = () => {
    const fc = forecast(state, selectedTankId, Date.now());
    const diff = Math.abs(pctValue - fc.currentPct);
    if (diff >= 15 && !confirmOutOfRange) {
      setConfirmOutOfRange({ expectedPct: fc.currentPct, diff: Number(diff.toFixed(1)) });
      return;
    }
    commitSave();
  };

  const timeFormatted = new Date(deviceTime).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex flex-col lg:flex-row items-start justify-center gap-6">
      {/* Phone-sized Field Panel */}
      <div className="w-full max-w-[440px] mx-auto lg:mx-0 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm">
        {/* Top Offline / Signal Header */}
        {!state.online && (
          <div role="alert" className="px-4 py-2.5 bg-amber-400 text-slate-950 font-display font-bold uppercase tracking-wide text-sm flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2">
              <WifiOff className="w-4 h-4" />
              <span>OFFLINE MODE — Readings queued on device</span>
            </span>
          </div>
        )}

        <div className="px-4 py-3 bg-[#0f2342] text-white flex items-center justify-between gap-2">
          <div>
            <div className="font-display text-lg font-bold uppercase tracking-wide">
              Field Tank Level Entry
            </div>
            <div className="text-xs text-slate-300">
              Signed in, stays signed in · {operatorLabel}
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleOnline}
            className={`px-2.5 py-1.5 rounded text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              state.online
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            }`}
          >
            {state.online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{state.online ? 'Simulate losing signal' : 'Reconnect signal'}</span>
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Interaction 1: 2x2 Tank Grid */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              1. Select Tank
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {TANKS.map((t) => {
                const isSelected = t.id === selectedTankId;
                const isDone = loggedTodayMap[t.id];
                const lastPct =
                  state.readings
                    .filter((r) => r.tankId === t.id)
                    .sort((a, b) => b.time - a.time)[0]?.pct ?? 0;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTankId(t.id)}
                    className={`min-h-[72px] p-3 rounded-md border-2 text-left flex flex-col justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#0f2342] dark:border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span className="font-display text-lg font-bold uppercase tracking-wide text-slate-900 dark:text-white">
                        {t.name}
                      </span>
                      {isDone && (
                        <span className="w-5 h-5 rounded-full bg-green-700 text-white flex items-center justify-center shrink-0" title="Logged today">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>{t.label}</span>
                      <span className="font-mono-num font-semibold">{lastPct}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interaction 2: Level Readout + % / Feet Toggle + Step Buttons */}
          <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                2. Set Level ({selectedTank.name})
              </span>
              <div className="inline-flex rounded-md border border-slate-300 dark:border-slate-700 overflow-hidden">
                {(['%', 'ft'] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={`px-3 py-1.5 text-xs font-bold cursor-pointer ${
                      unit === u
                        ? 'bg-[#0f2342] text-white'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {u === '%' ? '%' : 'Feet'}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-center py-2">
              <div className="font-mono-num text-5xl font-bold text-slate-900 dark:text-white tracking-tight">
                {unit === '%' ? `${pctValue.toFixed(1)}%` : `${currentFt.toFixed(1)} ft`}
              </div>
              <div className="mt-1 font-mono-num text-sm text-slate-600 dark:text-slate-400">
                {unit === '%'
                  ? `Equivalent: ${currentFt.toFixed(1)} ft · ${Math.round((pctValue / 100) * selectedTank.capacityGal).toLocaleString()} gal`
                  : `Equivalent: ${pctValue.toFixed(1)}% · ${Math.round((pctValue / 100) * selectedTank.capacityGal).toLocaleString()} gal`}
              </div>
            </div>

            {/* 4 Large Glove-Friendly Step Buttons */}
            <div className="grid grid-cols-4 gap-2">
              {unit === '%' ? (
                <>
                  <button
                    type="button"
                    onClick={() => stepByPct(-5)}
                    className="min-h-[56px] rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono-num text-base font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    -5%
                  </button>
                  <button
                    type="button"
                    onClick={() => stepByPct(-1)}
                    className="min-h-[56px] rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono-num text-base font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    -1%
                  </button>
                  <button
                    type="button"
                    onClick={() => stepByPct(1)}
                    className="min-h-[56px] rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono-num text-base font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    +1%
                  </button>
                  <button
                    type="button"
                    onClick={() => stepByPct(5)}
                    className="min-h-[56px] rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono-num text-base font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    +5%
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => stepByFt(-0.5)}
                    className="min-h-[56px] rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono-num text-sm font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    -0.5 ft
                  </button>
                  <button
                    type="button"
                    onClick={() => stepByFt(-0.1)}
                    className="min-h-[56px] rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono-num text-sm font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    -0.1 ft
                  </button>
                  <button
                    type="button"
                    onClick={() => stepByFt(0.1)}
                    className="min-h-[56px] rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono-num text-sm font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    +0.1 ft
                  </button>
                  <button
                    type="button"
                    onClick={() => stepByFt(0.5)}
                    className="min-h-[56px] rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono-num text-sm font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    +0.5 ft
                  </button>
                </>
              )}
            </div>

            <div className="text-center font-mono-num text-xs text-slate-500 dark:text-slate-400">
              Auto timestamp: Today, {timeFormatted}
            </div>
          </div>

          {/* Out-of-range confirmation */}
          {confirmOutOfRange && (
            <div role="alert" className="p-3.5 rounded-md bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 space-y-2 text-xs text-amber-950 dark:text-amber-200">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Reading differs by {confirmOutOfRange.diff} pts from forecast expected ({confirmOutOfRange.expectedPct}%).
                </span>
              </div>
              <p>Verify sight-gauge reading and tap Confirm Save below, or adjust level.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={commitSave}
                  className="px-3 py-2 rounded bg-amber-700 hover:bg-amber-800 text-white font-semibold cursor-pointer"
                >
                  Confirm & Save Anyway
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmOutOfRange(null)}
                  className="px-3 py-2 rounded border border-amber-400 text-amber-900 dark:text-amber-200 font-semibold cursor-pointer"
                >
                  Adjust Level
                </button>
              </div>
            </div>
          )}

          {/* Full-width >=86px Save Button */}
          <button
            type="button"
            onClick={handlePressSave}
            className="w-full min-h-[86px] rounded-md bg-green-700 hover:bg-green-800 active:bg-green-900 text-white font-display text-2xl font-bold uppercase tracking-wide shadow-sm transition-colors cursor-pointer"
          >
            {state.online ? 'SAVE READING' : 'SAVE READING (OFFLINE)'}
          </button>

          {confirmationMsg && (
            <div role="status" className="p-3 rounded-md bg-green-50 dark:bg-green-950/40 border border-green-300 dark:border-green-800 text-xs font-semibold text-green-900 dark:text-green-200">
              {confirmationMsg}
            </div>
          )}
        </div>
      </div>

      {/* Beside the phone: Today's Round Checklist & Offline Sync Queue */}
      <div className="w-full lg:flex-1 space-y-4">
        <section aria-label="Today's round checklist" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-slate-900 dark:text-white mb-3">
            Today's Round Checklist
          </h2>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
            {TANKS.map((t) => {
              const todayReadings = state.readings
                .filter((r) => r.tankId === t.id && r.source === 'field' && toDateStr(r.time) === todayStr)
                .sort((a, b) => b.time - a.time);
              const latestToday = todayReadings[0];
              return (
                <li key={t.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                        latestToday
                          ? 'bg-green-700 text-white'
                          : 'border border-slate-300 dark:border-slate-700 text-slate-400'
                      }`}
                    >
                      {latestToday ? <Check className="w-3.5 h-3.5" /> : ''}
                    </span>
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {t.name} ({t.label})
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {latestToday ? `Logged at ${formatShortDateTime(latestToday.time)}` : 'Pending field check'}
                      </div>
                    </div>
                  </div>
                  <div className="font-mono-num text-sm font-bold text-slate-900 dark:text-white">
                    {latestToday ? `${latestToday.pct}%` : '—'}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-label="Offline sync queue" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-display text-lg font-bold uppercase tracking-wide text-slate-900 dark:text-white">
              Readings Waiting to Sync
            </h2>
            <span className="font-mono-num text-xs font-semibold text-slate-500 dark:text-slate-400">
              {queuedReadings.length} queued
            </span>
          </div>

          {queuedReadings.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No queued offline readings. All field entries are synced with the office forecast ledger.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {queuedReadings.map((r) => (
                <li key={r.id} className="py-2 flex items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">{getTank(r.tankId).name}</span>
                    <span className="font-mono-num text-slate-600 dark:text-slate-300"> · {r.pct}%</span>
                    <div className="text-slate-500 dark:text-slate-400 font-mono-num">
                      {formatShortDateTime(r.time)} · {r.by}
                    </div>
                  </div>
                  <span className="font-semibold text-amber-700 dark:text-amber-400">▲ Queued</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};
