import * as pdfjsLib from 'pdfjs-dist';

// Safari does not fully support ES module web workers (.mjs).
// Force PDF.js to run on the main thread for cross-browser compatibility.
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

export interface ParsedPDF {
  fullText: string;
  pageCount: number;
}

export async function parsePDF(file: File): Promise<ParsedPDF> {
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
