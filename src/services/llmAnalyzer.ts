import type { ApiConfig, Paper } from '../types';
import { TRANSLATABLE_FIELDS } from '../types';
import { v4 as uuid } from 'uuid';

const STANDARD_KEYS = new Set([
  'title', 'year', 'journal_level', 'authors', 'abstract',
  'model_diagram_description', 'model_type', 'conclusion',
  'research_theory', 'research_method', 'iv', 'dv', 'dv_direction',
  'mediator', 'moderator', 'field', 'research_subject',
  'antecedent_outcome', 'article_type', 'features',
]);

const ALL_STANDARD_FIELDS: [string, string][] = [
  ['title', '论文标题（字符串）'],
  ['year', '发表年份（数字，如 2024）'],
  ['journal_level', '期刊级别（如 SSCI Q1, SCI Q2, CSSCI, 北大核心 等，字符串或null）'],
  ['authors', '作者列表（字符串，逗号分隔）'],
  ['abstract', '摘要（字符串）'],
  ['model_diagram_description', '论文中理论模型/框架图的文字描述，没有则 null'],
  ['model_type', '模型类型（如 结构方程模型、回归模型、TAM、UTAUT 等，字符串或null）'],
  ['conclusion', '一句话核心结论（字符串）'],
  ['research_theory', '研究理论（如 TAM理论、资源基础观、制度理论 等，字符串或null）'],
  ['research_method', '研究方法（如 问卷调查、实验法、案例研究 等，字符串或null）'],
  ['iv', '自变量（字符串或null）'],
  ['dv', '因变量（字符串或null）'],
  ['dv_direction', '因变量方向（正向/负向/U型/倒U型 等，字符串或null）'],
  ['mediator', '中介变量（字符串或null）'],
  ['moderator', '调节变量（字符串或null）'],
  ['field', '研究领域（字符串或null）'],
  ['research_subject', '研究主体（字符串或null）'],
  ['antecedent_outcome', '前因/结果（字符串或null）'],
  ['article_type', '文章类型（实证论文/综述/理论分析/案例研究 等，字符串或null）'],
  ['features', '论文特色/创新点（字符串或null）'],
];

