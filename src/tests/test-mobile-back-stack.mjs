// Test exact stack dispatcher logic with internal back flag
console.log('🧪 Testing Precise Mobile Back Dispatcher...');

const activeHandlers = [];
let isInternalBack = false;

function registerHandler(id, onBack) {
  const handler = { id, onBack, isPushed: true };
  activeHandlers.push(handler);
  return {
    cleanup: (wasClosedByHWBack) => {
      const idx = activeHandlers.findIndex(h => h.id === id);
      if (idx !== -1) activeHandlers.splice(idx, 1);
      if (!wasClosedByHWBack && handler.isPushed) {
        handler.isPushed = false;
        // Trigger internal back
        isInternalBack = true;
        simulatePopstate(); // fires popstate from internal back
      }
    }
  };
}

function simulatePopstate() {
  if (isInternalBack) {
    isInternalBack = false;
    // Internal back ignored!
    return;
  }
  if (activeHandlers.length > 0) {
    const top = activeHandlers[activeHandlers.length - 1];
    top.isPushed = false;
    top.onBack();
  }
}

let storeClosed = false;
let cameraClosed = false;

// 1. User opens store form
const storeHandler = registerHandler('store', () => { storeClosed = true; });

// 2. User opens camera modal
const cameraHandler = registerHandler('camera', () => { cameraClosed = true; });

console.log('Registered Store and Camera. Total active:', activeHandlers.length);

// 3. User closes camera via X button (UI click, not HW back)
console.log('User closes camera via UI (X button)...');
cameraHandler.cleanup(false); // UI close

console.log('After UI close of Camera:');
console.log('- Camera closed via UI');
console.log('- Store closed?', storeClosed, '(MUST BE FALSE!)');
console.log('- Remaining active handlers:', activeHandlers.length, '(MUST BE 1)');

if (!storeClosed && activeHandlers.length === 1) {
  console.log('✓ Scenario 1 Pass: Closing camera via UI did NOT close store!');
} else {
  console.error('❌ Scenario 1 Fail!');
  process.exit(1);
}

// 4. Now user presses HW Back button -> Store should close!
console.log('User presses HW Back button...');
simulatePopstate();

console.log('After HW Back: Store closed?', storeClosed, '(MUST BE TRUE!)');
if (storeClosed) {
  storeHandler.cleanup(true);
  console.log('✓ Scenario 2 Pass: HW Back properly closed store!');
} else {
  console.error('❌ Scenario 2 Fail!');
  process.exit(1);
}

console.log('🎉 ALL SCENARIOS PASSED PERFECTLY!');
