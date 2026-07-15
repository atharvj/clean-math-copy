'use strict';

// This artifact is the CSP-safe MAIN-world companion to the shared userscript.
// tests/extension.test.js enforces byte-for-byte function-source parity.
(() => {
function cleanMathCopyPageRelayMain(carrierId, eventName, relayGoogleDocs) {
    'use strict';
    const carrier = document.getElementById(carrierId);
    if (!carrier || carrier.getAttribute('data-clean-math-copy-relay-ready') === '1') return;
    const objectDefineProperty = Object.defineProperty;
    const objectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
    const reflectApply = Reflect.apply;
    const reflectDeleteProperty = Reflect.deleteProperty;
    const jsonParse = JSON.parse;
    const jsonStringify = JSON.stringify;
    const dispatchEvent = EventTarget.prototype.dispatchEvent;
    const addEventListener = EventTarget.prototype.addEventListener;
    const CustomEventConstructor = CustomEvent;
    const scheduleTask = typeof setTimeout === 'function' ? setTimeout : null;
    const valueLimit = 1024 * 1024;
    // Clipboard events from the Google Docs editor fire in an about:blank
    // iframe, so the child location cannot identify which site owns it.
    const googleDocs = Boolean(relayGoogleDocs);
    const relayedType = (type) => {
      const normalized = String(type || '').toLowerCase();
      return /^(?:text\/plain|text|unicode)$/i.test(normalized) ||
        ['application/mathml+xml', 'mathml', 'mathml presentation', 'text/html', 'html format'].includes(normalized) ||
        (googleDocs && normalized === 'application/x-vnd.google-docs-document-slice-clip+wrapped');
    };
    let serial = 0;
    const pageCopyEvents = new WeakMap();

    const patchMethod = (target, name, replacement) => {
      let previous;
      try {
        previous = objectGetOwnPropertyDescriptor(target, name);
        objectDefineProperty(target, name, {
          value: replacement,
          configurable: true,
          enumerable: previous ? Boolean(previous.enumerable) : false,
          writable: true
        });
        return { target, name, previous, replacement };
      } catch (_error) {
        return null;
      }
    };
    const restoreMethod = (record) => {
      if (!record) return;
      try {
        const current = objectGetOwnPropertyDescriptor(record.target, record.name);
        if (!current || current.value !== record.replacement) return;
        if (record.previous) objectDefineProperty(record.target, record.name, record.previous);
        else reflectDeleteProperty(record.target, record.name);
      } catch (_error) {
        // Never overwrite a page replacement made after this relay installed.
      }
    };

    const onCopy = (event) => {
      const data = event && event.clipboardData;
      if (!data || typeof data.setData !== 'function') return;
      const nativeSet = data.setData;
      const nativeGet = typeof data.getData === 'function' ? data.getData : null;
      const nativeClear = typeof data.clearData === 'function' ? data.clearData : null;
      const eventId = String(++serial) + '-' + String(Date.now());
      let active = true;
      // Some editors (notably the current Google Docs canvas editor) call a
      // cached DataTransfer prototype method. That bypasses an own setData
      // wrapper even though the final MIME values remain readable on the
      // event. Keep the page's values separate from relay-injected rewrites so
      // a final snapshot can forward only writes the wrappers did not observe.
      const nativeValues = new Map();
      const injectedValues = new Map();
      const normalizedType = (type) => String(type == null ? '' : type).toLowerCase();

      const request = (op, type, value, all) => {
        if (!active || !carrier.isConnected) return null;
        let source = '';
        let overflow = false;
        try {
          source = typeof value === 'string' ? value : String(value == null ? '' : value);
          if (source.length > valueLimit) {
            source = '';
            overflow = true;
          }
          carrier.textContent = jsonStringify({
            id: eventId,
            op,
            type: String(type == null ? '' : type).slice(0, 256),
            value: source,
            overflow,
            all: Boolean(all)
          });
          reflectApply(dispatchEvent, carrier, [new CustomEventConstructor(eventName)]);
          const response = jsonParse(carrier.textContent || '{}');
          carrier.textContent = '';
          if (!response || response.id !== eventId) return null;
          if (response.action === 'write' && typeof response.text === 'string') {
            const requestedType = response.type || 'text/plain';
            const requestedKey = normalizedType(requestedType);
            const writes = [];
            if (injectedValues.get(requestedKey) !== response.text) {
              writes.push({ type: requestedType, key: requestedKey, text: response.text });
            }
            if (requestedKey !== 'text/plain' && injectedValues.get('text/plain') !== response.text) {
              writes.push({ type: 'text/plain', key: 'text/plain', text: response.text });
            }
            for (const item of Array.isArray(response.richWrites) ? response.richWrites.slice(0, 2) : []) {
              if (!item || typeof item.type !== 'string' || typeof item.text !== 'string') continue;
              const itemKey = normalizedType(item.type);
              if (injectedValues.get(itemKey) === item.text) continue;
              writes.push({ type: item.type, key: itemKey, text: item.text });
            }
            // Every accepted flavor is one transaction. If a browser rejects
            // a later rich write, restore the site's native values (or remove
            // newly introduced flavors) before leaving the event uncancelled.
            if (!nativeClear && writes.some((write) => !nativeValues.has(write.key))) {
              throw new TypeError('Cannot roll back relayed clipboard write');
            }
            const applied = [];
            try {
              for (const write of writes) {
                reflectApply(nativeSet, data, [write.type, write.text]);
                applied.push(write);
                injectedValues.set(write.key, write.text);
              }
            } catch (writeError) {
              const restored = new Set();
              for (let index = applied.length - 1; index >= 0; index -= 1) {
                const write = applied[index];
                if (restored.has(write.key)) continue;
                restored.add(write.key);
                const native = nativeValues.get(write.key);
                try {
                  if (native) reflectApply(nativeSet, data, [native.type, native.value]);
                  else if (nativeClear) reflectApply(nativeClear, data, [write.type]);
                } catch (_restoreError) {
                  // Best effort; never cancel an event after a failed rewrite.
                }
                injectedValues.delete(write.key);
              }
              throw writeError;
            }
          } else if (response.action === 'restore') {
            for (const item of Array.isArray(response.writes) ? response.writes.slice(0, 4) : []) {
              if (item && typeof item.type === 'string' && typeof item.text === 'string') {
                reflectApply(nativeSet, data, [item.type, item.text]);
                injectedValues.delete(normalizedType(item.type));
              }
            }
            if (nativeClear) {
              for (const plainType of Array.isArray(response.clears) ? response.clears.slice(0, 4) : []) {
                if (typeof plainType === 'string') {
                  reflectApply(nativeClear, data, [plainType]);
                  injectedValues.delete(normalizedType(plainType));
                }
              }
            }
          } else if (response.action === 'clear' && nativeClear) {
            for (const plainType of ['text/plain', 'text', 'unicode']) {
              try { reflectApply(nativeClear, data, [plainType]); } catch (_error) { /* try remaining aliases */ }
              injectedValues.delete(plainType);
            }
          }
          if (response.prevent) event.preventDefault();
          return response;
        } catch (_error) {
          try { carrier.textContent = ''; } catch (_carrierError) { /* ignore */ }
          return null;
        }
      };

      const beginResponse = request('begin', '', '', false);
      if (!beginResponse) {
        // The private carrier can be removed by a document rewrite or become
        // unavailable during teardown. Without a live controller there is
        // nothing to relay, so never patch page-owned event/DataTransfer APIs.
        active = false;
        try { carrier.textContent = ''; } catch (_error) { /* ignore */ }
        return;
      }
      if (beginResponse && beginResponse.action === 'bypass') {
        // The userscript is in Original copy/paste mode. Leave DataTransfer,
        // propagation methods, clipboard formats, and default handling wholly
        // untouched for this event.
        active = false;
        carrier.textContent = '';
        return;
      }
      const captureAllNativeFormats = Boolean(beginResponse && beginResponse.action === 'capture');
      const recordNativeSet = (actualType, actualValue) => {
        if (!captureAllNativeFormats && !relayedType(actualType)) return;
        const key = normalizedType(actualType);
        nativeValues.set(key, { type: actualType, value: actualValue });
        injectedValues.delete(key);
        request('set', actualType, actualValue, false);
      };
      const recordNativeClear = (actualType, all) => {
        if (all) {
          nativeValues.clear();
          injectedValues.clear();
          request('clear', actualType, '', true);
        } else if (captureAllNativeFormats || relayedType(actualType)) {
          const key = normalizedType(actualType);
          nativeValues.delete(key);
          injectedValues.delete(key);
          request('clear', actualType, '', false);
        }
      };
      const wrappedSet = function cleanMathCopyRelayedSetData(type, value) {
        // WebIDL DOMString conversion occurs before the native call. Reuse the
        // exact coerced strings so a stateful toString cannot desynchronize the
        // clipboard from the semantic parser.
        const actualType = '' + type;
        const actualValue = '' + value;
        const result = reflectApply(nativeSet, this, [actualType, actualValue]);
        recordNativeSet(actualType, actualValue);
        return result;
      };
      const wrappedClear = function cleanMathCopyRelayedClearData(type) {
        const all = arguments.length === 0;
        const actualType = all ? '' : '' + type;
        const result = all
          ? reflectApply(nativeClear, this, [])
          : reflectApply(nativeClear, this, [actualType]);
        recordNativeClear(actualType, all);
        return result;
      };
      const setRecord = patchMethod(data, 'setData', wrappedSet);
      if (!setRecord) {
        request('end', '', '', false);
        active = false;
        carrier.textContent = '';
        return;
      }
      const clearRecord = nativeClear ? patchMethod(data, 'clearData', wrappedClear) : null;
      if (nativeClear && !clearRecord) {
        restoreMethod(setRecord);
        request('end', '', '', false);
        active = false;
        carrier.textContent = '';
        return;
      }
      const harvestFinalClipboard = () => {
        if (!nativeGet) return;
        let rawTypes;
        try {
          rawTypes = data.types;
          if (!rawTypes) return;
          rawTypes = Array.from(rawTypes);
        } catch (_error) {
          return;
        }
        const completeTypeList = rawTypes.length <= 256;
        rawTypes = rawTypes.slice(0, 256);
        // Read every value before forwarding any of them: a relay response can
        // rewrite text/plain, which must not contaminate this native snapshot.
        const snapshot = [];
        const present = new Set();
        for (const rawType of rawTypes) {
          const actualType = String(rawType == null ? '' : rawType).slice(0, 256);
          if (!captureAllNativeFormats && !relayedType(actualType)) continue;
          if (snapshot.length >= 32) break;
          const key = normalizedType(actualType);
          present.add(key);
          try {
            snapshot.push({
              key,
              type: actualType,
              value: String(reflectApply(nativeGet, data, [actualType]))
            });
          } catch (_error) {
            // Keep an earlier wrapper-observed value when this MIME flavor is
            // listed but the browser refuses to expose it through getData.
          }
        }
        for (const item of snapshot) {
          if (injectedValues.get(item.key) === item.value) continue;
          const previous = nativeValues.get(item.key);
          if (previous && previous.type === item.type && previous.value === item.value) continue;
          nativeValues.set(item.key, { type: item.type, value: item.value });
          injectedValues.delete(item.key);
          request('set', item.type, item.value, false);
        }
        // A cached clearData call bypasses the wrappers just like a cached
        // setData call. Remove any previously forwarded flavor now absent from
        // the authoritative final snapshot.
        if (completeTypeList && snapshot.length < 32) {
          for (const [key, previous] of Array.from(nativeValues)) {
            if (present.has(key)) continue;
            nativeValues.delete(key);
            injectedValues.delete(key);
            request('clear', previous.type, '', false);
          }
        }
      };
      const nativeStop = typeof event.stopPropagation === 'function' ? event.stopPropagation : null;
      const nativeStopImmediate = typeof event.stopImmediatePropagation === 'function'
        ? event.stopImmediatePropagation
        : null;
      const wrappedStop = function cleanMathCopyRelayedStopPropagation() {
        harvestFinalClipboard();
        // stopPropagation() still permits later listeners on the same target.
        // Native capture must keep observing those writes and finalize from the
        // cleanup task after dispatch; semantic rewriting still has to finish
        // synchronously while DataTransfer remains writable.
        if (!captureAllNativeFormats) request('finalize', '', '', false);
        return reflectApply(nativeStop, event, []);
      };
      const wrappedStopImmediate = function cleanMathCopyRelayedStopImmediatePropagation() {
        harvestFinalClipboard();
        // The calling listener continues after stopImmediatePropagation() and
        // may still write clipboard data. Native capture therefore remains
        // active until the post-dispatch task; semantic rewriting must still
        // finalize synchronously while DataTransfer is writable.
        if (!captureAllNativeFormats) request('finalize', '', '', false);
        return reflectApply(nativeStopImmediate, event, []);
      };
      const stopRecord = nativeStop ? patchMethod(event, 'stopPropagation', wrappedStop) : null;
      const stopImmediateRecord = nativeStopImmediate
        ? patchMethod(event, 'stopImmediatePropagation', wrappedStopImmediate)
        : null;

      const cleanupCopy = () => {
        if (!active) return;
        request('end', '', '', false);
        active = false;
        pageCopyEvents.delete(event);
        try { carrier.textContent = ''; } catch (_error) { /* ignore */ }
        restoreMethod(stopImmediateRecord);
        restoreMethod(stopRecord);
        restoreMethod(clearRecord);
        restoreMethod(setRecord);
      };
      const finishCopy = () => {
        if (!active) return;
        harvestFinalClipboard();
        request('finalize', '', '', false);
        cleanupCopy();
      };
      // A page can still write from a later window-bubble listener. Native
      // mode therefore keeps every wrapper live until the post-dispatch task;
      // this bubble hook only harvests cached/prototype writes seen so far.
      pageCopyEvents.set(event, captureAllNativeFormats ? harvestFinalClipboard : finishCopy);
      if (scheduleTask) {
        // A task runs after the full dispatch, unlike a microtask queued from
        // window capture (Chromium can checkpoint that before target
        // listeners). Normal semantic relay cleanup cannot write through an
        // expired DataTransfer. Native capture, however, has already recorded
        // each wrapped write and can safely queue that immutable snapshot now.
        reflectApply(scheduleTask, window, [captureAllNativeFormats ? finishCopy : cleanupCopy, 0]);
      }
    };

    const onCopyBubble = (event) => {
      const observeCopy = pageCopyEvents.get(event);
      if (observeCopy) observeCopy();
    };

    reflectApply(addEventListener, window, ['copy', onCopy, true]);
    reflectApply(addEventListener, window, ['copy', onCopyBubble, false]);
    carrier.setAttribute('data-clean-math-copy-relay-ready', '1');
  }

  const INSTALL_EVENT = 'clean-math-copy-extension-relay-install-v1';
  const READY_ATTRIBUTE = 'data-clean-math-copy-relay-ready';
  const ACK_ATTRIBUTE = 'data-clean-math-copy-relay-install-ack';
  const RELAY_ID_PATTERN = /^clean-math-copy-relay-(?:[0-9a-z]{1,7}-){3}[0-9a-z]{1,7}$/;
  const RELAY_EVENT_PATTERN = /^clean-math-copy-request-(?:[0-9a-z]{1,7}-){3}[0-9a-z]{1,7}$/;
  const NONCE_PATTERN = /^(?:[0-9a-z]{1,7}-){3}[0-9a-z]{1,7}$/;
  const reflectApply = Reflect.apply;
  const addEventListener = EventTarget.prototype.addEventListener;
  const removeEventListener = EventTarget.prototype.removeEventListener;
  const stopImmediatePropagation = Event.prototype.stopImmediatePropagation;
  const getAttribute = Element.prototype.getAttribute;
  const setAttribute = Element.prototype.setAttribute;
  const jsonParse = JSON.parse;
  const objectKeys = Object.keys;
  let installed = false;

  const onInstall = (event) => {
    // The extension's MAIN listener is registered before page scripts. Stop the
    // fixed handshake event before its one-time capability can reach the page.
    try { reflectApply(stopImmediatePropagation, event, []); } catch (_error) { return; }
    if (installed || !event || event.type !== INSTALL_EVENT || event.bubbles ||
        event.cancelable || event.composed || event.isTrusted) return;
    const carrier = event.target;
    if (!carrier || carrier.nodeType !== 1 || carrier.ownerDocument !== document ||
        carrier.parentNode !== document.documentElement || carrier.localName !== 'span' ||
        !carrier.hidden || !RELAY_ID_PATTERN.test(String(carrier.id || '')) ||
        reflectApply(getAttribute, carrier, ['aria-hidden']) !== 'true' ||
        reflectApply(getAttribute, carrier, [READY_ATTRIBUTE]) === '1') return;
    const attributeNames = Array.from(carrier.attributes || [], (attribute) => attribute.name).sort();
    if (attributeNames.join(',') !== 'aria-hidden,hidden,id') return;

    let source = '';
    try { source = String(carrier.textContent || ''); } catch (_error) { return; }
    // Clear the capability during document capture, before target/page
    // listeners and before MutationObserver delivery can inspect it.
    try { carrier.textContent = ''; } catch (_error) { return; }
    if (source.length < 64 || source.length > 512) return;

    let payload;
    try { payload = jsonParse(source); } catch (_error) { return; }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
        objectKeys(payload).sort().join(',') !== 'eventName,googleDocs,nonce,version' ||
        payload.version !== 1 || typeof payload.googleDocs !== 'boolean' ||
        !RELAY_EVENT_PATTERN.test(String(payload.eventName || '')) ||
        !NONCE_PATTERN.test(String(payload.nonce || '')) ||
        payload.eventName.slice('clean-math-copy-request-'.length) ===
          carrier.id.slice('clean-math-copy-relay-'.length)) return;

    try {
      cleanMathCopyPageRelayMain(carrier.id, payload.eventName, payload.googleDocs);
      if (reflectApply(getAttribute, carrier, [READY_ATTRIBUTE]) !== '1') return;
      reflectApply(setAttribute, carrier, [ACK_ATTRIBUTE, payload.nonce]);
      installed = true;
      reflectApply(removeEventListener, document, [INSTALL_EVENT, onInstall, true]);
    } catch (_error) {
      // The isolated controller falls back without weakening native copying.
    }
  };

  reflectApply(addEventListener, document, [INSTALL_EVENT, onInstall, true]);
})();
