'use strict';

// The main source is shared with the userscript build. This small adapter maps
// its cross-manager API surface to Manifest V3 without changing copy logic.
(() => {
  const RELAY_INSTALL_EVENT = 'clean-math-copy-extension-relay-install-v1';
  const RELAY_ACK_ATTRIBUTE = 'data-clean-math-copy-relay-install-ack';
  const RELAY_ID_PATTERN = /^clean-math-copy-relay-(?:[0-9a-z]{1,7}-){3}[0-9a-z]{1,7}$/;
  const RELAY_EVENT_PATTERN = /^clean-math-copy-request-(?:[0-9a-z]{1,7}-){3}[0-9a-z]{1,7}$/;
  const listeners = new Map();
  let nextListenerId = 0;
  let nextMenuId = 0;
  const info = Object.freeze({
    injectInto: 'content',
    scriptHandler: 'Clean Math Copy extension'
  });

  const getValue = (key, fallback) => new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      if (chrome.runtime.lastError) resolve(fallback);
      else resolve(Object.prototype.hasOwnProperty.call(result, key) ? result[key] : fallback);
    });
  });
  const setValue = (key, value) => new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
  const addValueChangeListener = (key, callback) => {
    const id = ++nextListenerId;
    const listener = (changes, areaName) => {
      if (areaName !== 'local' || !changes[key]) return;
      callback(key, changes[key].oldValue, changes[key].newValue, true);
    };
    listeners.set(id, listener);
    chrome.storage.onChanged.addListener(listener);
    return id;
  };
  const getResourceUrl = (name) => {
    const filenames = {
      clean_math_copy_pdfjs: 'pdf.min.mjs',
      clean_math_copy_pdfjs_worker: 'pdf.worker.min.mjs'
    };
    const filename = filenames[name];
    if (!filename) throw new Error('Unknown bundled resource: ' + String(name));
    return chrome.runtime.getURL('extension/vendor/' + filename);
  };
  const getResourceText = (name) => {
    const url = getResourceUrl(name);
    return globalThis.fetch(url).then((response) => {
      if (!response.ok) throw new Error('Bundled PDF resource could not be read.');
      return response.text();
    });
  };
  const addElement = (parent, tagName, attributes) => {
    const element = document.createElement(tagName);
    for (const [name, value] of Object.entries(attributes || {})) element[name] = value;
    parent.appendChild(element);
    return element;
  };
  const setClipboard = (text) => navigator.clipboard && navigator.clipboard.writeText
    ? navigator.clipboard.writeText(String(text))
    : Promise.reject(new Error('Clipboard API unavailable.'));
  const installPageRelay = (carrierId, eventName, googleDocs) => {
    if (!RELAY_ID_PATTERN.test(String(carrierId || '')) ||
        !RELAY_EVENT_PATTERN.test(String(eventName || '')) ||
        typeof googleDocs !== 'boolean') return false;
    const carrier = document.getElementById(carrierId);
    if (!carrier || carrier.ownerDocument !== document ||
        carrier.parentNode !== document.documentElement ||
        carrier.localName !== 'span' || !carrier.hidden ||
        carrier.getAttribute('aria-hidden') !== 'true' ||
        carrier.getAttribute('data-clean-math-copy-relay-ready') === '1') return false;
    const cryptoObject = globalThis.crypto;
    if (!cryptoObject || typeof cryptoObject.getRandomValues !== 'function') return false;
    const random = new Uint32Array(4);
    try { cryptoObject.getRandomValues(random); }
    catch (_error) { return false; }
    const nonce = Array.from(random, (value) => value.toString(36)).join('-');
    const payload = JSON.stringify({
      version: 1,
      eventName,
      googleDocs,
      nonce
    });
    const dispatchEvent = EventTarget.prototype.dispatchEvent;
    const getAttribute = Element.prototype.getAttribute;
    const removeAttribute = Element.prototype.removeAttribute;
    try {
      carrier.textContent = payload;
      Reflect.apply(dispatchEvent, carrier, [new Event(RELAY_INSTALL_EVENT)]);
      return Reflect.apply(getAttribute, carrier, ['data-clean-math-copy-relay-ready']) === '1' &&
        Reflect.apply(getAttribute, carrier, [RELAY_ACK_ATTRIBUTE]) === nonce;
    } catch (_error) {
      return false;
    } finally {
      try { carrier.textContent = ''; } catch (_error) { /* ignore */ }
      try { Reflect.apply(removeAttribute, carrier, [RELAY_ACK_ATTRIBUTE]); } catch (_error) { /* ignore */ }
    }
  };

  globalThis.GM_getValue = getValue;
  globalThis.GM_setValue = setValue;
  globalThis.GM_addValueChangeListener = addValueChangeListener;
  globalThis.GM_registerMenuCommand = () => ++nextMenuId;
  globalThis.GM_unregisterMenuCommand = () => undefined;
  globalThis.GM_getResourceURL = getResourceUrl;
  globalThis.GM_getResourceText = getResourceText;
  globalThis.GM_addElement = addElement;
  globalThis.GM_setClipboard = setClipboard;
  globalThis.GM_info = info;
  Object.defineProperty(globalThis, 'GM_cleanMathCopyInstallPageRelay', {
    value: installPageRelay,
    configurable: false,
    enumerable: false,
    writable: false
  });
  globalThis.unsafeWindow = window;
  globalThis.GM = {
    info,
    getValue,
    setValue,
    addValueChangeListener,
    registerMenuCommand: () => Promise.resolve(++nextMenuId),
    unregisterMenuCommand: () => Promise.resolve(),
    getResourceUrl,
    getResourceText,
    addElement,
    setClipboard
  };

})();
