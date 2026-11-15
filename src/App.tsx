import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Moon, Sun, RotateCcw, QrCode, Wifi, WifiOff, LogOut } from 'lucide-react';
import {
  DESTINATION,
  getHauler,
  getTank,
  HaulRecord,
  ManifestAuditEntry,
  ManifestRecord,
  PickupWindow,
  PlantState,
  RoleId,
  RouteId,
  seedState,
  toDateStr,
  UserProfile,
} from './lib/plantLogic';
import { OnboardingGate } from './components/OnboardingGate';
import { PackagingQrModal } from './components/PackagingQrModal';
import { DashboardScreen } from './components/DashboardScreen';
import { LogLevelScreen } from './components/LogLevelScreen';
import { HaulsScreen } from './components/HaulsScreen';
import { ManifestsScreen } from './components/ManifestsScreen';
import { RecordsScreen } from './components/RecordsScreen';
import { SchedulerModal } from './components/SchedulerModal';

const STATE_KEY = 'sdlt_plant_state_v1';
const USER_KEY = 'sdlt_user_profile_v1';
const THEME_KEY = 'sdlt_theme_v1';
const FORTY_EIGHT_HOURS_MS = 48 * 3600000;

function loadStoredState(now: number): PlantState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PlantState;
      if (parsed && parsed.seededAt && now - parsed.seededAt <= FORTY_EIGHT_HOURS_MS && Array.isArray(parsed.readings)) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return seedState(now);
}

function loadStoredUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as UserProfile;
      if (parsed && parsed.gmail && parsed.dob) return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

