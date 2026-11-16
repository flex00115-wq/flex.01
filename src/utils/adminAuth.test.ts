import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_PASSWORD_STORAGE_KEY,
  changeAdminPassword,
  getStoredAdminPassword,
  verifyAdminPassword,
} from './adminAuth';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

test('default owner admin password is flex2026x', () => {
  const storage = createMemoryStorage();
  assert.equal(getStoredAdminPassword(storage), 'flex2026x');
  assert.equal(verifyAdminPassword('flex2026x', storage), true);
  assert.equal(verifyAdminPassword('FLEX2026', storage), false);
});

test('changeAdminPassword validates current password, length, and match before updating', () => {
  const storage = createMemoryStorage();

  const badCurrent = changeAdminPassword(
    { currentPassword: 'wrong', newPassword: 'newpass99', confirmPassword: 'newpass99' },
    storage
  );
  assert.equal(badCurrent.ok, false);

  const tooShort = changeAdminPassword(
    { currentPassword: 'flex2026x', newPassword: '123', confirmPassword: '123' },
    storage
  );
  assert.equal(tooShort.ok, false);

  const mismatch = changeAdminPassword(
    { currentPassword: 'flex2026x', newPassword: 'secret77', confirmPassword: 'secret88' },
    storage
  );
  assert.equal(mismatch.ok, false);

  const success = changeAdminPassword(
    { currentPassword: 'flex2026x', newPassword: 'myNewPass2027', confirmPassword: 'myNewPass2027' },
    storage
  );
  assert.equal(success.ok, true);
  assert.equal(storage.getItem(ADMIN_PASSWORD_STORAGE_KEY), 'myNewPass2027');
  assert.equal(verifyAdminPassword('flex2026x', storage), false);
  assert.equal(verifyAdminPassword('myNewPass2027', storage), true);
});
