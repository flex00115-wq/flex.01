import React, { useEffect, useState } from 'react';
import { Lock, ShieldAlert, X } from 'lucide-react';
import { ADMIN_SESSION_KEY, hydrateAdminPasswordFromDb, verifyAdminPassword } from '../utils/adminAuth';

export { ADMIN_SESSION_KEY };

interface AdminLockModalProps {
  open: boolean;
  onClose: () => void;
  onUnlocked: () => void;
}

export function AdminLockModal({ open, onClose, onUnlocked }: AdminLockModalProps) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void hydrateAdminPasswordFromDb();
  }, []);

  useEffect(() => {
    if (open) {
      setPasscode('');
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = passcode.trim();
    if (!trimmed) {
      setError('Please enter the owner password.');
      return;
    }
    if (verifyAdminPassword(trimmed)) {
      try {
        sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
      } catch {
        // ignore storage errors
      }
      setPasscode('');
      setError('');
      onUnlocked();
    } else {
      setError('Incorrect owner password. Access denied.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-lock-title"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-[#231E3D] bg-[#131024] p-6 sm:p-7 space-y-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#FACC15]/40 bg-[#FACC15]/10 text-[#FACC15]">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="admin-lock-title" className="font-display text-lg font-bold text-white">
                Owner Admin Lock
              </h2>
              <p className="text-xs text-slate-400">
                Enter the owner password to unlock catalog &amp; pricing controls
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close admin lock dialog"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#231E3D] text-slate-400 hover:bg-[#1E1938] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200"
          >
            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label htmlFor="navbar-admin-passcode" className="block text-xs font-semibold text-slate-300 mb-1.5">
            Owner Password
          </label>
          <input
            id="navbar-admin-passcode"
            type="password"
            value={passcode}
            onChange={(e) => {
              setPasscode(e.target.value);
              if (error) setError('');
            }}
            placeholder="Enter owner password"
            autoFocus
            className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#FACC15] focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#231E3D] bg-[#0B0917] px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-[#FACC15] px-5 py-2.5 text-xs sm:text-sm font-bold text-[#0B0917] hover:bg-[#FDE047] transition-colors"
          >
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Unlock Admin</span>
          </button>
        </div>
      </form>
    </div>
  );
}
