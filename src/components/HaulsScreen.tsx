import React from 'react';
import {
  forecast,
  formatShortDateTime,
  formatWindowLabel,
  HaulRecord,
  PlantState,
  recommend,
  TANKS,
} from '../lib/plantLogic';
import { StatusIndicator } from './StatusIndicator';
import { LiveHaulerBoard } from './LiveHaulerBoard';

interface HaulsScreenProps {
  state: PlantState;
  now: number;
  readOnly: boolean;
  signedInUserLabel: string;
  onOpenScheduler: (tankId: string, rescheduleHaul?: HaulRecord) => void;
  onAdvanceStatus: (haulId: string) => void;
  onReportDelay: (haulId: string) => void;
  onCompletePickup: (payload: {
    haulId: string;
    actualGal: number;
    driverName: string;
    plantSignOff: string;
  }) => void;
}

export const HaulsScreen: React.FC<HaulsScreenProps> = ({
  state,
  now,
  readOnly,
  signedInUserLabel,
  onOpenScheduler,
  onAdvanceStatus,
  onReportDelay,
  onCompletePickup,
}) => {
  const unbookedTanks = TANKS.filter(
    (t) => !state.hauls.some((h) => h.tankId === t.id && h.status !== 'Completed')
  );

  return (
    <div className="space-y-6">
      {/* AI Pickup Suggestions Table */}
      <section aria-label="AI pickup suggestions" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold uppercase tracking-wide text-slate-900 dark:text-white">
              AI Pickup Suggestions (Unbooked Tanks)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              System evaluates notice periods, Sunday closures, loading-bay availability, and forecast uncertainty.
            </p>
          </div>
          {readOnly && (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Read-only view ({state.role === 'engineer' ? 'Engineer / Supt.' : 'Operator'})
            </span>
          )}
        </div>

        {unbookedTanks.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            All tanks currently have an active pickup scheduled or in progress.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  <th className="py-2.5 px-4 font-semibold">Tank</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Level</th>
                  <th className="py-2.5 px-4 font-semibold">Projected Full</th>
                  <th className="py-2.5 px-4 font-semibold">AI Suggested Window</th>
                  <th className="py-2.5 px-4 font-semibold">Recommended Hauler</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Margin</th>
                  {!readOnly && <th className="py-2.5 px-4 font-semibold text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {unbookedTanks.map((tank) => {
                  const fc = forecast(state, tank.id, now);
                  const rec = recommend(state, tank.id, now);
                  return (
                    <tr key={tank.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {tank.name} · {tank.label}
                        </div>
                        <div className="mt-0.5">
                          <StatusIndicator status={fc.status} label={fc.statusWord} />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num font-bold text-slate-900 dark:text-white">
                        {fc.currentPct}%
                        <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                          {fc.currentGal.toLocaleString()} gal
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono-num text-xs text-slate-700 dark:text-slate-300">
                        {formatShortDateTime(fc.projectedFullTime)}
                        <div className="text-slate-500 dark:text-slate-400">
                          {fc.confidenceLabel} (±{fc.confidenceMarginHours}h)
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono-num text-xs text-slate-900 dark:text-white">
                        {rec.primary ? (
                          <>
                            <div className="font-semibold">{rec.primary.date}</div>
                            <div className="text-slate-500 dark:text-slate-400">
                              {formatWindowLabel(rec.primary.window)} · {rec.primary.estGal.toLocaleString()} gal
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400">Manual schedule required</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300">
                        {rec.primary ? (
                          <>
                            <div className="font-medium text-slate-900 dark:text-white">{rec.primary.haulerName}</div>
                            <div className="font-mono-num text-slate-500 dark:text-slate-400">
                              Reg #{rec.primary.haulerReg} {rec.primary.isContract ? '· Contract' : ''}
                            </div>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num text-xs">
                        {rec.primary ? (
                          <span
                            className={
                              rec.primary.isSafe
                                ? 'font-semibold text-green-700 dark:text-green-400'
                                : 'font-semibold text-amber-700 dark:text-amber-400'
                            }
                          >
                            +{Math.round(rec.primary.marginBeforeFullHours)}h
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      {!readOnly && (
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => onOpenScheduler(tank.id)}
                            className="px-3 py-1.5 text-xs font-semibold rounded bg-[#0f2342] hover:bg-[#173461] text-white whitespace-nowrap cursor-pointer"
                          >
                            Review & Book
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <LiveHaulerBoard
        state={state}
        now={now}
        readOnly={readOnly}
        signedInUserLabel={signedInUserLabel}
        onAdvanceStatus={onAdvanceStatus}
        onReportDelay={onReportDelay}
        onReschedule={(haul) => onOpenScheduler(haul.tankId, haul)}
        onCompletePickup={onCompletePickup}
      />
    </div>
  );
};
