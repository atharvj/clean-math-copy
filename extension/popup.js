'use strict';

const SETTINGS_KEY = 'cleanMathCopy.settings.v3';
const buttons = Array.from(document.querySelectorAll('button[data-mode]'));
const MODES = new Set(buttons.map((button) => button.dataset.mode));

function showMode(candidate) {
  const mode = MODES.has(candidate) ? candidate : 'faithful';
  for (const button of buttons) {
    const active = button.dataset.mode === mode;
    button.setAttribute('aria-pressed', String(active));
    button.textContent = (active ? '✓ ' : '') + button.dataset.label;
  }
}

let storageRevision = 0;
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[SETTINGS_KEY]) return;
  storageRevision += 1;
  const stored = changes[SETTINGS_KEY].newValue;
  showMode(stored && stored.outputMode || 'faithful');
});

const readRevision = storageRevision;
chrome.storage.local.get(SETTINGS_KEY, (result) => {
  if (storageRevision !== readRevision) return;
  const stored = result[SETTINGS_KEY];
  showMode(stored && stored.outputMode || 'faithful');
});

for (const button of buttons) {
  button.addEventListener('click', () => {
    const outputMode = button.dataset.mode;
    chrome.storage.local.set({ [SETTINGS_KEY]: { outputMode } }, () => {
      if (!chrome.runtime.lastError) showMode(outputMode);
    });
  });
}
