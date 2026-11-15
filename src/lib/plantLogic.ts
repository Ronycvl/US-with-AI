export type RoleId = 'coordinator' | 'operator' | 'engineer';
export type RouteId = 'dashboard' | 'log-level' | 'hauls' | 'manifests' | 'records';
export type GaugeUnit = '%' | 'ft';
export type PickupWindow = '06-09' | '09-12' | '12-15' | '15-18';
export type HaulStatus = 'Scheduled' | 'En Route' | 'On Site' | 'Completed';
export type TankStatus = 'critical' | 'moderate' | 'normal';
export type ConfidenceLabel = 'High' | 'Medium' | 'Low';

export interface TankSpec {
  id: string;
  name: string;
  label: string;
  capacityGal: number;
  heightFt: number;
  gaugeUnit: GaugeUnit;
  baselineRatePctPerDay: number;
  color: string;
}

export interface HaulerSpec {
  id: string;
  name: string;
  reg: string;
  isContract: boolean;
  noticeHours: number;
  truckCapGal: number;
  ratePerGal: number;
}

export interface Reading {
  id: string;
  tankId: string;
  time: number;
  pct: number;
  by: string;
  synced: boolean;
  source: 'field' | 'haul';
}

export interface HaulRecord {
  id: string;
  tankId: string;
  date: string; // YYYY-MM-DD
  window: PickupWindow;
  haulerId: string;
  estGal: number;
  status: HaulStatus;
  delayed: boolean;
  actualGal: number | null;
  driver: string | null;
  plantSignOff: string | null;
  completedAt: number | null;
  createdAt: number;
  aiAccepted: boolean;
}

export interface ManifestAuditEntry {
  time: number;
  by: string;
  field: string;
  oldValue: string;
  newValue: string;
}

export interface ManifestRecord {
  id: string;
  haulId: string;
  trackingNumber: string;
  tankId: string;
  pickupTime: number;
  actualGal: number;
  materialClass: string;
  haulerName: string;
  haulerReg: string;
  destination: string;
  permit: string;
  driverSig: string;
  plantSig: string;
  status: 'Awaiting Review' | 'Archived';
  archivedAt: number | null;
  archivedBy: string | null;
  retainUntil: number | null;
  auditTrail: ManifestAuditEntry[];
}

export interface ActivityEntry {
  id: string;
  time: number;
  text: string;
  actor: string;
  kind: 'reading' | 'haul' | 'manifest' | 'sync' | 'alert';
}

export interface UserProfile {
  gmail: string;
  dob: string;
  signedInAt: number;
  qrSource?: string;
}

export interface PlantState {
  version: number;
  seededAt: number;
  role: RoleId;
  online: boolean;
  readings: Reading[];
  hauls: HaulRecord[];
  manifests: ManifestRecord[];
  activityLog: ActivityEntry[];
}

export interface ForecastResult {
  tankId: string;
  currentPct: number;
  currentGal: number;
  currentFt: number;
  lastReadingTime: number;
  lastReadingBy: string;
  fillRatePctPerDay: number;
  priorFillRatePctPerDay: number;
  hoursToFull: number;
  projectedFullTime: number;
  crosses80Time: number;
  confidenceMarginHours: number;
  confidenceLabel: ConfidenceLabel;
  status: TankStatus;
  statusWord: string;
  lowData: boolean;
  sampleCount: number;
}

export interface RecommendationOption {
  haulerId: string;
  haulerName: string;
  haulerReg: string;
  isContract: boolean;
  date: string;
  window: PickupWindow;
  windowStartMs: number;
  windowEndMs: number;
  estGal: number;
  estimatedCost: number;
  leadTimeHours: number;
  marginBeforeFullHours: number;
  isSafe: boolean;
  isTight: boolean;
}

export interface RecommendationResult {
  tankId: string;
  primary: RecommendationOption | null;
  alternatives: RecommendationOption[];
  reasons: string[];
  expectedGalAtPickup: number;
}

export interface BookingVerdict {
  level: 'green' | 'amber' | 'red';
  headline: string;
  details: string[];
  marginHours: number;
  estimatedCost: number;
  isImpossible: boolean;
}

export interface ManifestValidation {
  valid: boolean;
  errors: string[];
  completedCount: number;
}

