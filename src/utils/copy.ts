export type CopyFormat = 'table-row' | 'labeled-text' | 'natural-summary';

export function copyFieldValue(value: string | null): boolean {
  if (!value) return false;
  try {
    navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function formatTableRow(
  papers: { fields: Record<string, string | null>; headers: string[] }[]
): string {
  if (papers.length === 0) return '';

  // Use headers from first paper, filter out images and null-only fields
  const allHeaders = papers[0]?.headers || [];
  const headerOrder = allHeaders.filter(h => {
    return papers.some(p => p.fields[h] && p.fields[h] !== '');
  });

  const rows = papers.map(p => {
    return headerOrder.map(h => p.fields[h] || '').join('\t');
  });

  return [headerOrder.join('\t'), ...rows].join('\n');
}

export function formatLabeledText(fields: Record<string, string | null>, labels: Record<string, string>): string {
  return Object.entries(fields)
    .filter(([, v]) => v && v !== '')
    .map(([k, v]) => `${labels[k] || k}: ${v}`)
    .join('\n');
}

export function formatNaturalSummary(fields: Record<string, string | null>): string {
  const authors = fields.authors || 'Unknown';
  const year = fields.year || '';
  const method = fields.research_method || '';
  const theory = fields.research_theory || '';
  const iv = fields.iv || '';
  const dv = fields.dv || '';
  const conclusion = fields.conclusion || '';

  const parts: string[] = [];
  if (authors && year) parts.push(`${authors} (${year})`);
  if (method) parts.push(`采用${method}`);
  if (theory) parts.push(`基于${theory}`);
  if (iv && dv) parts.push(`研究了${iv}对${dv}的影响`);
  if (conclusion) parts.push(`发现${conclusion}`);

  return parts.length > 0 ? parts.join('，') + '。' : '';
}

export function copyToClipboard(text: string): boolean {
  try {
    navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
