/**
 * Safari compatibility polyfills.
 *
 * These APIs are available in Safari 16+, Chrome 103+, Firefox 100+.
 * For older browsers (especially Safari < 16), we provide fallbacks.
 */

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
