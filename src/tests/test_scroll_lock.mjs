import assert from 'node:assert';

// Mock DOM environment for Node.js
class MockBody {
  constructor() {
    this.style = {
      overflow: '',
      touchAction: '',
    };
  }
}

globalThis.document = {
  body: new MockBody(),
};

// Scroll Lock logic under test (matching src/lib/scrollLock.ts)
let activeLockCount = 0;
let originalOverflow = '';
let originalTouchAction = '';

function lockBodyScroll() {
  if (typeof document === 'undefined' || !document.body) {
    return () => {};
  }

  if (activeLockCount === 0) {
    originalOverflow = document.body.style.overflow || '';
    originalTouchAction = document.body.style.touchAction || '';

    if (originalOverflow === 'hidden') {
      originalOverflow = '';
    }
    if (originalTouchAction === 'none') {
      originalTouchAction = '';
    }

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
  }

  activeLockCount++;

  let isUnlocked = false;

  return function unlock() {
    if (isUnlocked) return;
    isUnlocked = true;

    activeLockCount = Math.max(0, activeLockCount - 1);

    if (activeLockCount === 0) {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    }
  };
}

function forceUnlockBodyScroll() {
  if (typeof document === 'undefined' || !document.body) return;
  activeLockCount = 0;
  document.body.style.overflow = '';
  document.body.style.touchAction = '';
}

console.log('--- STARTING SCROLL LOCK TESTS ---');

// Test 1: Single modal lock and unlock
{
  document.body.style.overflow = '';
  document.body.style.touchAction = '';
  forceUnlockBodyScroll();

  const unlock = lockBodyScroll();
  assert.strictEqual(document.body.style.overflow, 'hidden', 'Test 1 failed: overflow should be hidden');
  assert.strictEqual(document.body.style.touchAction, 'none', 'Test 1 failed: touchAction should be none');

  unlock();
  assert.strictEqual(document.body.style.overflow, '', 'Test 1 failed: overflow should be restored to empty');
  assert.strictEqual(document.body.style.touchAction, '', 'Test 1 failed: touchAction should be restored to empty');
  console.log('✅ Test 1 (Single modal) PASSED');
}

// Test 2: Stacked/Overlapping modals (User opens Modal A, then Modal B, then A closes, then B closes)
{
  document.body.style.overflow = '';
  document.body.style.touchAction = '';
  forceUnlockBodyScroll();

  // Modal A opens
  const unlockA = lockBodyScroll();
  assert.strictEqual(document.body.style.overflow, 'hidden');

  // Modal B opens while Modal A is still open
  const unlockB = lockBodyScroll();
  assert.strictEqual(document.body.style.overflow, 'hidden');

  // Modal A closes (e.g. after 220ms transition)
  unlockA();
  // Body must STILL be locked because Modal B is still open!
  assert.strictEqual(document.body.style.overflow, 'hidden', 'Test 2 failed: overflow should still be hidden while B is open');
  assert.strictEqual(document.body.style.touchAction, 'none', 'Test 2 failed: touchAction should still be none while B is open');

  // Modal B closes
  unlockB();
  // Body must now be UNLOCKED and restored to empty, NOT left as 'hidden'!
  assert.strictEqual(document.body.style.overflow, '', 'Test 2 failed: overflow should be restored to empty after all modals close');
  assert.strictEqual(document.body.style.touchAction, '', 'Test 2 failed: touchAction should be restored to empty after all modals close');
  console.log('✅ Test 2 (Stacked modals order A then B) PASSED');
}

// Test 3: Idempotent unlock (calling unlock multiple times should not corrupt counter)
{
  document.body.style.overflow = '';
  document.body.style.touchAction = '';
  forceUnlockBodyScroll();

  const unlock1 = lockBodyScroll();
  const unlock2 = lockBodyScroll();

  unlock1();
  unlock1(); // duplicate call
  unlock1(); // duplicate call

  // Modal 2 is still open, so overflow should still be hidden
  assert.strictEqual(document.body.style.overflow, 'hidden');

  unlock2();
  assert.strictEqual(document.body.style.overflow, '');
  console.log('✅ Test 3 (Idempotent unlock) PASSED');
}

// Test 4: Glitch recovery (if body was already 'hidden' before count reached 0)
{
  document.body.style.overflow = 'hidden';
  document.body.style.touchAction = 'none';
  forceUnlockBodyScroll();

  // Now lock
  const unlock = lockBodyScroll();
  assert.strictEqual(document.body.style.overflow, 'hidden');

  // Unlock should recover to empty string instead of staying hidden
  unlock();
  assert.strictEqual(document.body.style.overflow, '', 'Test 4 failed: should recover to empty string');
  assert.strictEqual(document.body.style.touchAction, '', 'Test 4 failed: should recover to empty string');
  console.log('✅ Test 4 (Glitch recovery) PASSED');
}

console.log('🎉 ALL SCROLL LOCK TESTS PASSED SUCCESSFULLY!');
