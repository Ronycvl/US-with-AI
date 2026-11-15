import React, { useState } from 'react';
import { Copy, Check, AlertTriangle, RefreshCw, ArrowRight, CheckCircle2, X } from 'lucide-react';
import {
  DESTINATION,
  forecast,
  formatWindowLabel,
  getHauler,
  getTank,
  HaulRecord,
  HaulStatus,
  parseWindowRange,
  PlantState,
} from '../lib/plantLogic';

interface LiveHaulerBoardProps {
  state: PlantState;
  now: number;
  compact?: boolean;
  readOnly?: boolean;
  signedInUserLabel: string;
  onAdvanceStatus: (haulId: string) => void;
  onReportDelay: (haulId: string) => void;
  onReschedule: (haul: HaulRecord) => void;
  onCompletePickup: (payload: {
    haulId: string;
    actualGal: number;
    driverName: string;
    plantSignOff: string;
  }) => void;
}

const COLUMNS: HaulStatus[] = ['Scheduled', 'En Route', 'On Site', 'Completed'];

export const LiveHaulerBoard: React.FC<LiveHaulerBoardProps> = ({
  state,
  now,
  compact = false,
  readOnly = false,
  signedInUserLabel,
  onAdvanceStatus,
  onReportDelay,
  onReschedule,
  onCompletePickup,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [completingHaul, setCompletingHaul] = useState<HaulRecord | null>(null);
  const [actualGal, setActualGal] = useState<number>(6480);
  const [driverName, setDriverName] = useState<string>('R. Alvarez');
  const [plantSignOff, setPlantSignOff] = useState<string>(signedInUserLabel);

  const openCompleteModal = (h: HaulRecord) => {
    setCompletingHaul(h);
    setActualGal(h.estGal);
    setDriverName('R. Alvarez');
    setPlantSignOff(signedInUserLabel);
  };

  const handleCopyDispatch = async (h: HaulRecord) => {
    const hauler = getHauler(h.haulerId);
    const tank = getTank(h.tankId);
    const note = `DISPATCH: ${hauler.name} (${hauler.reg}) · ${h.date} ${formatWindowLabel(h.window)} · ${tank.name} (${h.estGal.toLocaleString()} gal) -> ${DESTINATION.name} (${DESTINATION.permit})`;
    try {
      await navigator.clipboard.writeText(note);
    } catch {
      // fallback silently
    }
    setCopiedId(h.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSubmitCompletion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingHaul) return;
    onCompletePickup({
      haulId: completingHaul.id,
      actualGal,
      driverName: driverName.trim() || 'R. Alvarez',
      plantSignOff: plantSignOff.trim() || signedInUserLabel,
    });
    setCompletingHaul(null);
  };

  return (
    <section aria-label="Live hauler status board" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold uppercase tracking-wide text-slate-900 dark:text-white">
          Live Hauler Status Board
        </h2>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
          {state.hauls.filter((h) => h.status !== 'Completed').length} active · {state.hauls.filter((h) => h.status === 'Completed').length} completed
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {COLUMNS.map((col) => {
          const items = state.hauls
            .filter((h) => h.status === col)
            .sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt));
          const visibleItems = compact && col === 'Completed' ? items.slice(0, 2) : items.slice(0, col === 'Completed' ? 5 : 10);

          return (
            <div
              key={col}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="font-display text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">
                  {col}
                </span>
                <span className="font-mono-num text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {items.length}
                </span>
              </div>

              {visibleItems.length === 0 ? (
                <div className="py-5 text-center text-xs text-slate-400 dark:text-slate-500">
                  No pickups {col.toLowerCase()}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {visibleItems.map((h) => {
                    const tank = getTank(h.tankId);
                    const hauler = getHauler(h.haulerId);
                    const fc = forecast(state, h.tankId, now);
                    const { endMs } = parseWindowRange(h.date, h.window);
                    const marginHours = (fc.projectedFullTime - endMs) / 3600000;
                    const tightFlag = h.status !== 'Completed' && marginHours < fc.confidenceMarginHours;

                    return (
                      <div
                        key={h.id}
                        className="p-2.5 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {tank.name} ({tank.label})
                            </div>
                            <div className="font-mono-num text-slate-600 dark:text-slate-300">
                              {(h.actualGal ?? h.estGal).toLocaleString()} gal · {h.date} · {h.window}
                            </div>
                          </div>
                          {h.delayed && (
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400 shrink-0">
                              <span aria-hidden="true">▲</span>
                              <span>Delayed</span>
                            </span>
                          )}
                        </div>

                        <div className="text-slate-600 dark:text-slate-400">
                          {hauler.name} <span className="font-mono-num">({hauler.reg})</span>
                        </div>

                        {tightFlag && (
                          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {marginHours < 0
                                ? `Finishes ${Math.abs(Math.round(marginHours))}h after projected full`
                                : `Tight margin (+${Math.round(marginHours)}h vs ±${fc.confidenceMarginHours}h)`}
                            </span>
                          </div>
                        )}

                        {!readOnly && h.status !== 'Completed' && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {h.status === 'On Site' ? (
                              <button
                                type="button"
                                onClick={() => openCompleteModal(h)}
                                className="px-2.5 py-1 rounded bg-green-700 hover:bg-green-800 text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Complete Pickup</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onAdvanceStatus(h.id)}
                                className="px-2.5 py-1 rounded bg-[#0f2342] hover:bg-[#173461] text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>
                                  Move to {h.status === 'Scheduled' ? 'En Route' : 'On Site'}
                                </span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => onReschedule(h)}
                              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium inline-flex items-center gap-1 cursor-pointer"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Reschedule</span>
                            </button>

                            {!h.delayed && (
                              <button
                                type="button"
                                onClick={() => onReportDelay(h.id)}
                                className="px-2 py-1 rounded border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 font-medium cursor-pointer"
                              >
                                Report delay
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleCopyDispatch(h)}
                              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
                            >
                              {copiedId === h.id ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedId === h.id ? 'Copied' : 'Copy dispatch'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 3-input Complete Pickup Modal */}
      {completingHaul && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60" role="dialog" aria-modal="true" aria-labelledby="complete-haul-title">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl overflow-hidden">
            <div className="px-5 py-3.5 bg-[#0f2342] text-white flex items-center justify-between">
              <h3 id="complete-haul-title" className="font-display text-lg font-bold uppercase tracking-wide">
                Complete Pickup · {getTank(completingHaul.tankId).name}
              </h3>
              <button
                type="button"
                onClick={() => setCompletingHaul(null)}
                aria-label="Close complete pickup dialog"
                className="p-1 rounded hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitCompletion} className="p-5 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Submitting lowers the tank level, restarts its forecast from the new level, and auto-generates the TCEQ / EPA disposal manifest.
              </p>

              <div>
                <label htmlFor="comp-gal" className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">
                  Actual Gallons Hauled
                </label>
                <input
                  id="comp-gal"
                  type="number"
                  min={100}
                  max={getTank(completingHaul.tankId).capacityGal}
                  required
                  value={actualGal}
                  onChange={(e) => setActualGal(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm font-mono-num rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label htmlFor="comp-driver" className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">
                  Driver Electronic Sign-Off
                </label>
                <input
                  id="comp-driver"
                  type="text"
                  required
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label htmlFor="comp-plant" className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">
                  Plant Sign-Off
                </label>
                <input
                  id="comp-plant"
                  type="text"
                  required
                  value={plantSignOff}
                  onChange={(e) => setPlantSignOff(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCompletingHaul(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-green-700 hover:bg-green-800 text-white cursor-pointer"
                >
                  Confirm Completion & Create Manifest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