export const TANKS: TankSpec[] = [
  {
    id: 'tank-1',
    name: 'Tank 1',
    label: 'Primary',
    capacityGal: 9000,
    heightFt: 14,
    gaugeUnit: 'ft',
    baselineRatePctPerDay: 9.6,
    color: '#0072B2',
  },
  {
    id: 'tank-2',
    name: 'Tank 2',
    label: 'Digested',
    capacityGal: 7700,
    heightFt: 12,
    gaugeUnit: '%',
    baselineRatePctPerDay: 4.0,
    color: '#D55E00',
  },
  {
    id: 'tank-3',
    name: 'Tank 3',
    label: 'Secondary',
    capacityGal: 8500,
    heightFt: 14,
    gaugeUnit: 'ft',
    baselineRatePctPerDay: 9.75,
    color: '#009E73',
  },
  {
    id: 'tank-4',
    name: 'Tank 4',
    label: 'Holding',
    capacityGal: 7900,
    heightFt: 12,
    gaugeUnit: '%',
    baselineRatePctPerDay: 8.8,
    color: '#CC79A7',
  },
];

export const HAULERS: HaulerSpec[] = [
  {
    id: 'hauler-1',
    name: 'Lone Star Environmental Transport',
    reg: 'TX-48291',
    isContract: true,
    noticeHours: 18,
    truckCapGal: 6500,
    ratePerGal: 0.085,
  },
  {
    id: 'hauler-2',
    name: 'Gulf Coast Biosolids Hauling',
    reg: 'TX-51734',
    isContract: false,
    noticeHours: 24,
    truckCapGal: 6500,
    ratePerGal: 0.094,
  },
  {
    id: 'hauler-3',
    name: 'Sabine Vac & Tanker Services',
    reg: 'TX-39902',
    isContract: false,
    noticeHours: 12,
    truckCapGal: 5500,
    ratePerGal: 0.079,
  },
];

export const DESTINATION = {
  name: 'Jefferson County Landfill',
  permit: 'MSW-1982',
};

export const PICKUP_WINDOWS: PickupWindow[] = ['06-09', '09-12', '12-15', '15-18'];
export const ACTION_THRESHOLD_PCT = 80;
export const MONTHLY_BUDGET = 6000;
export const RAIN_EVENT_HOURS_AGO = 30;
export const RAIN_AMOUNT_INCHES = 1.2;

export function getTank(tankId: string): TankSpec {
  return TANKS.find((t) => t.id === tankId) ?? TANKS[0];
}

export function getHauler(haulerId: string): HaulerSpec {
  return HAULERS.find((h) => h.id === haulerId) ?? HAULERS[0];
}

