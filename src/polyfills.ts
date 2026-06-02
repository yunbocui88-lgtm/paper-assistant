/**
 * Safari compatibility polyfills.
 *
 * These APIs are available in Safari 16+, Chrome 103+, Firefox 100+.
 * For older browsers (especially Safari < 16), we provide fallbacks.
 */

// ── Array.prototype.at() / String.prototype.at() ──────────────────────
// Safari 15.4+, Chrome 92+, Firefox 90+. Used by pdfjs-dist (15+ times).
if (typeof Array.prototype.at !== 'function') {
  Array.prototype.at = function (index: number) {
    const len = this.length;
    const relativeIndex = index < 0 ? len + index : index;
    if (relativeIndex < 0 || relativeIndex >= len) return undefined;
    return this[relativeIndex];
  };
}
if (typeof String.prototype.at !== 'function') {
  String.prototype.at = function (index: number) {
    const len = this.length;
    const relativeIndex = index < 0 ? len + index : index;
    if (relativeIndex < 0 || relativeIndex >= len) return undefined;
    return this[relativeIndex];
  };
}

// ── Array.prototype.findLast() / findLastIndex() ────────────────────────
// Safari 15.4+, Chrome 97+, Firefox 104+. Used by pdfjs-dist.
if (typeof Array.prototype.findLast !== 'function') {
  Array.prototype.findLast = function (predicate: any, thisArg?: any) {
    for (let i = this.length - 1; i >= 0; i--) {
      if (i in this && predicate.call(thisArg, this[i], i, this)) return this[i];
    }
    return undefined;
  };
}
if (typeof Array.prototype.findLastIndex !== 'function') {
  Array.prototype.findLastIndex = function (predicate: any, thisArg?: any) {
    for (let i = this.length - 1; i >= 0; i--) {
      if (i in this && predicate.call(thisArg, this[i], i, this)) return i;
    }
    return -1;
  };
}

// ── structuredClone(obj) ───────────────────────────────────────────────
// Safari 15.4+, Chrome 98+, Firefox 94+. Used by pdfjs-dist for annotations.
const G: any = typeof globalThis !== 'undefined' ? globalThis : window;
if (typeof G.structuredClone !== 'function') {
  G.structuredClone = function (obj: any, _options?: any) {
    return JSON.parse(JSON.stringify(obj));
  };
}

// ── Promise.withResolvers() ──────────────────────────────────────────────
// Safari 17.4+, Chrome 119+, Firefox 121+. Used extensively by pdfjs-dist.
if (typeof (Promise as any).withResolvers !== 'function') {
  (Promise as any).withResolvers = function () {
    let resolve: any, reject: any;
    const promise = new Promise((res: any, rej: any) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// ── Uint8Array.prototype.toHex() ─────────────────────────────────────────
// Chrome 126+, Safari 17.4+, Firefox 129+. Used by pdfjs-dist v6.
// Without this polyfill, older browsers (WeChat, QQ, Safari < 17.4) crash
// with "a.toHex is not a function" or "undefined is not a function".
if (typeof (Uint8Array.prototype as any).toHex !== 'function') {
  (Uint8Array.prototype as any).toHex = function (this: Uint8Array): string {
    let hex = '';
    for (let i = 0; i < this.length; i++) {
      hex += (this[i] >> 4).toString(16) + (this[i] & 0xf).toString(16);
    }
    return hex;
  };
}

// ── AbortSignal.timeout(ms) ──────────────────────────────────────────────
if (typeof AbortSignal.timeout !== 'function') {
  AbortSignal.timeout = function (ms: number): AbortSignal {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), ms);
    return controller.signal;
  };
}

// ── AbortSignal.any(signals) ─────────────────────────────────────────────
// Used internally by pdfjs-dist. Without this, PDF.js crashes on Safari < 16.
if (typeof AbortSignal.any !== 'function') {
  AbortSignal.any = function (signals: AbortSignal[]): AbortSignal {
    // If any signal is already aborted, return it
    for (const signal of signals) {
      if (signal.aborted) return signal;
    }
    const controller = new AbortController();
    for (const signal of signals) {
      signal.addEventListener('abort', () => {
        controller.abort(signal.reason);
      }, { once: true });
    }
    return controller.signal;
  };
}
