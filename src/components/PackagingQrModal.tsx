import React, { useEffect, useState } from 'react';
import { X, Download, Printer, QrCode, ExternalLink } from 'lucide-react';
import { TANKS } from '../lib/plantLogic';
import { generateQrDataUrl } from '../lib/audioAndPdf';

interface PackagingQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestQrFlow: (targetTankId?: string, targetView?: string) => void;
}

type LabelPreset = 'general' | 'tank-1' | 'tank-2' | 'tank-3' | 'tank-4' | 'manifest';

export const PackagingQrModal: React.FC<PackagingQrModalProps> = ({ isOpen, onClose, onTestQrFlow }) => {
  const [preset, setPreset] = useState<LabelPreset>('tank-2');
  const [qrUrl, setQrUrl] = useState<string>('');

  const origin = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';

  const buildTargetLink = (p: LabelPreset): { url: string; title: string; subtitle: string; tankId?: string; view?: string } => {
    if (p === 'general') {
      return {
        url: `${origin}?qr=packaging#dashboard`,
        title: 'Plant Packaging Master Label',
        subtitle: 'Class B Biosolids · Instant Facility Access',
      };
    }
    if (p === 'manifest') {
      return {
        url: `${origin}?qr=manifest&view=manifests#manifests`,
        title: 'Container Manifest Packaging Tag',
        subtitle: 'TCEQ / EPA Disposal Manifest Review',
        view: 'manifests',
      };
    }
    const tank = TANKS.find((t) => t.id === p) ?? TANKS[1];
    return {
      url: `${origin}?qr=vessel&tank=${tank.id}&view=log-level#log-level`,
      title: `${tank.name} (${tank.label}) Vessel Tag`,
      subtitle: `${tank.capacityGal.toLocaleString()} gal · Direct Field Log Access`,
      tankId: tank.id,
      view: 'log-level',
    };
  };

  const info = buildTargetLink(preset);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void generateQrDataUrl(info.url).then((dataUrl) => {
      if (!cancelled) setQrUrl(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, info.url]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!qrUrl) return;
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `packaging-qr-${preset}.png`;
    a.click();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60" role="dialog" aria-modal="true" aria-labelledby="qr-modal-title">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl overflow-hidden">
        <div className="px-5 py-4 bg-[#0f2342] text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <QrCode className="w-5 h-5 shrink-0" />
            <h2 id="qr-modal-title" className="font-display text-lg font-bold uppercase tracking-wide">
              Physical Packaging QR Integration
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close packaging QR dialog"
            className="p-1.5 rounded hover:bg-white/10 text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[82vh] overflow-y-auto">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Print and affix these QR codes directly onto physical biosolids containers, tank gauge housings, or manifest packets. Anyone scanning opens the app immediately using only a Gmail ID and date of birth.
          </p>

          <div>
            <label htmlFor="qr-preset-select" className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
              Select Packaging Label Target
            </label>
            <select
              id="qr-preset-select"
              value={preset}
              onChange={(e) => setPreset(e.target.value as LabelPreset)}
              className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              <option value="tank-2">Tank 2 (Digested) — Physical Gauge Tag</option>
              <option value="tank-1">Tank 1 (Primary) — Physical Gauge Tag</option>
              <option value="tank-3">Tank 3 (Secondary) — Physical Gauge Tag</option>
              <option value="tank-4">Tank 4 (Holding) — Physical Gauge Tag</option>
              <option value="manifest">Disposal Packet / Drum Batch — Manifest Label</option>
              <option value="general">Facility Packaging Master Label</option>
            </select>
          </div>

          <div className="p-4 rounded-md border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row items-center gap-5">
            <div className="bg-white p-2.5 rounded border border-slate-200 shrink-0">
              {qrUrl ? (
                <img src={qrUrl} alt={`QR code for ${info.title}`} className="w-40 h-40 block" />
              ) : (
                <div className="w-40 h-40 flex items-center justify-center text-xs text-slate-400">Generating QR...</div>
              )}
            </div>
            <div className="flex-1 text-center sm:text-left space-y-1.5">
              <div className="font-display text-lg font-bold uppercase tracking-wide text-slate-900 dark:text-white">
                {info.title}
              </div>
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {info.subtitle}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                Scan with phone camera · Access with Gmail ID + Date of Birth
              </div>
              <div className="pt-2 text-[11px] font-mono-num text-slate-500 dark:text-slate-400 break-all">
                {info.url}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                onClose();
                onTestQrFlow(info.tankId, info.view);
              }}
              className="px-3.5 py-2 text-xs font-semibold rounded-md border border-blue-600 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Preview QR Scan Onboarding</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-2 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Label</span>
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="px-4 py-2 text-xs font-semibold rounded-md bg-[#0f2342] hover:bg-[#173461] text-white inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download QR PNG</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
