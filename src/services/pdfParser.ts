import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/**
 * Safari compatibility: fetch the worker script and create a blob URL.
 *
 * Safari has known issues with ES module web workers (.mjs files).
 * The pdf.worker.min.mjs file is a self-contained bundle (no top-level
 * import/export), so it works perfectly as a classic worker script.
 *
 * By loading it via a blob URL, we ensure the browser treats it as a
 * classic worker (not a module worker), which Safari handles correctly.
 */
let workerReady: Promise<void> | null = null;

function ensureWorker(): Promise<void> {
  if (workerReady) return workerReady;

  workerReady = (async () => {
    try {
      const response = await fetch(workerUrl);
      if (!response.ok) throw new Error(`Failed to fetch worker: ${response.status}`);
      const code = await response.text();
      const blob = new Blob([code], { type: 'application/javascript' });
      pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
    } catch {
      // Fallback: use the direct URL (works in Chrome, Firefox, and Safari 16+)
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
    }
  })();

  return workerReady;
}

// Start loading the worker immediately (don't wait for first PDF drop)
ensureWorker();

export interface ParsedPDF {
  fullText: string;
  pageCount: number;
}

export async function parsePDF(file: File): Promise<ParsedPDF> {
  // Ensure the worker is set up before parsing
  await ensureWorker();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pageCount = pdf.numPages;
  const textParts: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    textParts.push(pageText);
  }

  return {
    fullText: textParts.join('\n\n'),
    pageCount,
  };
}
