import React, { useMemo, useState } from 'react';
import { Download, Copy, Check, Search, X } from 'lucide-react';
import {
  formatShortDate,
  formatShortDateTime,
  getHauler,
  getTank,
  HAULERS,
  PlantState,
  TANKS,
  toDateStr,
} from '../lib/plantLogic';

interface RecordsScreenProps {
  state: PlantState;
  onOpenManifest: (manifestId: string) => void;
}

export const RecordsScreen: React.FC<RecordsScreenProps> = ({ state, onOpenManifest }) => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [haulerFilter, setHaulerFilter] = useState('all');
  const [tankFilter, setTankFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pickups' | 'readings'>('pickups');
  const [copiedCsv, setCopiedCsv] = useState(false);

  const filteredPickups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.manifests
      .filter((m) => {
        const dStr = toDateStr(m.pickupTime);
        if (fromDate && dStr < fromDate) return false;
        if (toDate && dStr > toDate) return false;
        if (tankFilter !== 'all' && m.tankId !== tankFilter) return false;
        if (statusFilter !== 'all' && m.status !== statusFilter) return false;
        if (haulerFilter !== 'all') {
          const h = getHauler(haulerFilter);
          if (m.haulerName !== h.name && m.haulerReg !== h.reg) return false;
        }
        if (q) {
          const hay = `${m.trackingNumber} ${m.permit} ${m.haulerReg} ${m.driverSig} ${m.haulerName}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.pickupTime - a.pickupTime);
  }, [state.manifests, fromDate, toDate, haulerFilter, tankFilter, statusFilter, searchQuery]);

  const filteredReadings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.readings
      .filter((r) => {
        const dStr = toDateStr(r.time);
        if (fromDate && dStr < fromDate) return false;
        if (toDate && dStr > toDate) return false;
        if (tankFilter !== 'all' && r.tankId !== tankFilter) return false;
        if (q) {
          const hay = `${getTank(r.tankId).name} ${r.by} ${r.source}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.time - a.time);
  }, [state.readings, fromDate, toDate, tankFilter, searchQuery]);

  // Totals for filtered pickups
  const totals = useMemo(() => {
    let totalGal = 0;
    let totalCost = 0;
    let archivedCount = 0;
    let awaitingCount = 0;
    const byHauler: Record<string, { name: string; count: number; gal: number; cost: number }> = {};

    for (const m of filteredPickups) {
      const hauler = HAULERS.find((h) => h.reg === m.haulerReg || h.name === m.haulerName) ?? HAULERS[0];
      const cost = m.actualGal * hauler.ratePerGal;
      totalGal += m.actualGal;
      totalCost += cost;
      if (m.status === 'Archived') archivedCount++;
      else awaitingCount++;

      if (!byHauler[hauler.name]) {
        byHauler[hauler.name] = { name: hauler.name, count: 0, gal: 0, cost: 0 };
      }
      byHauler[hauler.name].count++;
      byHauler[hauler.name].gal += m.actualGal;
      byHauler[hauler.name].cost += cost;
    }

    const avgCost = filteredPickups.length > 0 ? totalCost / filteredPickups.length : 0;
    return {
      count: filteredPickups.length,
      archivedCount,
      awaitingCount,
      totalGal,
      totalCost,
      avgCost,
      byHauler: Object.values(byHauler),
    };
  }, [filteredPickups]);

  const clearFilters = () => {
    setFromDate('');
    setToDate('');
    setHaulerFilter('all');
    setTankFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
  };

  const buildCsv = () => {
    if (activeTab === 'pickups') {
      const headers = [
        'Manifest #',
        'Pickup Time',
        'Tank',
        'Gallons',
        'Transporter',
        'Registration',
        'Destination',
        'Permit',
        'Driver',
        'Cost ($)',
        'Status',
        'Retain Until',
      ];
      const rows = filteredPickups.map((m) => {
        const tank = getTank(m.tankId);
        const h = HAULERS.find((x) => x.reg === m.haulerReg || x.name === m.haulerName) ?? HAULERS[0];
        const cost = (m.actualGal * h.ratePerGal).toFixed(2);
        return [
          m.trackingNumber,
          new Date(m.pickupTime).toISOString(),
          `${tank.name} (${tank.label})`,
          m.actualGal,
          m.haulerName,
          m.haulerReg,
          m.destination,
          m.permit,
          m.driverSig,
          cost,
          m.status,
          m.retainUntil ? toDateStr(m.retainUntil) : '',
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',');
      });
      return [headers.join(','), ...rows].join('\n');
    } else {
      const headers = ['Timestamp', 'Tank', 'Level (%)', 'Gallons', 'Logged By', 'Source', 'Sync State'];
      const rows = filteredReadings.map((r) => {
        const tank = getTank(r.tankId);
        const gal = Math.round((r.pct / 100) * tank.capacityGal);
        return [
          new Date(r.time).toISOString(),
          `${tank.name} (${tank.label})`,
          r.pct,
          gal,
          r.by,
          r.source,
          r.synced ? 'Synced' : 'Queued',
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',');
      });
      return [headers.join(','), ...rows].join('\n');
    }
  };

  const handleDownloadCsv = () => {
    const csv = buildCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sludge-records-${activeTab}-${toDateStr(Date.now())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyCsv = async () => {
    try {
      await navigator.clipboard.writeText(buildCsv());
    } catch {
      // ignore
    }
    setCopiedCsv(true);
    setTimeout(() => setCopiedCsv(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Filter Bar */}
      <section aria-label="Compliance record filters" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-xl font-bold uppercase tracking-wide text-slate-900 dark:text-white">
            Compliance Records & Hauling Cost Ledger
          </h1>
          <button
            type="button"
            onClick={clearFilters}
            className="px-3 py-1.5 text-xs font-semibold rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear filters</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <label htmlFor="rec-from" className="block font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
              From Date
            </label>
            <input
              id="rec-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-2.5 py-2 font-mono-num rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>

          <div>
            <label htmlFor="rec-to" className="block font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
              To Date
            </label>
            <input
              id="rec-to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-2.5 py-2 font-mono-num rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>

          <div>
            <label htmlFor="rec-hauler" className="block font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
              Hauler
            </label>
            <select
              id="rec-hauler"
              value={haulerFilter}
              onChange={(e) => setHaulerFilter(e.target.value)}
              className="w-full px-2.5 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="all">All haulers</option>
              {HAULERS.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rec-tank" className="block font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
              Tank
            </label>
            <select
              id="rec-tank"
              value={tankFilter}
              onChange={(e) => setTankFilter(e.target.value)}
              className="w-full px-2.5 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="all">All tanks</option>
              {TANKS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.label})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rec-status" className="block font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
              Status
            </label>
            <select
              id="rec-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="all">All statuses</option>
              <option value="Awaiting Review">Awaiting Review</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          <div>
            <label htmlFor="rec-search" className="block font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
              Search (Manifest / Permit / Reg / Driver)
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="rec-search"
                type="text"
                placeholder="TX-MNF, MSW-1982, Alvarez..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Filtered Totals */}
      <section aria-label="Filtered totals" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Pickups Found
          </div>
          <div className="mt-1 font-mono-num text-xl font-bold text-slate-900 dark:text-white">
            {totals.count}
          </div>
          <div className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
            {totals.archivedCount} archived · {totals.awaitingCount} awaiting review
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Gallons Hauled
          </div>
          <div className="mt-1 font-mono-num text-xl font-bold text-slate-900 dark:text-white">
            {totals.totalGal.toLocaleString()} gal
          </div>
          <div className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
            Avg {totals.count > 0 ? Math.round(totals.totalGal / totals.count).toLocaleString() : 0} gal/pickup
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Hauling Cost
          </div>
          <div className="mt-1 font-mono-num text-xl font-bold text-slate-900 dark:text-white">
            ${totals.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
            Avg ${totals.avgCost.toFixed(2)} / pickup
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Breakdown by Hauler
          </div>
          <div className="mt-1 space-y-0.5 text-xs font-mono-num">
            {totals.byHauler.length === 0 ? (
              <span className="text-slate-400">No matches</span>
            ) : (
              totals.byHauler.map((b) => (
                <div key={b.name} className="flex items-center justify-between gap-2">
                  <span className="truncate font-sans text-slate-700 dark:text-slate-300">{b.name.split(' ')[0]}</span>
                  <span className="font-semibold text-slate-900 dark:text-white shrink-0">
                    {b.count} · ${Math.round(b.cost).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Tabs & Export + Data Table */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-md">
            <button
              type="button"
              onClick={() => setActiveTab('pickups')}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'pickups'
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Pickups & Manifests ({filteredPickups.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('readings')}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'readings'
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Tank Readings ({filteredReadings.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCsv}
              className="px-3 py-1.5 text-xs font-semibold rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
            >
              {copiedCsv ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCsv ? 'Copied CSV' : 'Copy CSV'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="px-3.5 py-1.5 text-xs font-semibold rounded bg-[#0f2342] hover:bg-[#173461] text-white inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {activeTab === 'pickups' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  <th className="py-2.5 px-3 font-semibold">Manifest #</th>
                  <th className="py-2.5 px-3 font-semibold">Pickup Time</th>
                  <th className="py-2.5 px-3 font-semibold">Tank</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Gallons</th>
                  <th className="py-2.5 px-3 font-semibold">Transporter & Reg</th>
                  <th className="py-2.5 px-3 font-semibold">Destination & Permit</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Cost</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Retain Until</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredPickups.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      No pickups match your current filters.
                    </td>
                  </tr>
                ) : (
                  filteredPickups.map((m) => {
                    const tank = getTank(m.tankId);
                    const h = HAULERS.find((x) => x.reg === m.haulerReg || x.name === m.haulerName) ?? HAULERS[0];
                    const cost = m.actualGal * h.ratePerGal;
                    return (
                      <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono-num font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {m.trackingNumber}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatShortDateTime(m.pickupTime)}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {tank.name} ({tank.label})
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-num font-semibold whitespace-nowrap">
                          {m.actualGal.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <div>{m.haulerName}</div>
                          <div className="font-mono-num text-slate-500">{m.haulerReg} · {m.driverSig}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div>{m.destination}</div>
                          <div className="font-mono-num text-slate-500">Permit #{m.permit}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-num font-semibold whitespace-nowrap">
                          ${cost.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              m.status === 'Archived'
                                ? 'text-green-700 dark:text-green-400'
                                : 'text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {m.status === 'Archived' ? '● Archived' : '▲ Awaiting Review'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono-num whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {m.retainUntil ? formatShortDate(m.retainUntil) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onOpenManifest(m.id)}
                            className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  <th className="py-2.5 px-3 font-semibold">Time</th>
                  <th className="py-2.5 px-3 font-semibold">Tank</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Level (%)</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Gallons</th>
                  <th className="py-2.5 px-3 font-semibold">Logged By</th>
                  <th className="py-2.5 px-3 font-semibold">Source</th>
                  <th className="py-2.5 px-3 font-semibold">Sync State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredReadings.slice(0, 120).map((r) => {
                  const tank = getTank(r.tankId);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono-num text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {formatShortDateTime(r.time)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-medium">
                        {tank.name} ({tank.label})
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num font-bold">{r.pct}%</td>
                      <td className="py-2.5 px-3 text-right font-mono-num">
                        {Math.round((r.pct / 100) * tank.capacityGal).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">{r.by}</td>
                      <td className="py-2.5 px-3 uppercase font-mono-num text-slate-500">{r.source}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            r.synced ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {r.synced ? '● Synced' : '▲ Queued'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
