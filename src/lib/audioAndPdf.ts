import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { formatShortDate, formatShortDateTime, getTank, ManifestRecord } from './plantLogic';

export function playDoubleBeep(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const playTone = (startOffset: number, freq: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + startOffset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startOffset);
      osc.stop(ctx.currentTime + startOffset + duration + 0.02);
    };
    playTone(0, 880, 0.11);
    playTone(0.15, 1046.5, 0.14);
    setTimeout(() => {
      try {
        void ctx.close();
      } catch {
        // ignore close errors
      }
    }, 500);
  } catch {
    // Web Audio API unavailable
  }
}

export function triggerVibration(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([70, 50, 90]);
    }
  } catch {
    // Vibration API unavailable
  }
}

export function formatManifestText(m: ManifestRecord): string {
  const tank = getTank(m.tankId);
  return [
    'TEXAS / EPA BIOSOLIDS DISPOSAL MANIFEST',
    '=======================================',
    `Manifest Tracking #: ${m.trackingNumber}`,
    `Status: ${m.status}`,
    `Pickup Date & Time: ${formatShortDateTime(m.pickupTime)}`,
    `Source Tank / Unit: ${tank.name} (${tank.label} · ${tank.capacityGal.toLocaleString()} gal cap.)`,
    `Actual Volume Hauled: ${m.actualGal.toLocaleString()} gal`,
    `Material Classification: ${m.materialClass}`,
    `Transporter: ${m.haulerName} (Reg #${m.haulerReg})`,
    `Destination Facility: ${m.destination} (Permit #${m.permit})`,
    `Driver Electronic Sign-Off: ${m.driverSig}`,
    `Plant Electronic Sign-Off: ${m.plantSig}`,
    m.archivedAt ? `Archived: ${formatShortDateTime(m.archivedAt)} by ${m.archivedBy ?? '—'}` : '',
    m.retainUntil ? `3-Year Retain Until: ${formatShortDate(m.retainUntil)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function downloadManifestPdf(m: ManifestRecord): boolean {
  try {
    const tank = getTank(m.tankId);
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });

    // Navy header band
    doc.setFillColor(15, 35, 66);
    doc.rect(0, 0, 612, 82, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text('BIOSOLIDS DISPOSAL MANIFEST (TCEQ / EPA)', 42, 36);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Sludge Disposal Logistics Tracker · Municipal Wastewater Treatment Plant', 42, 56);
    doc.text(`Tracking #: ${m.trackingNumber}`, 410, 36);
    doc.text(`Status: ${m.status}`, 410, 56);

    doc.setTextColor(15, 23, 42);
    let y = 118;

    const addField = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);
      doc.text(label.toUpperCase(), 42, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11.5);
      doc.setTextColor(15, 23, 42);
      doc.text(value, 220, y);
      doc.setDrawColor(226, 232, 240);
      doc.line(42, y + 10, 570, y + 10);
      y += 32;
    };

    addField('1. Manifest Tracking #', m.trackingNumber);
    addField('2. Pickup Date & Time', formatShortDateTime(m.pickupTime));
    addField('3. Source Tank / Unit', `${tank.name} — ${tank.label} (${tank.capacityGal.toLocaleString()} gal)`);
    addField('4. Actual Volume & Class', `${m.actualGal.toLocaleString()} gal · ${m.materialClass}`);
    addField('5. Transporter & Reg #', `${m.haulerName} (${m.haulerReg})`);
    addField('6. Destination & Permit #', `${m.destination} (Permit #${m.permit})`);
    addField('7. Driver Sign-Off', m.driverSig);
    addField('8. Plant Sign-Off', m.plantSig);

    if (m.archivedAt && m.retainUntil) {
      addField('Archive Record', `Archived ${formatShortDateTime(m.archivedAt)} by ${m.archivedBy ?? '—'}`);
      addField('3-Year Retention Date', formatShortDate(m.retainUntil));
    }

    if (m.auditTrail.length > 0) {
      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('FIELD CORRECTION AUDIT TRAIL', 42, y);
      y += 16;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      for (const entry of m.auditTrail.slice(0, 6)) {
        doc.text(
          `${formatShortDateTime(entry.time)} · ${entry.by} changed ${entry.field}: "${entry.oldValue}" -> "${entry.newValue}"`,
          42,
          y
        );
        y += 14;
      }
    }

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Generated electronically by Sludge Disposal Logistics Tracker. Retain for minimum 3 years per TCEQ / EPA 40 CFR Part 503.',
      42,
      748
    );

    doc.save(`${m.trackingNumber}.pdf`);
    return true;
  } catch {
    return false;
  }
}

export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 320,
    margin: 2,
    color: {
      dark: '#0f2342',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  });
}