function parseHashRoute(): RouteId {
  if (typeof window === 'undefined') return 'dashboard';
  const h = window.location.hash.replace(/^#/, '');
  if (h === 'dashboard' || h === 'log-level' || h === 'hauls' || h === 'manifests' || h === 'records') {
    return h;
  }
  return 'dashboard';
}

function parseQrParams(): { isQrScan: boolean; sourceLabel: string; targetTankId?: string; targetRoute?: RouteId } {
  if (typeof window === 'undefined') {
    return { isQrScan: false, sourceLabel: '' };
  }
  const params = new URLSearchParams(window.location.search);
  const qr = params.get('qr');
  const tankParam = params.get('tank') ?? undefined;
  const viewParam = params.get('view') as RouteId | null;

  if (!qr) {
    return { isQrScan: false, sourceLabel: '' };
  }
  if (qr === 'vessel' && tankParam) {
    const t = getTank(tankParam);
    return {
      isQrScan: true,
      sourceLabel: `Physical Vessel Tag · ${t.name} (${t.label})`,
      targetTankId: t.id,
      targetRoute: viewParam ?? 'log-level',
    };
  }
  if (qr === 'manifest') {
    return {
      isQrScan: true,
      sourceLabel: 'Physical Disposal Packet · Manifest Review Tag',
      targetRoute: viewParam ?? 'manifests',
    };
  }
  return {
    isQrScan: true,
    sourceLabel: 'Physical Product Packaging · Facility Access Tag',
    targetRoute: viewParam ?? 'dashboard',
  };
}

export default function App() {
  const [now, setNow] = useState<number>(() => Date.now());
  const [state, setState] = useState<PlantState>(() => loadStoredState(Date.now()));
  const [user, setUser] = useState<UserProfile | null>(() => loadStoredUser());
  const [qrContext, setQrContext] = useState(() => parseQrParams());
  const [route, setRoute] = useState<RouteId>(() => {
    const initialHash = parseHashRoute();
    const qr = parseQrParams();
    if (qr.targetRoute) return qr.targetRoute;
    return initialHash;
  });
  const [dark, setDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark';
    } catch {
      return false;
    }
  });
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedManifestId, setSelectedManifestId] = useState<string | null>(null);
  const [schedulerState, setSchedulerState] = useState<{
    isOpen: boolean;
    tankId: string;
    rescheduleHaul?: HaulRecord | null;
  }>({ isOpen: false, tankId: 'tank-2', rescheduleHaul: null });

  // Sync dark class onto <html>
  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [dark]);

  // Persist PlantState to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  // Refresh clock every 60s
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  // Hash routing listener
  useEffect(() => {
    const onHashChange = () => {
      setRoute(parseHashRoute());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((nextRoute: RouteId) => {
    setRoute(nextRoute);
    if (window.location.hash !== `#${nextRoute}`) {
      window.location.hash = `#${nextRoute}`;
    }
  }, []);

  // Auto-sync queued readings when online
  const syncQueuedReadings = useCallback(() => {
    setState((prev) => {
      const queued = prev.readings.filter((r) => !r.synced);
      if (queued.length === 0) return prev;
      const syncedReadings = prev.readings.map((r) => (r.synced ? r : { ...r, synced: true }));
      const syncAct = {
        id: `act-sync-${Date.now()}`,
        time: Date.now(),
        text: `Auto-synced ${queued.length} queued offline field reading${queued.length > 1 ? 's' : ''}`,
        actor: 'Sync Engine',
        kind: 'sync' as const,
      };
      setSyncNotice(`Synced ${queued.length} queued offline reading${queued.length > 1 ? 's' : ''} to the plant dashboard.`);
      return {
        ...prev,
        online: true,
        readings: syncedReadings,
        activityLog: [syncAct, ...prev.activityLog],
      };
    });
  }, []);

  // Listen to browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setState((prev) => ({ ...prev, online: true }));
      syncQueuedReadings();
    };
    const handleOffline = () => {
      setState((prev) => ({ ...prev, online: false }));
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncQueuedReadings]);

  const handleToggleOnline = () => {
    if (state.online) {
      setState((prev) => ({ ...prev, online: false }));
      setSyncNotice(null);
    } else {
      setState((prev) => ({ ...prev, online: true }));
      syncQueuedReadings();
    }
  };

  // Role switching updates allowed tabs & lands appropriately
  const handleRoleSwitch = (nextRole: RoleId) => {
    setState((prev) => ({ ...prev, role: nextRole }));
    if (nextRole === 'operator') {
      navigate('log-level');
    } else {
      navigate('dashboard');
    }
  };

  const roleTabs = useMemo((): Array<{ id: RouteId; label: string; badge?: number }> => {
    const awaitingCount = state.manifests.filter((m) => m.status === 'Awaiting Review').length;
    if (state.role === 'operator') {
      return [
        { id: 'log-level', label: 'Log Level' },
        { id: 'dashboard', label: 'Dashboard (Read Only)' },
      ];
    }
    if (state.role === 'engineer') {
      return [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'hauls', label: 'Pickups (Read Only)' },
        { id: 'manifests', label: 'Manifests', badge: awaitingCount },
        { id: 'records', label: 'Records' },
      ];
    }
    return [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'hauls', label: 'Pickups' },
      { id: 'manifests', label: 'Manifests', badge: awaitingCount },
      { id: 'records', label: 'Records' },
    ];
  }, [state.role, state.manifests]);

  // Ensure active route is valid for current role
  useEffect(() => {
    if (!roleTabs.some((t) => t.id === route)) {
      navigate(roleTabs[0].id);
    }
  }, [roleTabs, route, navigate]);

  const roleMeta = useMemo(() => {
    if (state.role === 'operator') return { title: 'Licensed Class B Operator', defaultName: 'Operator Jim' };
    if (state.role === 'engineer') return { title: 'Environmental Engineer / Supt.', defaultName: 'E. Vance' };
    return { title: 'Logistics Coordinator', defaultName: 'S. Mercer' };
  }, [state.role]);

  const signedInUserLabel = user ? `${user.gmail}` : roleMeta.defaultName;

  // Onboarding completion
  const handleCompleteOnboarding = (profile: UserProfile, chosenRole?: RoleId) => {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(profile));
    } catch {
      // ignore
    }
    setUser(profile);
    if (chosenRole) {
      setState((prev) => ({ ...prev, role: chosenRole }));
      if (chosenRole === 'operator') {
        navigate(qrContext.targetRoute ?? 'log-level');
      } else {
        navigate(qrContext.targetRoute ?? 'dashboard');
      }
    }
  };

  const handleSignOut = () => {
    try {
      localStorage.removeItem(USER_KEY);
    } catch {
      // ignore
    }
    setUser(null);
  };

  const handleResetDemo = () => {
    const freshNow = Date.now();
    const fresh = seedState(freshNow);
    setNow(freshNow);
    setState(fresh);
    setSyncNotice('Demo plant data reset to initial Scenario 2 baseline.');
    navigate('dashboard');
  };

  // Actions
  const handleSaveReading = ({ tankId, pct, time, by }: { tankId: string; pct: number; time: number; by: string }) => {
    const synced = state.online;
    const tank = getTank(tankId);
    const gal = Math.round((pct / 100) * tank.capacityGal);
    const newReading = {
      id: `rd-${Date.now()}`,
      tankId,
      time,
      pct,
      by,
      synced,
      source: 'field' as const,
    };
    setState((prev) => ({
      ...prev,
      readings: [...prev.readings, newReading],
      activityLog: synced
        ? [
            {
              id: `act-${Date.now()}`,
              time,
              text: `${tank.name} logged at ${pct}% (${gal.toLocaleString()} gal)`,
              actor: by,
              kind: 'reading',
            },
            ...prev.activityLog,
          ]
        : prev.activityLog,
    }));
    setNow(Date.now());
    return { synced };
  };

  const handleConfirmBook = (payload: {
    tankId: string;
    haulerId: string;
    date: string;
    window: PickupWindow;
    estGal: number;
    aiAccepted: boolean;
    rescheduleHaulId?: string;
  }): HaulRecord => {
    const tank = getTank(payload.tankId);
    const hauler = getHauler(payload.haulerId);
    const bookNow = Date.now();

    if (payload.rescheduleHaulId) {
      const updated: HaulRecord = {
        ...(state.hauls.find((h) => h.id === payload.rescheduleHaulId) as HaulRecord),
        haulerId: payload.haulerId,
        date: payload.date,
        window: payload.window,
        estGal: payload.estGal,
        delayed: false,
        aiAccepted: payload.aiAccepted,
      };
      setState((prev) => ({
        ...prev,
        hauls: prev.hauls.map((h) => (h.id === payload.rescheduleHaulId ? updated : h)),
        activityLog: [
          {
            id: `act-${bookNow}`,
            time: bookNow,
            text: `Rescheduled ${tank.name} pickup with ${hauler.name} (${hauler.reg}) · ${payload.date} ${payload.window}`,
            actor: signedInUserLabel,
            kind: 'haul',
          },
          ...prev.activityLog,
        ],
      }));
      return updated;
    }

    const newHaul: HaulRecord = {
      id: `haul-${bookNow}`,
      tankId: payload.tankId,
      date: payload.date,
      window: payload.window,
      haulerId: payload.haulerId,
      estGal: payload.estGal,
      status: 'Scheduled',
      delayed: false,
      actualGal: null,
      driver: null,
      plantSignOff: null,
      completedAt: null,
      createdAt: bookNow,
      aiAccepted: payload.aiAccepted,
    };

    setState((prev) => ({
      ...prev,
      hauls: [newHaul, ...prev.hauls],
      activityLog: [
        {
          id: `act-${bookNow}`,
          time: bookNow,
          text: `Booked ${hauler.name} (${hauler.reg}) for ${tank.name} · ${payload.date} ${payload.window} (${payload.estGal.toLocaleString()} gal)`,
          actor: signedInUserLabel,
          kind: 'haul',
        },
        ...prev.activityLog,
      ],
    }));

    return newHaul;
  };

  const handleAdvanceHaulStatus = (haulId: string) => {
    const tNow = Date.now();
    setState((prev) => {
      const target = prev.hauls.find((h) => h.id === haulId);
      if (!target) return prev;
      const nextStatus = target.status === 'Scheduled' ? 'En Route' : 'On Site';
      return {
        ...prev,
        hauls: prev.hauls.map((h) => (h.id === haulId ? { ...h, status: nextStatus } : h)),
        activityLog: [
          {
            id: `act-${tNow}`,
            time: tNow,
            text: `${getTank(target.tankId).name} pickup moved to ${nextStatus}`,
            actor: signedInUserLabel,
            kind: 'haul',
          },
          ...prev.activityLog,
        ],
      };
    });
  };

  const handleReportDelay = (haulId: string) => {
    const tNow = Date.now();
    setState((prev) => {
      const target = prev.hauls.find((h) => h.id === haulId);
      if (!target) return prev;
      return {
        ...prev,
        hauls: prev.hauls.map((h) => (h.id === haulId ? { ...h, delayed: true } : h)),
        activityLog: [
          {
            id: `act-${tNow}`,
            time: tNow,
            text: `Delay reported on ${getTank(target.tankId).name} pickup (${getHauler(target.haulerId).name})`,
            actor: signedInUserLabel,
            kind: 'alert',
          },
          ...prev.activityLog,
        ],
      };
    });
  };

  const handleCompletePickup = ({
    haulId,
    actualGal,
    driverName,
    plantSignOff,
  }: {
    haulId: string;
    actualGal: number;
    driverName: string;
    plantSignOff: string;
  }) => {
    const cNow = Date.now();
    setState((prev) => {
      const target = prev.hauls.find((h) => h.id === haulId);
      if (!target) return prev;

      const tank = getTank(target.tankId);
      const hauler = getHauler(target.haulerId);

      // Compute tank's current level and drop by actualGal
      const latestReading = prev.readings
        .filter((r) => r.tankId === target.tankId && r.synced)
        .sort((a, b) => b.time - a.time)[0];
      const currentGal = latestReading ? (latestReading.pct / 100) * tank.capacityGal : tank.capacityGal * 0.8;
      const newGal = Math.max(0, currentGal - actualGal);
      const newPct = Number(((newGal / tank.capacityGal) * 100).toFixed(1));

      const dStr = toDateStr(cNow);
      const seq = String(prev.manifests.filter((m) => toDateStr(m.pickupTime) === dStr).length + 1).padStart(2, '0');
      const trackingNumber = `TX-MNF-${dStr.slice(0, 4)}-${dStr.slice(5, 7)}${dStr.slice(8, 10)}-${seq}`;

      const newManifest: ManifestRecord = {
        id: `mnf-${cNow}`,
        haulId: target.id,
        trackingNumber,
        tankId: target.tankId,
        pickupTime: cNow,
        actualGal,
        materialClass: 'Class B Biosolids',
        haulerName: hauler.name,
        haulerReg: hauler.reg,
        destination: DESTINATION.name,
        permit: DESTINATION.permit,
        driverSig: driverName,
        plantSig: plantSignOff,
        status: 'Awaiting Review',
        archivedAt: null,
        archivedBy: null,
        retainUntil: null,
        auditTrail: [],
      };

      setSelectedManifestId(newManifest.id);

      return {
        ...prev,
        hauls: prev.hauls.map((h) =>
          h.id === haulId
            ? {
                ...h,
                status: 'Completed',
                delayed: false,
                actualGal,
                driver: driverName,
                plantSignOff,
                completedAt: cNow,
              }
            : h
        ),
        readings: [
          ...prev.readings,
          {
            id: `rd-haul-${cNow}`,
            tankId: target.tankId,
            time: cNow,
            pct: newPct,
            by: `Haul Drop (${driverName})`,
            synced: true,
            source: 'haul',
          },
        ],
        manifests: [newManifest, ...prev.manifests],
        activityLog: [
          {
            id: `act-${cNow}`,
            time: cNow,
            text: `Completed ${tank.name} haul (${actualGal.toLocaleString()} gal -> ${newPct}%); manifest ${trackingNumber} created`,
            actor: plantSignOff,
            kind: 'manifest',
          },
          ...prev.activityLog,
        ],
      };
    });
    setNow(Date.now());
  };

  const handleUpdateManifestFields = (
    manifestId: string,
    updates: Partial<
      Pick<
        ManifestRecord,
        'trackingNumber' | 'actualGal' | 'haulerName' | 'haulerReg' | 'destination' | 'permit' | 'driverSig' | 'plantSig'
      >
    >,
    by: string
  ) => {
    const uNow = Date.now();
    setState((prev) => ({
      ...prev,
      manifests: prev.manifests.map((m) => {
        if (m.id !== manifestId || m.status === 'Archived') return m;
        const entries: ManifestAuditEntry[] = [];
        (Object.keys(updates) as Array<keyof typeof updates>).forEach((k) => {
          const newVal = String(updates[k] ?? '');
          const oldVal = String(m[k] ?? '');
          if (newVal !== oldVal) {
            entries.push({
              time: uNow,
              by,
              field: k,
              oldValue: oldVal,
              newValue: newVal,
            });
          }
        });
        return {
          ...m,
          ...updates,
          auditTrail: [...entries, ...m.auditTrail],
        };
      }),
    }));
  };

  const handleArchiveManifest = (manifestId: string, by: string) => {
    const aNow = Date.now();
    const retain = new Date(aNow);
    retain.setFullYear(retain.getFullYear() + 3);
    setState((prev) => {
      const target = prev.manifests.find((m) => m.id === manifestId);
      if (!target) return prev;
      return {
        ...prev,
        manifests: prev.manifests.map((m) =>
          m.id === manifestId
            ? {
                ...m,
                status: 'Archived',
                archivedAt: aNow,
                archivedBy: by,
                retainUntil: retain.getTime(),
              }
            : m
        ),
        activityLog: [
          {
            id: `act-${aNow}`,
            time: aNow,
            text: `Manifest ${target.trackingNumber} archived for 3-year compliance retention`,
            actor: by,
            kind: 'manifest',
          },
          ...prev.activityLog,
        ],
      };
    });
  };

  // Gate unauthenticated users with frictionless Gmail + DOB screen
  if (!user) {
    return <OnboardingGate qrContext={qrContext} onComplete={handleCompleteOnboarding} />;
  }

  const queuedCount = state.readings.filter((r) => !r.synced).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#eef2f6] dark:bg-[#0b1120] text-slate-900 dark:text-slate-100">
      {/* Navy Top Bar */}
      <header className="bg-[#0f2342] text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Product Name */}
          <div className="font-display text-xl sm:text-2xl font-bold uppercase tracking-wide whitespace-nowrap shrink-0">
            Sludge Disposal Logistics Tracker
          </div>

          {/* 3-way Role Switch */}
          <div className="flex items-center gap-1 p-1 bg-slate-900/70 rounded-md border border-slate-700/80" role="group" aria-label="User role switch">
            {(
              [
                { id: 'coordinator', label: 'Coordinator' },
                { id: 'operator', label: 'Operator' },
                { id: 'engineer', label: 'Engineer / Supt.' },
              ] as const
            ).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleRoleSwitch(r.id)}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  state.role === r.id
                    ? 'bg-white text-[#0f2342]'
                    : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Connectivity + Signed-in User + Utility Controls */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleToggleOnline}
              title="Toggle Online / Offline simulation"
              className={`px-2.5 py-1.5 rounded text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                state.online
                  ? 'bg-slate-800 text-green-300 border border-slate-700 hover:bg-slate-700'
                  : 'bg-amber-400 text-slate-950'
              }`}
            >
              {state.online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{state.online ? 'Online' : 'Offline'}</span>
              {queuedCount > 0 && (
                <span className="font-mono-num">({queuedCount} queued)</span>
              )}
            </button>

            <div className="hidden md:flex flex-col text-right leading-tight">
              <span className="text-xs font-semibold text-white">{user.gmail}</span>
              <span className="text-[11px] text-slate-300">{roleMeta.title}</span>
            </div>

            <button
              type="button"
              onClick={() => setQrModalOpen(true)}
              className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              title="Physical Packaging QR Code Generator"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Packaging QR</span>
            </button>

            <button
              type="button"
              onClick={() => setDark((d) => !d)}
              aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handleResetDemo}
              title="Reset demo data"
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer"
              aria-label="Reset demo data"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              title="Switch Gmail / Sign out"
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Role-based Navigation Tabs */}
        <nav aria-label="Primary sections" className="bg-[#132b50] border-t border-slate-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto">
            {roleTabs.map((tab) => {
              const isActive = route === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => navigate(tab.id)}
                  className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-2 cursor-pointer ${
                    isActive
                      ? 'border-white text-white bg-white/10'
                      : 'border-transparent text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>{tab.label}</span>
                  {typeof tab.badge === 'number' && tab.badge > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-mono-num font-bold rounded bg-amber-400 text-slate-950">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 space-y-4">
        {syncNotice && (
          <div role="status" className="p-3 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs font-medium text-blue-950 dark:text-blue-200 flex items-center justify-between gap-2">
            <span>{syncNotice}</span>
            <button
              type="button"
              onClick={() => setSyncNotice(null)}
              className="text-blue-700 dark:text-blue-300 font-semibold hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {route === 'dashboard' && (
          <DashboardScreen
            state={state}
            now={now}
            isCoordinator={state.role === 'coordinator'}
            signedInUserLabel={signedInUserLabel}
            onOpenScheduler={(tankId, rescheduleHaul) =>
              setSchedulerState({ isOpen: true, tankId, rescheduleHaul: rescheduleHaul ?? null })
            }
            onAdvanceStatus={handleAdvanceHaulStatus}
            onReportDelay={handleReportDelay}
            onCompletePickup={handleCompletePickup}
            onNavigateManifests={() => navigate('manifests')}
          />
        )}

        {route === 'log-level' && (
          <LogLevelScreen
            state={state}
            now={now}
            initialTankId={qrContext.targetTankId}
            operatorLabel={user.gmail}
            onToggleOnline={handleToggleOnline}
            onSaveReading={handleSaveReading}
          />
        )}

        {route === 'hauls' && (
          <HaulsScreen
            state={state}
            now={now}
            readOnly={state.role !== 'coordinator'}
            signedInUserLabel={signedInUserLabel}
            onOpenScheduler={(tankId, rescheduleHaul) =>
              setSchedulerState({ isOpen: true, tankId, rescheduleHaul: rescheduleHaul ?? null })
            }
            onAdvanceStatus={handleAdvanceHaulStatus}
            onReportDelay={handleReportDelay}
            onCompletePickup={handleCompletePickup}
          />
        )}

        {route === 'manifests' && (
          <ManifestsScreen
            state={state}
            selectedManifestId={selectedManifestId}
            signedInUserLabel={signedInUserLabel}
            onSelectManifest={(id) => setSelectedManifestId(id)}
            onUpdateManifestFields={handleUpdateManifestFields}
            onArchiveManifest={handleArchiveManifest}
          />
        )}

        {route === 'records' && (
          <RecordsScreen
            state={state}
            onOpenManifest={(id) => {
              setSelectedManifestId(id);
              navigate('manifests');
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Working prototype with simulated plant data stored in the browser. Production system uses PostgreSQL and a PWA service worker.
          </span>
          <span className="font-mono-num">
            Signed in: {user.gmail} · DOB verified
          </span>
        </div>
      </footer>

      {/* Modals */}
      <SchedulerModal
        isOpen={schedulerState.isOpen}
        tankId={schedulerState.tankId}
        rescheduleHaul={schedulerState.rescheduleHaul}
        state={state}
        now={now}
        onClose={() => setSchedulerState((s) => ({ ...s, isOpen: false }))}
        onConfirmBook={handleConfirmBook}
      />

      <PackagingQrModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        onTestQrFlow={(targetTankId, targetView) => {
          setQrContext({
            isQrScan: true,
            sourceLabel: targetTankId
              ? `Physical Vessel Tag · ${getTank(targetTankId).name} (${getTank(targetTankId).label})`
              : 'Physical Product Packaging · Facility Access Tag',
            targetTankId,
            targetRoute: (targetView as RouteId | undefined) ?? (targetTankId ? 'log-level' : 'dashboard'),
          });
          handleSignOut();
        }}
      />
    </div>
  );
}