export function toDateStr(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseWindowRange(dateStr: string, windowSlot: PickupWindow): { startMs: number; endMs: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [startH, endH] = windowSlot.split('-').map(Number);
  const start = new Date(y, (m || 1) - 1, d || 1, startH || 9, 0, 0, 0).getTime();
  const end = new Date(y, (m || 1) - 1, d || 1, endH || 12, 0, 0, 0).getTime();
  return { startMs: start, endMs: end };
}

export function formatWindowLabel(w: PickupWindow): string {
  const [s, e] = w.split('-');
  return `${s}:00–${e}:00`;
}

export function seedState(now: number = Date.now()): PlantState {
  const HOUR = 3600000;
  const DAY = 24 * HOUR;
  const readings: Reading[] = [];
  let rIdx = 1;

  // Tank 1: 42% latest (~1.5h ago), filling at ~9.6%/day (~0.4%/hr) -> ~6.0 days to full
  const t1Latest = now - 1.5 * HOUR;
  for (let step = 11; step >= 0; step--) {
    const time = t1Latest - step * 8 * HOUR;
    const pct = Math.max(4, Math.min(100, Number((42 - step * 8 * (9.6 / 24)).toFixed(1))));
    readings.push({
      id: `rd-${rIdx++}`,
      tankId: 'tank-1',
      time,
      pct,
      by: step % 2 === 0 ? 'Operator Maria' : 'Operator Jim',
      synced: true,
      source: 'field',
    });
  }

  // Tank 2: 84% latest (35m ago by Operator Jim).
  // Filled at ~4.0%/day prior to 30h ago (rain event), and ~8.35%/day since 30h ago -> ~46h to full.
  const t2Latest = now - (35 / 60) * HOUR;
  const rainTime = now - RAIN_EVENT_HOURS_AGO * HOUR;
  const rateBeforePerHr = 4.0 / 24;
  const rateAfterPerHr = 8.35 / 24;
  const pctAtRain = 84 - ((t2Latest - rainTime) / HOUR) * rateAfterPerHr;
  for (let step = 12; step >= 0; step--) {
    const time = t2Latest - step * 8 * HOUR;
    let pct: number;
    if (time >= rainTime) {
      pct = 84 - ((t2Latest - time) / HOUR) * rateAfterPerHr;
    } else {
      pct = pctAtRain - ((rainTime - time) / HOUR) * rateBeforePerHr;
    }
    readings.push({
      id: `rd-${rIdx++}`,
      tankId: 'tank-2',
      time,
      pct: Math.max(5, Number(pct.toFixed(1))),
      by: step === 0 ? 'Operator Jim' : step % 2 === 0 ? 'Operator Jim' : 'Operator Maria',
      synced: true,
      source: 'field',
    });
  }

  // Tank 3: 61% latest (~2h ago), filling at ~9.75%/day -> ~4.0 days to full
  const t3Latest = now - 2 * HOUR;
  for (let step = 11; step >= 0; step--) {
    const time = t3Latest - step * 8 * HOUR;
    const pct = Math.max(6, Number((61 - step * 8 * (9.75 / 24)).toFixed(1)));
    readings.push({
      id: `rd-${rIdx++}`,
      tankId: 'tank-3',
      time,
      pct,
      by: step % 2 === 0 ? 'Operator Jim' : 'Operator Carlos',
      synced: true,
      source: 'field',
    });
  }

  // Tank 4: Emptied 60 hours ago (6,480 gal hauled), latest reading 25% (~1h ago).
  // Filling at ~8.8%/day since empty (~3.3% post-haul) -> ~8.5 days to full.
  const t4HaulTime = now - 60 * HOUR;
  const t4Latest = now - 1 * HOUR;
  const t4RatePerHr = 8.8 / 24;
  // Add pre-haul reading and post-haul drop reading
  readings.push({
    id: `rd-${rIdx++}`,
    tankId: 'tank-4',
    time: t4HaulTime - 4 * HOUR,
    pct: 84.5,
    by: 'Operator Maria',
    synced: true,
    source: 'field',
  });
  readings.push({
    id: `rd-${rIdx++}`,
    tankId: 'tank-4',
    time: t4HaulTime + 5 * 60000,
    pct: Number((25 - ((t4Latest - t4HaulTime) / HOUR) * t4RatePerHr).toFixed(1)),
    by: 'System (Post-Haul)',
    synced: true,
    source: 'haul',
  });
  for (let step = 7; step >= 0; step--) {
    const time = t4Latest - step * 8 * HOUR;
    if (time > t4HaulTime + 10 * 60000) {
      const pct = Math.max(2, Number((25 - ((t4Latest - time) / HOUR) * t4RatePerHr).toFixed(1)));
      readings.push({
        id: `rd-${rIdx++}`,
        tankId: 'tank-4',
        time,
        pct,
        by: step % 2 === 0 ? 'Operator Maria' : 'Operator Jim',
        synced: true,
        source: 'field',
      });
    }
  }

  const hauls: HaulRecord[] = [];
  const manifests: ManifestRecord[] = [];

  // Tank 4 recent completed pickup (60h ago, 6,480 gal), manifest awaiting review
  const t4DateStr = toDateStr(t4HaulTime);
  const t4ManifestNum = `TX-MNF-${t4DateStr.slice(0, 4)}-${t4DateStr.slice(5, 7)}${t4DateStr.slice(8, 10)}-01`;
  const t4HaulId = 'haul-t4-pending';
  hauls.push({
    id: t4HaulId,
    tankId: 'tank-4',
    date: t4DateStr,
    window: '09-12',
    haulerId: 'hauler-1',
    estGal: 6500,
    status: 'Completed',
    delayed: false,
    actualGal: 6480,
    driver: 'R. Alvarez',
    plantSignOff: 'S. Mercer (Coordinator)',
    completedAt: t4HaulTime,
    createdAt: t4HaulTime - 24 * HOUR,
    aiAccepted: true,
  });

  manifests.push({
    id: 'mnf-t4-pending',
    haulId: t4HaulId,
    trackingNumber: t4ManifestNum,
    tankId: 'tank-4',
    pickupTime: t4HaulTime,
    actualGal: 6480,
    materialClass: 'Class B Biosolids',
    haulerName: HAULERS[0].name,
    haulerReg: HAULERS[0].reg,
    destination: DESTINATION.name,
    permit: DESTINATION.permit,
    driverSig: 'R. Alvarez',
    plantSig: 'S. Mercer',
    status: 'Awaiting Review',
    archivedAt: null,
    archivedBy: null,
    retainUntil: null,
    auditTrail: [],
  });

  // Tank 3 already has a pickup booked (~2 days ahead, non-Sunday)
  let t3BookMs = now + 2 * DAY;
  if (new Date(t3BookMs).getDay() === 0) {
    t3BookMs += DAY;
  }
  hauls.push({
    id: 'haul-t3-booked',
    tankId: 'tank-3',
    date: toDateStr(t3BookMs),
    window: '09-12',
    haulerId: 'hauler-1',
    estGal: 6000,
    status: 'Scheduled',
    delayed: false,
    actualGal: null,
    driver: null,
    plantSignOff: null,
    completedAt: null,
    createdAt: now - 5 * HOUR,
    aiAccepted: true,
  });

  // 12 older completed pickups with archived manifests spread over the last 70 days
  const historyOffsetsDays = [68, 62, 56, 50, 44, 38, 32, 26, 20, 15, 9, 5];
  const drivers = ['R. Alvarez', 'D. Kowalski', 'T. Nguyen', 'M. Brooks'];
  const tanksCycle = ['tank-1', 'tank-2', 'tank-3', 'tank-4'];
  const haulersCycle = ['hauler-1', 'hauler-1', 'hauler-3', 'hauler-2', 'hauler-1', 'hauler-1'];
  const volumes = [6200, 6400, 5200, 6100, 6350, 5900, 5400, 6450, 6000, 5300, 6250, 6400];

  historyOffsetsDays.forEach((daysAgo, idx) => {
    const pTime = now - daysAgo * DAY;
    const dStr = toDateStr(pTime);
    const tankId = tanksCycle[idx % tanksCycle.length];
    const haulerId = haulersCycle[idx % haulersCycle.length];
    const hauler = getHauler(haulerId);
    const actualGal = volumes[idx];
    const driver = drivers[idx % drivers.length];
    const seq = String(idx + 1).padStart(2, '0');
    const haulId = `haul-hist-${idx + 1}`;
    const archivedAt = pTime + 3 * HOUR;
    const retainDate = new Date(archivedAt);
    retainDate.setFullYear(retainDate.getFullYear() + 3);

    hauls.push({
      id: haulId,
      tankId,
      date: dStr,
      window: idx % 2 === 0 ? '09-12' : '12-15',
      haulerId,
      estGal: Math.floor(actualGal / 500) * 500,
      status: 'Completed',
      delayed: false,
      actualGal,
      driver,
      plantSignOff: 'E. Vance (Env. Engineer)',
      completedAt: pTime,
      createdAt: pTime - 28 * HOUR,
      aiAccepted: idx % 3 !== 0,
    });

    manifests.push({
      id: `mnf-hist-${idx + 1}`,
      haulId,
      trackingNumber: `TX-MNF-${dStr.slice(0, 4)}-${dStr.slice(5, 7)}${dStr.slice(8, 10)}-${seq}`,
      tankId,
      pickupTime: pTime,
      actualGal,
      materialClass: 'Class B Biosolids',
      haulerName: hauler.name,
      haulerReg: hauler.reg,
      destination: DESTINATION.name,
      permit: DESTINATION.permit,
      driverSig: driver,
      plantSig: 'E. Vance',
      status: 'Archived',
      archivedAt,
      archivedBy: 'E. Vance (Env. Engineer)',
      retainUntil: retainDate.getTime(),
      auditTrail: [],
    });
  });

  const activityLog: ActivityEntry[] = [
    {
      id: 'act-1',
      time: t2Latest,
      text: 'Tank 2 logged at 84% (6,468 gal) — threshold met',
      actor: 'Operator Jim',
      kind: 'alert',
    },
    {
      id: 'act-2',
      time: t4Latest,
      text: 'Tank 4 logged at 25% (1,975 gal)',
      actor: 'Operator Maria',
      kind: 'reading',
    },
    {
      id: 'act-3',
      time: t1Latest,
      text: 'Tank 1 logged at 42% (3,780 gal)',
      actor: 'Operator Maria',
      kind: 'reading',
    },
    {
      id: 'act-4',
      time: now - 5 * HOUR,
      text: `Booked Lone Star (${HAULERS[0].reg}) for Tank 3 · ${toDateStr(t3BookMs)} 09:00–12:00`,
      actor: 'Coordinator',
      kind: 'haul',
    },
    {
      id: 'act-5',
      time: t4HaulTime,
      text: `Tank 4 haul completed (6,480 gal); manifest ${t4ManifestNum} awaiting review`,
      actor: 'R. Alvarez',
      kind: 'manifest',
    },
  ];

  return {
    version: 1,
    seededAt: now,
    role: 'coordinator',
    online: true,
    readings,
    hauls,
    manifests,
    activityLog,
  };
}

function fitWeightedLinear(points: Array<{ xHours: number; y: number; w: number }>): { slopePerHour: number; intercept: number; rmse: number } {
  let sumW = 0;
  let sumWX = 0;
  let sumWY = 0;
  for (const p of points) {
    sumW += p.w;
    sumWX += p.w * p.xHours;
    sumWY += p.w * p.y;
  }
  const meanX = sumWX / sumW;
  const meanY = sumWY / sumW;

  let num = 0;
  let den = 0;
  for (const p of points) {
    const dx = p.xHours - meanX;
    const dy = p.y - meanY;
    num += p.w * dx * dy;
    den += p.w * dx * dx;
  }
  const slopePerHour = den > 1e-9 ? num / den : 0;
  const intercept = meanY - slopePerHour * meanX;

  let sqErr = 0;
  for (const p of points) {
    const pred = intercept + slopePerHour * p.xHours;
    const err = p.y - pred;
    sqErr += p.w * err * err;
  }
  const rmse = sumW > 0 ? Math.sqrt(sqErr / sumW) : 0;
  return { slopePerHour, intercept, rmse };
}

export function forecast(state: PlantState, tankId: string, now: number = Date.now()): ForecastResult {
  const tank = getTank(tankId);
  const completedHauls = state.hauls
    .filter((h) => h.tankId === tankId && h.status === 'Completed' && h.completedAt !== null)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  const lastPickupTime = completedHauls.length > 0 ? (completedHauls[0].completedAt ?? 0) : 0;

  const cutoff96 = now - 96 * 3600000;
  const validReadings = state.readings
    .filter((r) => r.tankId === tankId && r.synced && r.time >= Math.max(cutoff96, lastPickupTime))
    .sort((a, b) => a.time - b.time);

  // Fallback latest synced reading even if older than 96h
  const allSynced = state.readings
    .filter((r) => r.tankId === tankId && r.synced)
    .sort((a, b) => a.time - b.time);
  const latestReading = validReadings[validReadings.length - 1] ?? allSynced[allSynced.length - 1];

  const currentPct = latestReading ? latestReading.pct : 0;
  const lastReadingTime = latestReading ? latestReading.time : now;
  const lastReadingBy = latestReading ? latestReading.by : '—';
  const ageLatestHours = Math.max(0, (now - lastReadingTime) / 3600000);

  // Prior fill rate before last 36 hours (for weather comparison)
  const cutoff36 = now - 36 * 3600000;
  const priorReadings = validReadings.filter((r) => r.time <= cutoff36);
  let priorFillRatePctPerDay = tank.baselineRatePctPerDay;
  if (priorReadings.length >= 2) {
    const priorPts = priorReadings.map((r) => ({
      xHours: (r.time - now) / 3600000,
      y: r.pct,
      w: 1,
    }));
    const priorFit = fitWeightedLinear(priorPts);
    if (priorFit.slopePerHour > 0) {
      priorFillRatePctPerDay = Number((priorFit.slopePerHour * 24).toFixed(1));
    }
  }

  let slopePerHour = tank.baselineRatePctPerDay / 24;
  let rmse = 0.6;
  let lowData = false;

  if (validReadings.length >= 3) {
    const pts = validReadings.map((r) => {
      const ageHours = Math.max(0, (now - r.time) / 3600000);
      return {
        xHours: (r.time - now) / 3600000,
        y: r.pct,
        w: Math.exp(-ageHours / 7),
      };
    });
    const fit = fitWeightedLinear(pts);
    if (fit.slopePerHour > 0.01) {
      slopePerHour = fit.slopePerHour;
      rmse = fit.rmse;
    } else {
      lowData = true;
    }
  } else {
    lowData = true;
  }

  const fillRatePctPerDay = Number((slopePerHour * 24).toFixed(1));
  const remainingPct = Math.max(0, 100 - currentPct);
  const hoursToFull = slopePerHour > 0 ? remainingPct / slopePerHour : 999;
  const projectedFullTime = now + hoursToFull * 3600000;

  let crosses80Time = now;
  if (currentPct >= 80) {
    crosses80Time = lastReadingTime;
  } else {
    const hoursTo80 = (80 - currentPct) / slopePerHour;
    crosses80Time = now + hoursTo80 * 3600000;
  }

  // Confidence margin in hours from fit error, reading age, and sample count
  const fitErrorHours = Math.min(18, (rmse / Math.max(0.05, slopePerHour)) * 2.2);
  const agePenaltyHours = ageLatestHours * 0.75;
  const countPenaltyHours = Math.max(0, 8 - validReadings.length) * 1.4;
  const lowDataPenalty = lowData ? 14 : 0;
  const rawMargin = 4.2 + fitErrorHours + agePenaltyHours + countPenaltyHours + lowDataPenalty;
  const confidenceMarginHours = Math.round(Math.max(4, Math.min(36, rawMargin)));

  let confidenceLabel: ConfidenceLabel = 'Low';
  if (confidenceMarginHours <= 12) {
    confidenceLabel = 'High';
  } else if (confidenceMarginHours <= 24) {
    confidenceLabel = 'Medium';
  }

  let status: TankStatus = 'normal';
  let statusWord = 'Normal';
  if (currentPct >= ACTION_THRESHOLD_PCT) {
    status = 'critical';
    statusWord = 'Threshold met';
  } else if (currentPct >= 60) {
    status = 'moderate';
    statusWord = 'Moderate';
  }

  return {
    tankId,
    currentPct: Number(currentPct.toFixed(1)),
    currentGal: Math.round((currentPct / 100) * tank.capacityGal),
    currentFt: Number(((currentPct / 100) * tank.heightFt).toFixed(1)),
    lastReadingTime,
    lastReadingBy,
    fillRatePctPerDay,
    priorFillRatePctPerDay,
    hoursToFull: Number(hoursToFull.toFixed(1)),
    projectedFullTime,
    crosses80Time,
    confidenceMarginHours,
    confidenceLabel,
    status,
    statusWord,
    lowData,
    sampleCount: validReadings.length,
  };
}

export function recommend(state: PlantState, tankId: string, now: number = Date.now()): RecommendationResult {
  const tank = getTank(tankId);
  const fc = forecast(state, tankId, now);
  const activeHauls = state.hauls.filter((h) => h.status !== 'Completed');

  const safeDeadline = fc.projectedFullTime - fc.confidenceMarginHours * 3600000;
  const minThresholdStart = fc.currentPct < 70 ? fc.crosses80Time : now;

  const candidates: RecommendationOption[] = [];

  for (let dOffset = 0; dOffset <= 14; dOffset++) {
    const dayDate = new Date(now + dOffset * 24 * 3600000);
    if (dayDate.getDay() === 0) continue; // skip Sundays
    const dateStr = toDateStr(dayDate.getTime());

    for (const w of PICKUP_WINDOWS) {
      const { startMs, endMs } = parseWindowRange(dateStr, w);
      if (startMs <= now) continue;

      // Loading bay clash check
      const clash = activeHauls.some((h) => h.date === dateStr && h.window === w);
      if (clash) continue;

      for (const hauler of HAULERS) {
        const leadTimeHours = (startMs - now) / 3600000;
        if (leadTimeHours < hauler.noticeHours) continue;

        if (fc.currentPct < 70 && startMs < minThresholdStart) continue;

        const isSafe = endMs <= safeDeadline;
        const marginBeforeFullHours = (fc.projectedFullTime - endMs) / 3600000;

        // Expected gallons at pickup midpoint
        const hoursUntilWindow = Math.max(0, ((startMs + endMs) / 2 - now) / 3600000);
        const expectedPct = Math.min(100, fc.currentPct + (fc.fillRatePctPerDay / 24) * hoursUntilWindow);
        const expectedGalAtWindow = Math.round((expectedPct / 100) * tank.capacityGal);
        const cappedGal = Math.min(expectedGalAtWindow, hauler.truckCapGal);
        const estGal = Math.max(1000, Math.floor(cappedGal / 500) * 500);

        candidates.push({
          haulerId: hauler.id,
          haulerName: hauler.name,
          haulerReg: hauler.reg,
          isContract: hauler.isContract,
          date: dateStr,
          window: w,
          windowStartMs: startMs,
          windowEndMs: endMs,
          estGal,
          estimatedCost: Number((estGal * hauler.ratePerGal).toFixed(2)),
          leadTimeHours: Number(leadTimeHours.toFixed(1)),
          marginBeforeFullHours: Number(marginBeforeFullHours.toFixed(1)),
          isSafe,
          isTight: !isSafe,
        });
      }
    }
  }

  // Sort: Safe first, then contract hauler, then earliest day, then 09-12 window preference, then earliest window
  candidates.sort((a, b) => {
    if (a.isSafe !== b.isSafe) return a.isSafe ? -1 : 1;
    if (a.isContract !== b.isContract) return a.isContract ? -1 : 1;
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const aPref = a.window === '09-12' ? 0 : 1;
    const bPref = b.window === '09-12' ? 0 : 1;
    if (aPref !== bPref) return aPref - bPref;
    return a.windowStartMs - b.windowStartMs;
  });

  const primary = candidates[0] ?? null;

  // Pick up to 3 diverse alternatives (different date/window/hauler)
  const alternatives: RecommendationOption[] = [];
  for (const c of candidates.slice(1)) {
    if (alternatives.length >= 3) break;
    const dup = alternatives.some((x) => x.date === c.date && x.window === c.window && x.haulerId === c.haulerId);
    if (!dup) alternatives.push(c);
  }

  const expectedGalAtPickup = primary
    ? Math.round(
        (Math.min(100, fc.currentPct + (fc.fillRatePctPerDay / 24) * Math.max(0, (primary.windowStartMs - now) / 3600000)) / 100) *
          tank.capacityGal
      )
    : fc.currentGal;

  const reasons: string[] = [];
  if (primary) {
    reasons.push(
      `Fill rate is ${fc.fillRatePctPerDay}%/day — projected full in ~${Math.round(fc.hoursToFull)}h (${fc.confidenceLabel} confidence, ±${fc.confidenceMarginHours}h).`
    );
    reasons.push(
      primary.isSafe
        ? `Window finishes ${Math.round(primary.marginBeforeFullHours)}h before projected full (outside ±${fc.confidenceMarginHours}h uncertainty).`
        : `Tight schedule: window finishes ${Math.round(primary.marginBeforeFullHours)}h before projected full.`
    );
    const hauler = getHauler(primary.haulerId);
    reasons.push(
      hauler.isContract
        ? `${hauler.name} holds the municipal contract ($${hauler.ratePerGal.toFixed(3)}/gal, ${hauler.noticeHours}h notice met).`
        : `${hauler.name} meets ${hauler.noticeHours}h notice requirement ($${hauler.ratePerGal.toFixed(3)}/gal).`
    );
    reasons.push(
      `Expected ~${expectedGalAtPickup.toLocaleString()} gal in tank vs ${hauler.truckCapGal.toLocaleString()} gal truck capacity (suggested ${primary.estGal.toLocaleString()} gal).`
    );
  }

  return {
    tankId,
    primary,
    alternatives,
    reasons,
    expectedGalAtPickup,
  };
}

export function evaluateBooking(
  state: PlantState,
  tankId: string,
  haulerId: string,
  dateStr: string,
  windowSlot: PickupWindow,
  estGal: number,
  now: number = Date.now(),
  excludeHaulId?: string
): BookingVerdict {
  const hauler = getHauler(haulerId);
  const fc = forecast(state, tankId, now);
  const estimatedCost = Number((Math.max(0, estGal) * hauler.ratePerGal).toFixed(2));

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return {
      level: 'red',
      headline: 'Invalid pickup date',
      details: ['Select a valid pickup date to continue.'],
      marginHours: 0,
      estimatedCost,
      isImpossible: true,
    };
  }

  const { startMs, endMs } = parseWindowRange(dateStr, windowSlot);
  const dayOfWeek = new Date(startMs).getDay();
  const marginHours = Number(((fc.projectedFullTime - endMs) / 3600000).toFixed(1));
  const leadHours = (startMs - now) / 3600000;
  const bayClash = state.hauls.some(
    (h) => h.id !== excludeHaulId && h.status !== 'Completed' && h.date === dateStr && h.window === windowSlot
  );

  const redReasons: string[] = [];
  const amberReasons: string[] = [];

  if (endMs <= now) {
    redReasons.push('Selected pickup window is in the past.');
  }
  if (dayOfWeek === 0) {
    redReasons.push('Facility and landfill do not accept Sunday pickups.');
  }
  if (endMs > fc.projectedFullTime) {
    redReasons.push(`Window ends ${Math.abs(Math.round(marginHours))}h AFTER projected tank full time.`);
  }

  if (leadHours > 0 && leadHours < hauler.noticeHours) {
    amberReasons.push(`Short notice: ${Math.round(leadHours)}h lead time is under ${hauler.name}'s ${hauler.noticeHours}h minimum.`);
  }
  if (bayClash) {
    amberReasons.push('Loading-bay clash: another tank pickup is already booked in this window.');
  }
  if (marginHours >= 0 && marginHours < fc.confidenceMarginHours) {
    amberReasons.push(`Tight margin (${Math.round(marginHours)}h) is inside forecast uncertainty (±${fc.confidenceMarginHours}h).`);
  }
  if (estGal > hauler.truckCapGal) {
    amberReasons.push(`Volume (${estGal.toLocaleString()} gal) exceeds ${hauler.name} truck capacity (${hauler.truckCapGal.toLocaleString()} gal).`);
  }

  if (redReasons.length > 0) {
    return {
      level: 'red',
      headline: redReasons[0],
      details: [...redReasons, ...amberReasons],
      marginHours,
      estimatedCost,
      isImpossible: endMs <= now,
    };
  }

  if (amberReasons.length > 0) {
    return {
      level: 'amber',
      headline: amberReasons[0],
      details: amberReasons,
      marginHours,
      estimatedCost,
      isImpossible: false,
    };
  }

  return {
    level: 'green',
    headline: `Safe window — ${Math.round(marginHours)}h margin before projected full · Est. $${estimatedCost.toFixed(2)}`,
    details: [`Notice period (${hauler.noticeHours}h) satisfied, loading bay open, within truck capacity.`],
    marginHours,
    estimatedCost,
    isImpossible: false,
  };
}

