import React, { useEffect, useMemo, useState } from 'react';
import { X, Copy, Check, Sparkles } from 'lucide-react';
import {
  DESTINATION,
  evaluateBooking,
  forecast,
  formatShortDateTime,
  formatWindowLabel,
  getHauler,
  getTank,
  HAULERS,
  HaulRecord,
  PICKUP_WINDOWS,
  PickupWindow,
  PlantState,
  recommend,
  RecommendationOption,
} from '../lib/plantLogic';

interface SchedulerModalProps {
  isOpen: boolean;
  tankId: string;
  rescheduleHaul?: HaulRecord | null;
  state: PlantState;
  now: number;
  onClose: () => void;
  onConfirmBook: (payload: {
    tankId: string;
    haulerId: string;
    date: string;
    window: PickupWindow;
    estGal: number;
    aiAccepted: boolean;
    rescheduleHaulId?: string;
  }) => HaulRecord;
}

export const SchedulerModal: React.FC<SchedulerModalProps> = ({
  isOpen,
  tankId,
  rescheduleHaul,
  state,
  now,
  onClose,
  onConfirmBook,
}) => {
  const tank = getTank(tankId);
  const fc = useMemo(() => forecast(state, tankId, now), [state, tankId, now]);
  const rec = useMemo(() => recommend(state, tankId, now), [state, tankId, now]);

  const [date, setDate] = useState('');
  const [windowSlot, setWindowSlot] = useState<PickupWindow>('09-12');
  const [haulerId, setHaulerId] = useState(HAULERS[0].id);
  const [estGal, setEstGal] = useState(6000);
  const [bookedHaul, setBookedHaul] = useState<HaulRecord | null>(null);
  const [copiedNote, setCopiedNote] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setBookedHaul(null);
    setCopiedNote(false);
    if (rec.primary) {
      setDate(rec.primary.date);
      setWindowSlot(rec.primary.window);
      setHaulerId(rec.primary.haulerId);
      setEstGal(rec.primary.estGal);
    } else {
      const tomorrow = new Date(now + 24 * 3600000);
      setDate(tomorrow.toISOString().slice(0, 10));
      setWindowSlot('09-12');
      setHaulerId(HAULERS[0].id);
      setEstGal(6000);
    }
  }, [isOpen, tankId, rec, now]);

  const verdict = useMemo(
    () => evaluateBooking(state, tankId, haulerId, date, windowSlot, estGal, now, rescheduleHaul?.id),
    [state, tankId, haulerId, date, windowSlot, estGal, now, rescheduleHaul?.id]
  );

  if (!isOpen) return null;

  const applyOption = (opt: RecommendationOption) => {
    setDate(opt.date);
    setWindowSlot(opt.window);
    setHaulerId(opt.haulerId);
    setEstGal(opt.estGal);
  };

  const isAiAsSuggested = Boolean(
    rec.primary &&
      rec.primary.date === date &&
      rec.primary.window === windowSlot &&
      rec.primary.haulerId === haulerId &&
      rec.primary.estGal === estGal
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verdict.isImpossible) return;
    const saved = onConfirmBook({
      tankId,
      haulerId,
      date,
      window: windowSlot,
      estGal,
      aiAccepted: isAiAsSuggested,
      rescheduleHaulId: rescheduleHaul?.id,
    });
    setBookedHaul(saved);
  };

  const buildDispatchNote = (h: HaulRecord) => {
    const hauler = getHauler(h.haulerId);
    const t = getTank(h.tankId);
    return [
      `DISPATCH REQUEST — SLUDGE PICKUP`,
      `To: ${hauler.name} (${hauler.reg})`,
      `Pickup Date & Window: ${h.date} · ${formatWindowLabel(h.window)}`,
      `Source: ${t.name} (${t.label}) · Est. Volume: ${h.estGal.toLocaleString()} gal Class B Biosolids`,
      `Destination: ${DESTINATION.name} (Permit #${DESTINATION.permit})`,
      `Est. Cost: $${(h.estGal * hauler.ratePerGal).toFixed(2)}`,
      `Please confirm driver assignment and registration on arrival.`,
    ].join('\n');
  };

  const handleCopyDispatch = async () => {
    if (!bookedHaul) return;
    const note = buildDispatchNote(bookedHaul);
    try {
      await navigator.clipboard.writeText(note);
      setCopiedNote(true);
    } catch {
      setCopiedNote(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60" role="dialog" aria-modal="true" aria-labelledby="scheduler-modal-title">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="px-5 py-4 bg-[#0f2342] text-white flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 id="scheduler-modal-title" className="font-display text-xl font-bold uppercase tracking-wide">
              {rescheduleHaul ? 'Reschedule Pickup · AI-Assisted Scheduler' : 'AI-Assisted Hauler Pickup Scheduler'}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              System proposes optimal safe window; Coordinator reviews, modifies if needed, and confirms.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scheduler"
            className="p-1.5 rounded hover:bg-white/10 text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {bookedHaul ? (
            <div className="space-y-4">
              <div className="p-4 rounded-md bg-green-50 dark:bg-green-950/40 border border-green-300 dark:border-green-800">
                <div className="flex items-center gap-2 font-semibold text-green-800 dark:text-green-300 text-sm">
                  <Check className="w-5 h-5" />
                  <span>
                    Pickup Booked ({bookedHaul.aiAccepted ? 'AI Suggestion Accepted' : 'Coordinator Modified'})
                  </span>
                </div>
                <p className="text-xs text-green-800 dark:text-green-300 mt-1">
                  Saved to Live Hauler Status Board. Note: no external message was sent automatically — copy the prepared dispatch note below to send to the hauler.
                </p>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
                  Prepared Dispatch Note (Ready to Copy & Send)
                </div>
                <pre className="p-3.5 rounded-md bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono-num text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                  {buildDispatchNote(bookedHaul)}
                </pre>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCopyDispatch}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-[#0f2342] hover:bg-[#173461] text-white inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedNote ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedNote ? 'Copied Dispatch Note' : 'Copy Dispatch Note'}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Blue AI Recommendation Box */}
              <div className="p-4 rounded-md bg-blue-50 dark:bg-blue-950/35 border border-blue-200 dark:border-blue-900 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-blue-950 dark:text-blue-100 font-display text-base font-bold uppercase tracking-wide">
                    <Sparkles className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                    <span>
                      AI Recommendation · {tank.name} ({tank.label}) at {fc.currentPct}%
                    </span>
                  </div>
                  <span className="text-xs font-mono-num text-blue-900 dark:text-blue-300">
                    Projected full: {formatShortDateTime(fc.projectedFullTime)}
                  </span>
                </div>

                {rec.primary ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-sm">
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-blue-800/80 dark:text-blue-300/80 font-semibold">
                          Suggested Window
                        </div>
                        <div className="font-mono-num font-bold text-blue-950 dark:text-white">
                          {rec.primary.date} · {formatWindowLabel(rec.primary.window)}
                        </div>
                        <div className="text-xs text-blue-900 dark:text-blue-300 font-mono-num">
                          Lead time: {Math.round(rec.primary.leadTimeHours)}h
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-blue-800/80 dark:text-blue-300/80 font-semibold">
                          Recommended Hauler
                        </div>
                        <div className="font-semibold text-blue-950 dark:text-white leading-snug">
                          {rec.primary.haulerName}
                        </div>
                        <div className="text-xs text-blue-900 dark:text-blue-300 font-mono-num">
                          Reg #{rec.primary.haulerReg} {rec.primary.isContract ? '· Contract' : ''}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-blue-800/80 dark:text-blue-300/80 font-semibold">
                          Suggested Volume
                        </div>
                        <div className="font-mono-num font-bold text-blue-950 dark:text-white">
                          {rec.primary.estGal.toLocaleString()} gal
                        </div>
                        <div className="text-xs text-blue-900 dark:text-blue-300 font-mono-num">
                          Margin: +{Math.round(rec.primary.marginBeforeFullHours)}h before full
                        </div>
                      </div>
                    </div>

                    <ul className="space-y-1 text-xs text-blue-950 dark:text-blue-200 list-disc pl-4">
                      {rec.reasons.map((r, idx) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>

                    {rec.alternatives.length > 0 && (
                      <div className="pt-2 border-t border-blue-200/80 dark:border-blue-800/80">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-900 dark:text-blue-300 mb-1.5">
                          Alternative Safe Windows (One-Click Apply)
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {rec.alternatives.map((opt, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => applyOption(opt)}
                              className="px-2.5 py-1.5 text-xs font-mono-num rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 text-blue-950 dark:text-blue-100 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer whitespace-nowrap"
                            >
                              {opt.date} {opt.window} · {opt.haulerName.split(' ')[0]} ({opt.estGal.toLocaleString()} gal)
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-blue-950 dark:text-blue-200">
                    No open windows found in the next 14 days without a loading-bay clash. Adjust booking details manually below.
                  </p>
                )}
              </div>

              {/* Coordinator Editable Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="font-display text-base font-bold uppercase tracking-wide text-slate-900 dark:text-white">
                  Review & Modify Booking Details
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="sched-date" className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">
                      Pickup Date
                    </label>
                    <input
                      id="sched-date"
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono-num rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label htmlFor="sched-window" className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">
                      Time Window
                    </label>
                    <select
                      id="sched-window"
                      value={windowSlot}
                      onChange={(e) => setWindowSlot(e.target.value as PickupWindow)}
                      className="w-full px-3 py-2 text-sm font-mono-num rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    >
                      {PICKUP_WINDOWS.map((w) => (
                        <option key={w} value={w}>
                          {formatWindowLabel(w)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="sched-hauler" className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">
                      Preferred Contractor
                    </label>
                    <select
                      id="sched-hauler"
                      value={haulerId}
                      onChange={(e) => setHaulerId(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    >
                      {HAULERS.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.reg}) · ${h.ratePerGal.toFixed(3)}/gal · {h.truckCapGal} gal max
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="sched-volume" className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">
                      Estimated Volume to Empty (gal)
                    </label>
                    <input
                      id="sched-volume"
                      type="number"
                      min={500}
                      max={tank.capacityGal}
                      step={100}
                      required
                      value={estGal}
                      onChange={(e) => setEstGal(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 text-sm font-mono-num rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Live Verdict Line */}
                <div
                  role="status"
                  className={`p-3.5 rounded-md border text-xs space-y-1 ${
                    verdict.level === 'green'
                      ? 'bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-800 text-green-900 dark:text-green-200'
                      : verdict.level === 'amber'
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                      : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden="true">
                        {verdict.level === 'green' ? '●' : verdict.level === 'amber' ? '▲' : '◆'}
                      </span>
                      <span>{verdict.headline}</span>
                    </span>
                    <span className="font-mono-num shrink-0">
                      Est. Cost: ${verdict.estimatedCost.toFixed(2)}
                    </span>
                  </div>
                  {verdict.details.map((d, idx) => (
                    <div key={idx} className="opacity-90">
                      {d}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={verdict.isImpossible}
                    className="px-5 py-2.5 text-xs font-semibold rounded-md bg-green-700 hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed text-white cursor-pointer"
                  >
                    Confirm & Book
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
