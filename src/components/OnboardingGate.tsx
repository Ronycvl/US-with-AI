import React, { useState } from 'react';
import { QrCode, ArrowRight, ShieldCheck, Calendar, Mail } from 'lucide-react';
import { RoleId, UserProfile } from '../lib/plantLogic';

interface OnboardingGateProps {
  qrContext: {
    isQrScan: boolean;
    sourceLabel: string;
    targetTankId?: string;
    targetRoute?: string;
  };
  onComplete: (profile: UserProfile, chosenRole?: RoleId) => void;
}

export const OnboardingGate: React.FC<OnboardingGateProps> = ({ qrContext, onComplete }) => {
  const [gmail, setGmail] = useState('');
  const [dob, setDob] = useState('');
  const [role, setRole] = useState<RoleId>(qrContext.targetRoute === 'log-level' ? 'operator' : 'coordinator');
  const [error, setError] = useState<string | null>(null);

  const validateAndSubmit = (emailVal: string, dobVal: string, selectedRole: RoleId) => {
    const trimmedEmail = emailVal.trim().toLowerCase();
    if (!trimmedEmail || !/^[a-z0-9._%+-]+@gmail\.com$/i.test(trimmedEmail)) {
      setError('Enter a valid Gmail ID (must end with @gmail.com) for instant plant access.');
      return;
    }

    if (!dobVal) {
      setError('Enter your date of birth to verify facility access.');
      return;
    }

    const birth = new Date(dobVal + 'T00:00:00');
    const today = new Date();
    if (Number.isNaN(birth.getTime()) || birth >= today) {
      setError('Enter a valid past date of birth.');
      return;
    }

    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    if (age < 18) {
      setError('Operators and facility personnel must be at least 18 years old.');
      return;
    }

    setError(null);
    onComplete(
      {
        gmail: trimmedEmail,
        dob: dobVal,
        signedInAt: Date.now(),
        qrSource: qrContext.isQrScan ? qrContext.sourceLabel : 'Direct Plant Access',
      },
      selectedRole
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    validateAndSubmit(gmail, dob, role);
  };

  const handleQuickDemo = () => {
    const demoEmail = 'operator.jim@gmail.com';
    const demoDob = '1989-06-15';
    setGmail(demoEmail);
    setDob(demoDob);
    validateAndSubmit(demoEmail, demoDob, role);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#eef2f6] dark:bg-[#0b1120] text-slate-900 dark:text-slate-100">
      <header className="bg-[#0f2342] text-white px-4 sm:px-6 py-4 border-b border-slate-800">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="font-display text-xl sm:text-2xl font-bold uppercase tracking-wide whitespace-nowrap">
            Sludge Disposal Logistics Tracker
          </div>
          <span className="text-xs text-slate-300 font-mono-num whitespace-nowrap">
            QR Packaging Access
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 sm:p-8 shadow-sm">
          {qrContext.isQrScan ? (
            <div className="mb-5 p-3 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-start gap-3">
              <QrCode className="w-5 h-5 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold text-blue-950 dark:text-blue-200">
                  Packaging QR Verified
                </div>
                <div className="text-xs text-blue-800 dark:text-blue-300 mt-0.5">
                  {qrContext.sourceLabel}
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-5 p-3 rounded-md bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
              <QrCode className="w-5 h-5 text-[#0f2342] dark:text-slate-300 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Accessible via physical product packaging QR code or direct browser access. Only your Gmail ID and date of birth are required.
              </div>
            </div>
          )}

          <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-slate-900 dark:text-white">
            Instant Plant Access
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            No passwords or approvals needed. Enter your Gmail ID and date of birth to stay signed in on this device.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="onboarding-gmail" className="block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1.5">
                Gmail ID
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="onboarding-gmail"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@gmail.com"
                  value={gmail}
                  onChange={(e) => {
                    setGmail(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="onboarding-dob" className="block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1.5">
                Date of Birth
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="onboarding-dob"
                  type="date"
                  required
                  max={new Date().toISOString().split('T')[0]}
                  value={dob}
                  onChange={(e) => {
                    setDob(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full pl-9 pr-3 py-2.5 text-sm font-mono-num rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1.5">
                Starting Station Role
              </span>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-md">
                {(
                  [
                    { id: 'coordinator', label: 'Coordinator' },
                    { id: 'operator', label: 'Operator' },
                    { id: 'engineer', label: 'Engineer' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRole(item.id)}
                    className={`py-2 px-2 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
                      role === item.id
                        ? 'bg-[#0f2342] text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div role="alert" className="p-3 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-medium text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full min-h-[48px] px-4 py-3 bg-[#0f2342] hover:bg-[#173461] text-white font-semibold text-sm rounded-md flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Enter Plant Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-green-700 dark:text-green-400 shrink-0" />
              <span>Stays signed in locally</span>
            </span>
            <button
              type="button"
              onClick={handleQuickDemo}
              className="text-blue-700 dark:text-blue-400 hover:underline font-medium whitespace-nowrap cursor-pointer"
            >
              Quick-fill demo credentials
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
