import { STORE_CONFIG } from '../config/store';
import { dbGetMeta, dbSetMeta } from '../storage/indexedDb';

export const ADMIN_SESSION_KEY = 'flex_admin_auth_v1';
export const ADMIN_PASSWORD_STORAGE_KEY = 'flex_admin_owner_password_v1';

export function getStoredAdminPassword(storage?: Pick<Storage, 'getItem'> | null): string {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    const saved = store?.getItem(ADMIN_PASSWORD_STORAGE_KEY);
    if (saved && saved.trim().length > 0) {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  return STORE_CONFIG.defaultAdminPassword;
}

export function verifyAdminPassword(
  candidate: string,
  storage?: Pick<Storage, 'getItem'> | null
): boolean {
  const trimmed = candidate.trim();
  if (!trimmed) return false;
  return trimmed === getStoredAdminPassword(storage);
}

export function changeAdminPassword(
  params: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  },
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
): { ok: true } | { ok: false; error: string } {
  const current = params.currentPassword.trim();
  const next = params.newPassword.trim();
  const confirm = params.confirmPassword.trim();

  if (!verifyAdminPassword(current, storage)) {
    return { ok: false, error: 'Current admin password is incorrect.' };
  }
  if (next.length < 6) {
    return { ok: false, error: 'New password must be at least 6 characters long.' };
  }
  if (next !== confirm) {
    return { ok: false, error: 'New password and confirmation do not match.' };
  }

  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    store?.setItem(ADMIN_PASSWORD_STORAGE_KEY, next);
  } catch {
    return { ok: false, error: 'Unable to save password in browser storage.' };
  }

  void dbSetMeta(ADMIN_PASSWORD_STORAGE_KEY, next);
  return { ok: true };
}

export async function hydrateAdminPasswordFromDb(): Promise<void> {
  try {
    if (typeof localStorage === 'undefined') return;
    const existing = localStorage.getItem(ADMIN_PASSWORD_STORAGE_KEY);
    if (existing && existing.trim().length > 0) return;
    const dbSaved = await dbGetMeta<string>(ADMIN_PASSWORD_STORAGE_KEY);
    if (dbSaved && dbSaved.trim().length > 0) {
      localStorage.setItem(ADMIN_PASSWORD_STORAGE_KEY, dbSaved);
    }
  } catch {
    // ignore
  }
}
