import React, { useEffect, useMemo, useState } from 'react';
import { FileDown, Copy, Check, Lock, Edit3, Archive } from 'lucide-react';
import {
  formatShortDate,
  formatShortDateTime,
  getTank,
  ManifestRecord,
  PlantState,
  validateManifest,
} from '../lib/plantLogic';
import { downloadManifestPdf, formatManifestText } from '../lib/audioAndPdf';

interface ManifestsScreenProps {
  state: PlantState;
  selectedManifestId: string | null;
  signedInUserLabel: string;
  onSelectManifest: (id: string) => void;
  onUpdateManifestFields: (
    manifestId: string,
    updates: Partial<Pick<ManifestRecord, 'trackingNumber' | 'actualGal' | 'haulerName' | 'haulerReg' | 'destination' | 'permit' | 'driverSig' | 'plantSig'>>,
    by: string
  ) => void;
  onArchiveManifest: (manifestId: string, by: string) => void;
}

export const ManifestsScreen: React.FC<ManifestsScreenProps> = ({
  state,
  selectedManifestId,
  signedInUserLabel,
  onSelectManifest,
  onUpdateManifestFields,
  onArchiveManifest,
}) => {
  const sortedManifests = useMemo(() => {
    return [...state.manifests].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'Awaiting Review' ? -1 : 1;
      }
      return b.pickupTime - a.pickupTime;
    });
  }, [state.manifests]);

  const activeManifest =
    sortedManifests.find((m) => m.id === selectedManifestId) ?? sortedManifests[0] ?? null;

  const [isEditing, setIsEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);

  // Edit form fields
  const [trackingNumber, setTrackingNumber] = useState('');
  const [actualGal, setActualGal] = useState(0);
  const [haulerName, setHaulerName] = useState('');
  const [haulerReg, setHaulerReg] = useState('');
  const [destination, setDestination] = useState('');
  const [permit, setPermit] = useState('');
  const [driverSig, setDriverSig] = useState('');
  const [plantSig, setPlantSig] = useState('');

  useEffect(() => {
    if (!activeManifest) return;
    setIsEditing(false);
    setConfirmArchive(false);
    setPdfNotice(null);
    setTrackingNumber(activeManifest.trackingNumber);
    setActualGal(activeManifest.actualGal);
    setHaulerName(activeManifest.haulerName);
    setHaulerReg(activeManifest.haulerReg);
    setDestination(activeManifest.destination);
    setPermit(activeManifest.permit);
    setDriverSig(activeManifest.driverSig);
    setPlantSig(activeManifest.plantSig);
  }, [activeManifest?.id]);

  if (!activeManifest) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-8 text-center text-sm text-slate-500">
        No manifests generated yet.
      </div>
    );
  }

  const tank = getTank(activeManifest.tankId);
  const validation = validateManifest(activeManifest);
  const isLocked = activeManifest.status === 'Archived';

  const handleSaveEdits = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateManifestFields(
      activeManifest.id,
      {
        trackingNumber: trackingNumber.trim(),
        actualGal,
        haulerName: haulerName.trim(),
        haulerReg: haulerReg.trim(),
        destination: destination.trim(),
        permit: permit.trim(),
        driverSig: driverSig.trim(),
        plantSig: plantSig.trim(),
      },
      signedInUserLabel
    );
    setIsEditing(false);
  };

  const handleDownloadPdf = () => {
    const ok = downloadManifestPdf(activeManifest);
    setPdfNotice(
      ok
        ? `Downloaded ${activeManifest.trackingNumber}.pdf`
        : 'Browser blocked PDF download — use Copy record text instead.'
    );
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(formatManifestText(activeManifest));
    } catch {
      // ignore
    }
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-slate-900 dark:text-white">
          Disposal Manifest Auto-Generation (TCEQ / EPA)
        </h1>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
          {sortedManifests.filter((m) => m.status === 'Awaiting Review').length} awaiting review ·{' '}
          {sortedManifests.filter((m) => m.status === 'Archived').length} archived (3-yr retention)
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Manifest List */}
        <aside className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
            Manifest Queue
          </div>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[600px] overflow-y-auto">
            {sortedManifests.map((m) => {
              const isSelected = m.id === activeManifest.id;
              const t = getTank(m.tankId);
              const awaiting = m.status === 'Awaiting Review';
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onSelectManifest(m.id)}
                    className={`w-full text-left px-4 py-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-num text-xs font-bold text-slate-900 dark:text-white">
                        {m.trackingNumber}
                      </span>
                      <span
                        className={`text-[11px] font-semibold whitespace-nowrap ${
                          awaiting
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-green-700 dark:text-green-400'
                        }`}
                      >
                        {awaiting ? '▲ Awaiting Review' : '● Archived'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      {t.name} · <span className="font-mono-num">{m.actualGal.toLocaleString()} gal</span> ·{' '}
                      {formatShortDate(m.pickupTime)}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Right Selected Manifest Detail */}
        <section className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-5 space-y-5">
          {/* Pre-validation Banner */}
          {validation.valid ? (
            <div role="status" className="p-3.5 rounded-md bg-green-50 dark:bg-green-950/40 border border-green-300 dark:border-green-800 text-xs font-semibold text-green-900 dark:text-green-200 flex items-center gap-2">
              <span aria-hidden="true">●</span>
              <span>Pre-validation complete: all 6 required regulatory fields populated automatically</span>
            </div>
          ) : (
            <div role="alert" className="p-3.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <div className="font-bold">▲ Validation issues detected ({validation.completedCount}/6 fields valid):</div>
              <ul className="list-disc pl-5 space-y-0.5">
                {validation.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Locked / Retain-until banner when archived */}
          {isLocked && (
            <div className="p-3.5 rounded-md bg-slate-100 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 font-semibold">
                <Lock className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                <span>
                  Record Locked & Archived by {activeManifest.archivedBy} on{' '}
                  {activeManifest.archivedAt ? formatShortDateTime(activeManifest.archivedAt) : '—'}
                </span>
              </span>
              <span className="font-mono-num font-bold text-green-800 dark:text-green-400">
                Retain Until: {activeManifest.retainUntil ? formatShortDate(activeManifest.retainUntil) : '—'}
              </span>
            </div>
          )}

          {/* Read-only view or Edit Form */}
          {isEditing && !isLocked ? (
            <form onSubmit={handleSaveEdits} className="space-y-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Edit Regulatory Fields (All changes logged in audit trail)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Manifest Tracking #
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="w-full px-3 py-2 font-mono-num text-sm rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Actual Volume Hauled (gal)
                  </label>
                  <input
                    type="number"
                    value={actualGal}
                    onChange={(e) => setActualGal(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 font-mono-num text-sm rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Transporter Name
                  </label>
                  <input
                    type="text"
                    value={haulerName}
                    onChange={(e) => setHaulerName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Transporter Registration #
                  </label>
                  <input
                    type="text"
                    value={haulerReg}
                    onChange={(e) => setHaulerReg(e.target.value)}
                    className="w-full px-3 py-2 font-mono-num text-sm rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Destination Facility
                  </label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Destination Permit #
                  </label>
                  <input
                    type="text"
                    value={permit}
                    onChange={(e) => setPermit(e.target.value)}
                    className="w-full px-3 py-2 font-mono-num text-sm rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Driver Signature
                  </label>
                  <input
                    type="text"
                    value={driverSig}
                    onChange={(e) => setDriverSig(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Plant Signature
                  </label>
                  <input
                    type="text"
                    value={plantSig}
                    onChange={(e) => setPlantSig(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-2 text-xs font-semibold rounded border border-slate-300 dark:border-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded bg-[#0f2342] text-white cursor-pointer"
                >
                  Save Corrections
                </button>
              </div>
            </form>
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  1. Manifest Tracking #
                </dt>
                <dd className="mt-1 font-mono-num font-bold text-slate-900 dark:text-white">
                  {activeManifest.trackingNumber}
                </dd>
              </div>
              <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  2. Pickup Date & Time
                </dt>
                <dd className="mt-1 font-mono-num font-semibold text-slate-900 dark:text-white">
                  {formatShortDateTime(activeManifest.pickupTime)}
                </dd>
              </div>
              <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  3. Source Tank / Unit
                </dt>
                <dd className="mt-1 font-semibold text-slate-900 dark:text-white">
                  {tank.name} — {tank.label} ({tank.capacityGal.toLocaleString()} gal cap.)
                </dd>
              </div>
              <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  4. Actual Volume Hauled & Material Class
                </dt>
                <dd className="mt-1 font-mono-num font-semibold text-slate-900 dark:text-white">
                  {activeManifest.actualGal.toLocaleString()} gal · {activeManifest.materialClass}
                </dd>
              </div>
              <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  5. Transporter Name & Registration #
                </dt>
                <dd className="mt-1 font-semibold text-slate-900 dark:text-white">
                  {activeManifest.haulerName}{' '}
                  <span className="font-mono-num text-slate-600 dark:text-slate-300">
                    ({activeManifest.haulerReg})
                  </span>
                </dd>
              </div>
              <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  6. Destination Facility & Permit
                </dt>
                <dd className="mt-1 font-semibold text-slate-900 dark:text-white">
                  {activeManifest.destination}{' '}
                  <span className="font-mono-num text-slate-600 dark:text-slate-300">
                    (Permit #{activeManifest.permit})
                  </span>
                </dd>
              </div>
              <div className="pb-2 border-b border-slate-100 dark:border-slate-800 sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Electronic Signatures (Driver & Plant)
                </dt>
                <dd className="mt-1 flex flex-wrap gap-6 text-slate-900 dark:text-white font-medium">
                  <span>Driver: {activeManifest.driverSig}</span>
                  <span>Plant: {activeManifest.plantSig}</span>
                </dd>
              </div>
            </dl>
          )}

          {/* Action Buttons */}
          {!isEditing && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="px-3.5 py-2 text-xs font-semibold rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit fields</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="px-3.5 py-2 text-xs font-semibold rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Download PDF record</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyText}
                  className="px-3.5 py-2 text-xs font-semibold rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedText ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedText ? 'Copied text' : 'Copy record text'}</span>
                </button>
              </div>

              {!isLocked && (
                <button
                  type="button"
                  disabled={!validation.valid}
                  onClick={() => setConfirmArchive(true)}
                  className="px-4 py-2.5 text-xs font-semibold rounded bg-green-700 hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed text-white inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Archive className="w-4 h-4" />
                  <span>SUBMIT & ARCHIVE (3 YRS)</span>
                </button>
              )}
            </div>
          )}

          {pdfNotice && (
            <div className="text-xs font-medium text-blue-700 dark:text-blue-400">{pdfNotice}</div>
          )}

          {/* Archive Confirmation Prompt */}
          {confirmArchive && !isLocked && (
            <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 space-y-2.5">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                Confirm 3-Year Regulatory Archive?
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Archiving locks {activeManifest.trackingNumber} permanently so fields can no longer be edited and sets a 3-year compliance retention date.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onArchiveManifest(activeManifest.id, signedInUserLabel);
                    setConfirmArchive(false);
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded bg-green-700 hover:bg-green-800 text-white cursor-pointer"
                >
                  Confirm & Lock Record
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmArchive(false)}
                  className="px-3 py-2 text-xs font-semibold rounded border border-slate-300 dark:border-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Audit Trail */}
          {activeManifest.auditTrail.length > 0 && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <h3 className="font-display text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Field Correction Audit Trail
              </h3>
              <ul className="space-y-1 text-xs font-mono-num text-slate-600 dark:text-slate-400">
                {activeManifest.auditTrail.map((entry, idx) => (
                  <li key={idx}>
                    {formatShortDateTime(entry.time)} · {entry.by} changed <span className="font-semibold">{entry.field}</span>: &quot;{entry.oldValue}&quot; → &quot;{entry.newValue}&quot;
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