function loadFieldOrder(projectId?: string): string[] {
  try {
    const key = projectId ? `paper_assistant_field_order_${projectId}` : 'paper_assistant_field_order';
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function buildAnalysisPrompt(customFieldKeys: string[], disabledStandardFields: Set<string>, projectId?: string): string {
  const fieldOrder = loadFieldOrder(projectId);
  const enabledStandard = ALL_STANDARD_FIELDS.filter(([key]) => !disabledStandardFields.has(key));
  const allEnabledKeys = new Set([
    ...enabledStandard.map(([key]) => key),
    ...customFieldKeys,
  ]);

  // Sort standard fields by saved order, then by original order as fallback
  const orderedKeys = fieldOrder.filter(k => allEnabledKeys.has(k));
  for (const [key] of enabledStandard) {
    if (!orderedKeys.includes(key)) orderedKeys.push(key);
  }
  for (const key of customFieldKeys) {
    if (!orderedKeys.includes(key)) orderedKeys.push(key);
  }

  const standardMap = new Map(ALL_STANDARD_FIELDS);
  const standardLines = orderedKeys
    .filter(k => !disabledStandardFields.has(k) || customFieldKeys.includes(k))
    .map(key => {
      const desc = standardMap.get(key);
      if (desc) return '- ' + key + ': ' + desc[1];
      // Custom fields: give clear instruction based on field name
      return `- ${key}: 请从论文中提取"${key}"的具体内容。如果论文中能找到相关信息则填写，否则返回 null（字符串或null）`;
    })
    .join('\n');

  const prompt = '你是一个学术论文分析助手。请阅读以下论文全文，提取以下信息并以 JSON 格式返回。\n\n' +
    '## 提取字段\n' +
    standardLines + '\n\n' +
    '## 规则\n' +
    '1. 如果论文中没有提到某个字段，该字段返回 null，不要编造\n' +
    '2. 只返回有效 JSON，不要 markdown 代码块标记，不要其他文字\n' +
    '3. 作者之间用逗号分隔\n' +
    '4. 所有字符串值中的双引号需要转义\n' +
    '5. 保持原文语言，英文论文输出英文，中文论文输出中文\n' +
    '6. 自定义字段（用户添加的字段）与预设字段同等重要，请认真从论文中查找对应内容\n' +
    '7. 对于数字类字段（如"数量""年份"等），返回纯数字字符串，如 "45"\n\n' +
    '## 论文全文\n' +
    '{paper_text}';

  return prompt;
}

const TRANSLATION_PROMPT = '你是一个学术翻译助手。请将以下英文论文分析结果翻译为中文，以 JSON 格式返回。\n\n' +
  '## 翻译规则\n' +
  '1. 保持 JSON 结构不变，仅翻译值\n' +
  '2. 学术术语要使用规范的中文翻译\n' +
  '3. 人名、期刊名保持原文不翻译\n' +
  '4. 如果某个值为 null 或已是中文，保持原样\n' +
  '5. 数字(year 字段) 不翻译\n' +
  '6. 只返回有效 JSON，不要其他文字\n\n' +
  '## 原文\n' +
  '{original_json}';

export interface AnalysisProgress {
  paperId: string;
  field: string;
  value: string | null;
  done: boolean;
}

export function createPendingPaper(
  sourceName: string,
  sourceType: 'pdf' | 'url',
  projectId: string,
  order: number,
  customFields: Record<string, string | null> = {}
): Paper {
  return {
    id: uuid(),
    project_id: projectId,
    order,
    title: sourceName.replace(/\.pdf$/i, ''),
    year: null,
    journal_level: null,
    authors: null,
    abstract: null,
    model_diagram_description: null,
    model_type: null,
    conclusion: null,
    research_theory: null,
    research_method: null,
    iv: null,
    dv: null,
    dv_direction: null,
    mediator: null,
    moderator: null,
    field: null,
    research_subject: null,
    antecedent_outcome: null,
    article_type: null,
    features: null,
    custom_fields: customFields,
    translated_fields: {},
    analyzed_field_keys: Object.keys(customFields),
    status: 'pending',
    source_type: sourceType,
    source_name: sourceName,
    created_at: new Date(),
    analyzed_at: null,
  };
}

export async function analyzePaper(
  paper: Paper,
  paperText: string,
  config: ApiConfig,
  customFields: Record<string, string | null> = {},
  disabledStandardFields: Set<string> = new Set(),
  onProgress?: (progress: AnalysisProgress) => void,
  signal?: AbortSignal
): Promise<Partial<Paper>> {
  const enabledCustomKeys = Object.keys(customFields);
  const prompt = buildAnalysisPrompt(enabledCustomKeys, disabledStandardFields, paper.project_id).replace('{paper_text}', paperText);

  const body: any = {
    model: config.model,
    messages: [{ role: 'user', content: prompt }],
    temperature: config.temperature,
    max_tokens: config.max_tokens,
  };

  if (config.streaming && onProgress) {
    body.stream = true;
  }

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + config.api_key,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('API 请求失败 (' + response.status + '): ' + errorText.slice(0, 200));
  }

  if (config.streaming && onProgress) {
    const parsed = await parseStreamResponseRaw(response, onProgress);
    const split = splitFields(parsed);
    return { ...split.standard, custom_fields: split.custom };
  } else {
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const parsed = parseJSON(content);
    const split = splitFields(parsed);
    onProgress?.({ paperId: paper.id, field: '', value: '', done: true });
    return { ...split.standard, custom_fields: split.custom };
  }
}

export async function translatePaperFields(
  paper: Paper,
  config: ApiConfig
): Promise<Record<string, string | null>> {
  const source: Record<string, any> = {};
  for (const key of TRANSLATABLE_FIELDS) {
    const val = (paper as any)[key];
    if (val != null && typeof val === 'string' && val.trim()) {
      source[key] = val;
    } else {
      source[key] = null;
    }
  }
  for (const [k, v] of Object.entries(paper.custom_fields || {})) {
    if (v != null && v.trim()) source[k] = v;
  }

  const prompt = TRANSLATION_PROMPT.replace('{original_json}', JSON.stringify(source, null, 2));

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + config.api_key,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('翻译请求失败 (' + response.status + '): ' + errorText.slice(0, 200));
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const translated = parseJSON(content) as Record<string, string | null>;
  return translated;
}

async function parseStreamResponseRaw(
  response: Response,
  onProgress: (progress: AnalysisProgress) => void
): Promise<Record<string, any>> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法读取流式响应');

  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) fullContent += delta;
      } catch { /* skip */ }
    }
  }

  if (buffer.trim()) {
    const trimmed = buffer.trim();
    if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
      try {
        const parsed = JSON.parse(trimmed.slice(6));
        fullContent += parsed.choices?.[0]?.delta?.content || '';
      } catch { /* skip */ }
    }
  }

  const result = parseJSON(fullContent);
  onProgress({ paperId: '', field: '', value: '', done: true });
  return result;
}

function parseJSON(content: string): Record<string, any> {
  let jsonStr = content.trim();

  const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key === 'year' && typeof value === 'string') {
        result[key] = parseInt(value) || null;
      } else {
        result[key] = value || null;
      }
    }
    return result;
  } catch {
    throw new Error('无法解析 LLM 返回的 JSON。原始内容:\n' + content.slice(0, 500));
  }
}

function splitFields(parsed: Record<string, any>): { standard: Partial<Paper>; custom: Record<string, string | null> } {
  const standard: any = {};
  const custom: Record<string, string | null> = {};

  for (const [key, value] of Object.entries(parsed)) {
    if (STANDARD_KEYS.has(key)) {
      standard[key] = value;
    } else {
      custom[key] = typeof value === 'string' ? value : (value != null ? String(value) : null);
    }
  }

  return { standard, custom };
}
