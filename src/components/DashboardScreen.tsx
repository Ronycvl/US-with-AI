import React, { useMemo, useState } from 'react';
import {
  ACTION_THRESHOLD_PCT,
  forecast,
  formatRelativeTime,
  formatShortDateTime,
  formatWindowLabel,
  getHauler,
  getTank,
  HaulRecord,
  MONTHLY_BUDGET,
  parseWindowRange,
  PlantState,
  RAIN_AMOUNT_INCHES,
  RAIN_EVENT_HOURS_AGO,
  TANKS,
} from '../lib/plantLogic';
import { StatusIndicator } from './StatusIndicator';
import { LiveHaulerBoard } from './LiveHaulerBoard';

interface DashboardScreenProps {
  state: PlantState;
  now: number;
  isCoordinator: boolean;
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
  onNavigateManifests: () => void;
}

const SightGaugeSvg: React.FC<{ pct: number; status: 'critical' | 'moderate' | 'normal' }> = ({ pct, status }) => {
  const clamped = Math.max(0, Math.min(100, pct));
  const fillColor =
    status === 'critical' ? '#dc2626' : status === 'moderate' ? '#d97706' : '#16a34a';
  const vesselHeight = 112;
  const fillH = (clamped / 100) * vesselHeight;
  const fillY = 12 + (vesselHeight - fillH);
  const thresholdY = 12 + vesselHeight * (1 - ACTION_THRESHOLD_PCT / 100);

  return (
    <svg viewBox="0 0 74 136" className="w-16 h-28 shrink-0" aria-label={`Tank sight gauge at ${clamped}%`}>
      {/* Scale ticks */}
      {[100, 80, 60, 40, 20, 0].map((tick) => {
        const y = 12 + vesselHeight * (1 - tick / 100);
        return (
          <g key={tick}>
            <line x1="8" y1={y} x2="14" y2={y} stroke="currentColor" strokeOpacity="0.4" strokeWidth="1" />
            <text
              x="6"
              y={y + 3}
              textAnchor="end"
              fontSize="7"
              fill="currentColor"
              opacity="0.55"
              className="font-mono-num"
            >
              {tick}
            </text>
          </g>
        );
      })}
      {/* Vessel shell */}
      <rect
        x="18"
        y="12"
        width="44"
        height={vesselHeight}
        rx="5"
        fill="currentColor"
        fillOpacity="0.06"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="1.5"
      />
      {/* Fluid fill */}
      <clipPath id={`clip-${status}-${Math.round(clamped)}`}>
        <rect x="19" y="13" width="42" height={vesselHeight - 2} rx="4" />
      </clipPath>
      <rect
        x="19"
        y={fillY}
        width="42"
        height={fillH}
        fill={fillColor}
        fillOpacity="0.82"
        clipPath={`url(#clip-${status}-${Math.round(clamped)})`}
      />
      {/* 80% threshold dashed line */}
      <line
        x1="15"
        y1={thresholdY}
        x2="66"
        y2={thresholdY}
        stroke="#dc2626"
        strokeWidth="1.5"
        strokeDasharray="3 2"
      />
    </svg>
  );
};

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  state,
  now,
  isCoordinator,
  signedInUserLabel,
  onOpenScheduler,
  onAdvanceStatus,
  onReportDelay,
  onCompletePickup,
  onNavigateManifests,
}) => {
  const [hoverDayOffset, setHoverDayOffset] = useState<number | null>(null);

  const forecasts = useMemo(() => {
    return TANKS.map((t) => ({
      tank: t,
      fc: forecast(state, t.id, now),
      activeHaul: state.hauls.find((h) => h.tankId === t.id && h.status !== 'Completed') ?? null,
    }));
  }, [state, now]);

  // Alert priority logic
  const urgentUnbooked = forecasts
    .filter((item) => !item.activeHaul && (item.fc.currentPct >= 80 || item.fc.hoursToFull <= 72))
    .sort((a, b) => a.fc.hoursToFull - b.fc.hoursToFull);

  const delayedOrTooLate = forecasts.filter((item) => {
    if (!item.activeHaul) return false;
    if (item.activeHaul.delayed) return true;
    const { endMs } = parseWindowRange(item.activeHaul.date, item.activeHaul.window);
    return endMs > item.fc.projectedFullTime - item.fc.confidenceMarginHours * 3600000;
  });

  const nextToFill = [...forecasts].sort((a, b) => a.fc.hoursToFull - b.fc.hoursToFull)[0];
  const pickupsInProgress = state.hauls.filter((h) => h.status !== 'Completed').length;
  const manifestsToReview = state.manifests.filter((m) => m.status === 'Awaiting Review').length;
  const queuedReadings = state.readings.filter((r) => !r.synced).length;

  // Monthly hauling spend
  const currentMonth = new Date(now).getMonth();
  const currentYear = new Date(now).getFullYear();
  const monthlySpend = state.hauls
    .filter((h) => {
      const refTime = h.completedAt ?? h.createdAt;
      const d = new Date(refTime);
      return h.status === 'Completed' && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((acc, h) => {
      const hauler = getHauler(h.haulerId);
      return acc + (h.actualGal ?? h.estGal) * hauler.ratePerGal;
    }, 0);
  const budgetPct = Math.min(100, Math.round((monthlySpend / MONTHLY_BUDGET) * 100));

  // Weather linkage computation
  const fastestTankItem = [...forecasts].sort((a, b) => b.fc.fillRatePctPerDay - a.fc.fillRatePctPerDay)[0];
  const allManualReadings = state.readings
    .filter((r) => r.synced && r.source === 'field')
    .sort((a, b) => b.time - a.time);
  const latestManual = allManualReadings[0];
  const withinOneDayTarget = forecasts.every((f) => f.fc.confidenceMarginHours <= 24);

  // Chart calculations (-4 days to +10 days)
  const chartMinDay = -4;
  const chartMaxDay = 10;
  const chartWidth = 880;
  const chartHeight = 280;
  const padL = 44;
  const padR = 26;
  const padT = 22;
  const padB = 34;
  const plotW = chartWidth - padL - padR;
  const plotH = chartHeight - padT - padB;

  const dayToX = (dayOffset: number) => padL + ((dayOffset - chartMinDay) / (chartMaxDay - chartMinDay)) * plotW;
  const pctToY = (pct: number) => padT + (1 - Math.max(0, Math.min(105, pct)) / 100) * plotH;

  const evalTankAtDay = (tankId: string, dayOffset: number): number | null => {
    const item = forecasts.find((f) => f.tank.id === tankId);
    if (!item) return null;
    if (dayOffset <= 0) {
      const tMs = now + dayOffset * 24 * 3600000;
      const pts = state.readings
        .filter((r) => r.tankId === tankId && r.synced && r.time >= now - 4 * 24 * 3600000)
        .sort((a, b) => a.time - b.time);
      if (pts.length === 0) return item.fc.currentPct;
      // Interpolate
      for (let i = 0; i < pts.length - 1; i++) {
        if (tMs >= pts[i].time && tMs <= pts[i + 1].time) {
          const span = pts[i + 1].time - pts[i].time;
          const frac = span > 0 ? (tMs - pts[i].time) / span : 0;
          return Number((pts[i].pct + frac * (pts[i + 1].pct - pts[i].pct)).toFixed(1));
        }
      }
      return tMs < pts[0].time ? pts[0].pct : item.fc.currentPct;
    }
    const proj = item.fc.currentPct + item.fc.fillRatePctPerDay * dayOffset;
    return Number(Math.min(100, proj).toFixed(1));
  };

  return (
    <div className="space-y-5">
      {/* Top Alert / Covered Banner */}
      {urgentUnbooked.length > 0 ? (
        <div
          role="alert"
          className="p-4 rounded-md bg-red-50 dark:bg-red-950/45 border border-red-300 dark:border-red-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5 text-red-900 dark:text-red-200">
            <span className="text-red-700 dark:text-red-400 font-bold mt-0.5" aria-hidden="true">
              ◆
            </span>
            <div className="text-sm font-medium">
              <span className="font-bold">ALERT:</span> {urgentUnbooked[0].tank.name} is at{' '}
              <span className="font-mono-num font-bold">{urgentUnbooked[0].fc.currentPct}%</span> (projected full in{' '}
              <span className="font-mono-num font-bold">
                {formatRelativeTime(urgentUnbooked[0].fc.projectedFullTime, now)}
              </span>
              ). Action recommended: schedule hauler.
            </div>
          </div>
          {isCoordinator && (
            <button
              type="button"
              onClick={() => onOpenScheduler(urgentUnbooked[0].tank.id)}
              className="px-4 py-2 text-xs font-semibold rounded bg-red-700 hover:bg-red-800 text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              Schedule Now
            </button>
          )}
        </div>
      ) : delayedOrTooLate.length > 0 ? (
        <div
          role="status"
          className="p-4 rounded-md bg-amber-50 dark:bg-amber-950/45 border border-amber-300 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5 text-amber-900 dark:text-amber-200 text-sm font-medium">
            <span className="font-bold" aria-hidden="true">
              ▲
            </span>
            <span>
              <span className="font-bold">DELAY / SCHEDULE RISK:</span> {delayedOrTooLate[0].tank.name} pickup is{' '}
              {delayedOrTooLate[0].activeHaul?.delayed ? 'marked Delayed' : 'finishing inside uncertainty margin'}. Review schedule.
            </span>
          </div>
          {isCoordinator && delayedOrTooLate[0].activeHaul && (
            <button
              type="button"
              onClick={() => onOpenScheduler(delayedOrTooLate[0].tank.id, delayedOrTooLate[0].activeHaul ?? undefined)}
              className="px-4 py-2 text-xs font-semibold rounded bg-amber-700 hover:bg-amber-800 text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              Reschedule Pickup
            </button>
          )}
        </div>
      ) : (
        <div
          role="status"
          className="p-3.5 rounded-md bg-green-50 dark:bg-green-950/40 border border-green-300 dark:border-green-800 flex items-center gap-2.5 text-green-900 dark:text-green-200 text-sm font-medium"
        >
          <span aria-hidden="true">●</span>
          <span>
            <span className="font-bold">Covered:</span> All tanks above threshold or within 72 hours have safe hauler pickups scheduled.
          </span>
        </div>
      )}

      {/* Row of 5 Summary Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Next Tank to Fill
          </div>
          <div className="mt-1 font-mono-num text-lg font-bold text-slate-900 dark:text-white">
            {nextToFill.tank.name} · {formatRelativeTime(nextToFill.fc.projectedFullTime, now)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {nextToFill.fc.currentPct}% ({nextToFill.tank.label})
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Pickups in Progress
          </div>
          <div className="mt-1 font-mono-num text-lg font-bold text-slate-900 dark:text-white">
            {pickupsInProgress}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Scheduled / En Route / On Site
          </div>
        </div>

        <button
          type="button"
          onClick={onNavigateManifests}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 rounded-md p-3.5 transition-colors cursor-pointer"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Manifests to Review
          </div>
          <div className="mt-1 font-mono-num text-lg font-bold text-slate-900 dark:text-white">
            {manifestsToReview}
          </div>
          <div className="text-xs text-blue-700 dark:text-blue-400 font-medium">
            {manifestsToReview > 0 ? 'Open awaiting review →' : 'All manifests archived'}
          </div>
        </button>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3.5">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <span>Monthly Spend</span>
            <span className="font-mono-num">{budgetPct}%</span>
          </div>
          <div className="mt-1 font-mono-num text-lg font-bold text-slate-900 dark:text-white">
            ${Math.round(monthlySpend).toLocaleString()} <span className="text-xs font-normal text-slate-500">/ ${MONTHLY_BUDGET.toLocaleString()}</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${budgetPct >= 90 ? 'bg-red-600' : budgetPct >= 75 ? 'bg-amber-600' : 'bg-[#0f2342] dark:bg-blue-500'}`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Field Reading Sync
          </div>
          <div className="mt-1 font-mono-num text-lg font-bold text-slate-900 dark:text-white">
            {queuedReadings === 0 ? 'All Synced' : `${queuedReadings} Queued`}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {state.online ? 'Connection live' : 'Offline mode active'}
          </div>
        </div>
      </div>

      {/* 4 Tank Cards */}
      <section aria-label="Tank levels and AI forecasts">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {forecasts.map(({ tank, fc, activeHaul }) => (
            <div
              key={tank.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="font-display text-lg font-bold uppercase tracking-wide text-slate-900 dark:text-white">
                      {tank.name} · {tank.label}
                    </h3>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                      {tank.capacityGal.toLocaleString()} gal · {tank.heightFt} ft ({tank.gaugeUnit})
                    </div>
                  </div>
                  <StatusIndicator status={fc.status} label={fc.statusWord} />
                </div>

                <div className="mt-3 flex items-center gap-4">
                  <SightGaugeSvg pct={fc.currentPct} status={fc.status} />

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="font-mono-num text-3xl font-bold text-slate-900 dark:text-white leading-none">
                      {fc.currentPct}%
                    </div>
                    <div className="text-xs font-mono-num text-slate-600 dark:text-slate-300 space-y-0.5">
                      <div>{fc.currentGal.toLocaleString()} gal · {fc.currentFt} ft</div>
                      <div>Fill rate: +{fc.fillRatePctPerDay}%/day</div>
                      <div className="text-slate-500 dark:text-slate-400 truncate">
                        Read {formatRelativeTime(fc.lastReadingTime, now)} · {fc.lastReadingBy}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">AI Projected Full</span>
                    <span className="font-mono-num font-bold text-slate-900 dark:text-white">
                      {formatRelativeTime(fc.projectedFullTime, now)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-slate-600 dark:text-slate-300 font-mono-num">
                    <span>{formatShortDateTime(fc.projectedFullTime)}</span>
                    <span>
                      {fc.confidenceLabel} (±{fc.confidenceMarginHours}h)
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                {activeHaul ? (
                  <div className="p-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{activeHaul.status}</span>
                      <span className="text-slate-500 dark:text-slate-400 font-mono-num">
                        {' '}· {activeHaul.date} {activeHaul.window}
                      </span>
                    </div>
                    {activeHaul.delayed && (
                      <span className="text-amber-700 dark:text-amber-400 font-semibold">▲ Delayed</span>
                    )}
                  </div>
                ) : isCoordinator ? (
                  <button
                    type="button"
                    onClick={() => onOpenScheduler(tank.id)}
                    className={`w-full py-2 px-3 text-xs font-semibold rounded transition-colors cursor-pointer ${
                      fc.status === 'critical'
                        ? 'bg-red-700 hover:bg-red-800 text-white'
                        : 'bg-[#0f2342] hover:bg-[#173461] text-white'
                    }`}
                  >
                    Schedule Pickup
                  </button>
                ) : (
                  <div className="text-xs text-slate-500 dark:text-slate-400 text-center py-1.5 border border-dashed border-slate-200 dark:border-slate-800 rounded">
                    No pickup booked
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Fill Forecast Line Chart */}
      <section aria-label="Fill forecast chart" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="font-display text-lg font-bold uppercase tracking-wide text-slate-900 dark:text-white">
              4-Day Measured & 10-Day AI Fill Forecast
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Solid lines show synced field readings (-4d to Now); dashed lines project recency-weighted fill to 100%.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            {TANKS.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: t.color, height: '3px' }} />
                <span>
                  {t.name} ({t.label})
                </span>
              </span>
            ))}
          </div>
        </div>

        <div className="relative overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full min-w-[600px] h-auto select-none"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const relX = ((e.clientX - rect.left) / rect.width) * chartWidth;
              const dOff = ((relX - padL) / plotW) * (chartMaxDay - chartMinDay) + chartMinDay;
              if (dOff >= chartMinDay && dOff <= chartMaxDay) {
                setHoverDayOffset(Number(dOff.toFixed(1)));
              } else {
                setHoverDayOffset(null);
              }
            }}
            onMouseLeave={() => setHoverDayOffset(null)}
          >
            {/* Horizontal grid lines */}
            {[0, 20, 40, 60, 80, 100].map((pct) => {
              const y = pctToY(pct);
              const isThresh = pct === 80;
              return (
                <g key={pct}>
                  <line
                    x1={padL}
                    y1={y}
                    x2={chartWidth - padR}
                    y2={y}
                    stroke={isThresh ? '#dc2626' : 'currentColor'}
                    strokeOpacity={isThresh ? 0.85 : 0.12}
                    strokeWidth={isThresh ? 1.5 : 1}
                    strokeDasharray={isThresh ? '5 4' : undefined}
                  />
                  <text
                    x={padL - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    fontSize="10"
                    fill={isThresh ? '#dc2626' : 'currentColor'}
                    opacity={isThresh ? 1 : 0.6}
                    className="font-mono-num"
                  >
                    {pct}%
                  </text>
                </g>
              );
            })}

            {/* Vertical day ticks */}
            {[-4, -2, 0, 2, 4, 6, 8, 10].map((d) => {
              const x = dayToX(d);
              const isNow = d === 0;
              return (
                <g key={d}>
                  <line
                    x1={x}
                    y1={padT}
                    x2={x}
                    y2={chartHeight - padB}
                    stroke={isNow ? '#0f2342' : 'currentColor'}
                    strokeOpacity={isNow ? 0.6 : 0.1}
                    strokeWidth={isNow ? 1.5 : 1}
                    strokeDasharray={isNow ? '3 3' : undefined}
                  />
                  <text
                    x={x}
                    y={chartHeight - 10}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight={isNow ? '700' : '400'}
                    fill="currentColor"
                    opacity={isNow ? 0.95 : 0.6}
                    className="font-mono-num"
                  >
                    {d === 0 ? 'Now' : d > 0 ? `+${d}d` : `${d}d`}
                  </text>
                </g>
              );
            })}

            {/* Tank measured solid + projected dashed paths */}
            {forecasts.map(({ tank, fc, activeHaul }) => {
              const historyPts = state.readings
                .filter((r) => r.tankId === tank.id && r.synced && r.time >= now - 4 * 24 * 3600000)
                .sort((a, b) => a.time - b.time)
                .map((r) => ({
                  x: dayToX((r.time - now) / (24 * 3600000)),
                  y: pctToY(r.pct),
                }));

              const solidD =
                historyPts.length > 0
                  ? historyPts.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
                    ` L${dayToX(0).toFixed(1)},${pctToY(fc.currentPct).toFixed(1)}`
                  : '';

              const fullDay = Math.min(chartMaxDay, fc.hoursToFull / 24);
              const endPct = Math.min(100, fc.currentPct + fc.fillRatePctPerDay * fullDay);
              const dashedD = `M${dayToX(0).toFixed(1)},${pctToY(fc.currentPct).toFixed(1)} L${dayToX(fullDay).toFixed(1)},${pctToY(endPct).toFixed(1)}`;

              // Booked pickup marker
              let pickupMarker: { x: number; y: number; label: string } | null = null;
              if (activeHaul) {
                const { startMs } = parseWindowRange(activeHaul.date, activeHaul.window);
                const dOff = (startMs - now) / (24 * 3600000);
                if (dOff >= 0 && dOff <= chartMaxDay) {
                  const pPct = Math.min(100, fc.currentPct + fc.fillRatePctPerDay * dOff);
                  pickupMarker = {
                    x: dayToX(dOff),
                    y: pctToY(pPct),
                    label: `${tank.name} Pickup`,
                  };
                }
              }

              return (
                <g key={tank.id}>
                  {solidD && <path d={solidD} fill="none" stroke={tank.color} strokeWidth="2.4" />}
                  <path d={dashedD} fill="none" stroke={tank.color} strokeWidth="2.2" strokeDasharray="6 4" />
                  {fc.hoursToFull / 24 <= chartMaxDay && (
                    <g>
                      <circle cx={dayToX(fullDay)} cy={pctToY(100)} r="3.5" fill={tank.color} />
                      <text
                        x={dayToX(fullDay)}
                        y={pctToY(100) - 7}
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight="600"
                        fill={tank.color}
                        className="font-mono-num"
                      >
                        {tank.name} 100%
                      </text>
                    </g>
                  )}
                  {pickupMarker && (
                    <g>
                      <rect
                        x={pickupMarker.x - 4.5}
                        y={pickupMarker.y - 4.5}
                        width="9"
                        height="9"
                        fill="#ffffff"
                        stroke={tank.color}
                        strokeWidth="2.2"
                      />
                      <text
                        x={pickupMarker.x + 8}
                        y={pickupMarker.y + 3}
                        fontSize="9"
                        fontWeight="600"
                        fill={tank.color}
                      >
                        {pickupMarker.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Hover crosshair */}
            {hoverDayOffset !== null && (
              <line
                x1={dayToX(hoverDayOffset)}
                y1={padT}
                x2={dayToX(hoverDayOffset)}
                y2={chartHeight - padB}
                stroke="currentColor"
                strokeOpacity="0.45"
                strokeWidth="1"
              />
            )}
          </svg>

          {/* Hover Tooltip */}
          {hoverDayOffset !== null && (
            <div className="mt-2 p-2.5 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-3 text-xs font-mono-num">
              <span className="font-semibold text-slate-900 dark:text-white">
                {hoverDayOffset === 0 ? 'Now' : hoverDayOffset > 0 ? `+${hoverDayOffset} days` : `${hoverDayOffset} days`} (
                {formatShortDateTime(now + hoverDayOffset * 24 * 3600000)})
              </span>
              <div className="flex flex-wrap items-center gap-4">
                {TANKS.map((t) => (
                  <span key={t.id} className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: t.color }} />
                    <span>
                      {t.name}: {evalTankAtDay(t.id, hoverDayOffset)}%
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Weather Linkage & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section aria-label="Recent plant status and weather linkage" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 space-y-3">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-slate-900 dark:text-white">
            Recent Plant Status & Weather Linkage
          </h2>
          <div className="space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
            <div className="p-3 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Rainfall Inflow Impact ({fastestTankItem.tank.name})
              </div>
              <div className="mt-1">
                {RAIN_AMOUNT_INCHES} in. rainfall {RAIN_EVENT_HOURS_AGO}h ago increased {fastestTankItem.tank.name} inflow from{' '}
                <span className="font-mono-num font-semibold">{fastestTankItem.fc.priorFillRatePctPerDay}%/day</span> to{' '}
                <span className="font-mono-num font-bold text-slate-900 dark:text-white">
                  {fastestTankItem.fc.fillRatePctPerDay}%/day
                </span>
                .
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Forecast Confidence Target
                </div>
                <div className="mt-1 font-mono-num font-semibold text-slate-900 dark:text-white">
                  {withinOneDayTarget ? 'Within ±1 day (±24h) target' : 'Above ±24h target on low-data tank'}
                </div>
              </div>
              <div className="p-3 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Latest Manual Field Reading
                </div>
                <div className="mt-1 font-mono-num font-semibold text-slate-900 dark:text-white">
                  {latestManual
                    ? `${getTank(latestManual.tankId).name} · ${latestManual.pct}% by ${latestManual.by} (${formatRelativeTime(latestManual.time, now)})`
                    : 'No field readings'}
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              How the forecast works: each tank fits a recency-weighted least-squares line (exponential 7-hour decay) over synced readings from the last 96 hours since the last pickup so sudden inflow spikes surface immediately.
            </p>
          </div>
        </section>

        <section aria-label="Plant activity feed" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 space-y-3">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-slate-900 dark:text-white">
            Activity Feed
          </h2>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800 max-h-60 overflow-y-auto">
            {state.activityLog.slice(0, 12).map((act) => (
              <li key={act.id} className="py-2.5 text-xs flex items-start justify-between gap-3">
                <div>
                  <div className="text-slate-800 dark:text-slate-200 font-medium">{act.text}</div>
                  <div className="text-slate-500 dark:text-slate-400 mt-0.5">{act.actor}</div>
                </div>
                <span className="font-mono-num text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
                  {formatRelativeTime(act.time, now)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Compact Live Hauler Status Board */}
      <LiveHaulerBoard
        state={state}
        now={now}
        compact={true}
        readOnly={!isCoordinator}
        signedInUserLabel={signedInUserLabel}
        onAdvanceStatus={onAdvanceStatus}
        onReportDelay={onReportDelay}
        onReschedule={(haul) => onOpenScheduler(haul.tankId, haul)}
        onCompletePickup={onCompletePickup}
      />
    </div>
  );
};
