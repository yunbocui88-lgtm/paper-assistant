// Simple URL text fetcher — uses a CORS proxy
// For production, deploy the Vercel Edge Function proxy
// For now, uses allorigins.win as a fallback public proxy

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

export async function fetchURLText(url: string): Promise<string> {
  try {
    // First try direct fetch (some sites allow CORS)
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (response.ok) {
      const html = await response.text();
      return extractTextFromHTML(html);
    }
  } catch {
    // Direct fetch failed, try proxy
  }

  // Fallback to CORS proxy
  const proxyResponse = await fetch(CORS_PROXY + encodeURIComponent(url), {
    signal: AbortSignal.timeout(15000),
  });

  if (!proxyResponse.ok) {
    throw new Error(`无法抓取网页 (${proxyResponse.status})`);
  }

  const html = await proxyResponse.text();
  return extractTextFromHTML(html);
}

function extractTextFromHTML(html: string): string {
  // Simple HTML to text extraction
  const withoutScripts = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  const withoutStyles = withoutScripts.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  const text = withoutStyles.replace(/<[^>]+>/g, ' ');
  const decoded = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  const cleaned = decoded.replace(/\s+/g, ' ').trim();
  return cleaned.slice(0, 15000); // Truncate to avoid huge prompts
}