export function validateManifest(manifest: ManifestRecord, tanks: TankSpec[] = TANKS): ManifestValidation {
  const errors: string[] = [];
  const tank = tanks.find((t) => t.id === manifest.tankId);
  let completedCount = 0;

  // 1. Tracking number
  if (/^TX-MNF-\d{4}-\d{4}-\d{2}$/.test(manifest.trackingNumber.trim())) {
    completedCount++;
  } else {
    errors.push('Manifest tracking # must follow TX-MNF-YYYY-MMDD-NN format.');
  }

  // 2. Pickup date & time
  if (manifest.pickupTime > 0 && !Number.isNaN(manifest.pickupTime)) {
    completedCount++;
  } else {
    errors.push('Pickup date and time is missing.');
  }

  // 3. Source tank & volume
  if (tank && manifest.actualGal > 0 && manifest.actualGal <= tank.capacityGal) {
    completedCount++;
  } else {
    errors.push(
      tank
        ? `Actual volume hauled (${manifest.actualGal} gal) must be > 0 and <= ${tank.capacityGal.toLocaleString()} gal tank capacity.`
        : 'Source tank is invalid.'
    );
  }

  // 4. Transporter name & registration TX-12345
  if (manifest.haulerName.trim().length > 0 && /^TX-\d{5}$/.test(manifest.haulerReg.trim())) {
    completedCount++;
  } else {
    errors.push('Transporter name and registration # (format TX-12345) are required.');
  }

  // 5. Destination & permit MSW-1234
  if (manifest.destination.trim().length > 0 && /^MSW-\d{4}$/.test(manifest.permit.trim())) {
    completedCount++;
  } else {
    errors.push('Destination facility and landfill permit (format MSW-1234) are required.');
  }

  // 6. Both driver & plant signatures present
  if (manifest.driverSig.trim().length > 0 && manifest.plantSig.trim().length > 0) {
    completedCount++;
  } else {
    errors.push('Both driver and plant electronic sign-offs are required.');
  }

  return {
    valid: errors.length === 0,
    errors,
    completedCount,
  };
}

export function formatRelativeTime(targetMs: number, now: number = Date.now()): string {
  const diffHours = (targetMs - now) / 3600000;
  if (Math.abs(diffHours) < 1) {
    const mins = Math.round(Math.abs(diffHours) * 60);
    return diffHours >= 0 ? `in ${mins}m` : `${mins}m ago`;
  }
  if (diffHours >= 0) {
    if (diffHours < 72) return `~${Math.round(diffHours)} hrs`;
    return `+${Math.round(diffHours / 24)} days`;
  }
  const absH = Math.abs(diffHours);
  if (absH < 48) return `${Math.round(absH)}h ago`;
  return `${Math.round(absH / 24)}d ago`;
}

export function formatShortDateTime(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
