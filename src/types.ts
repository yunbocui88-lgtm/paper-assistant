export interface Project {
  id: string;
  name: string;
  created_at: Date;
}

export interface Paper {
  id: string;
  project_id: string;
  order: number;
  title: string | null;
  year: number | null;
  journal_level: string | null;
  authors: string | null;
  abstract: string | null;
  model_diagram_description: string | null;
  model_type: string | null;
  conclusion: string | null;
  research_theory: string | null;
  research_method: string | null;
  iv: string | null;
  dv: string | null;
  dv_direction: string | null;
  mediator: string | null;
  moderator: string | null;
  field: string | null;
  research_subject: string | null;
  antecedent_outcome: string | null;
  article_type: string | null;
  features: string | null;
  custom_fields: Record<string, string | null>;
  translated_fields: Record<string, string | null>;
  raw_text?: string;                     // original full text for re-analysis
  analyzed_field_keys?: string[];        // custom field keys used when analyzed
  status: 'pending' | 'analyzing' | 'completed' | 'error' | 'translating';
  error_message?: string;
  source_type: 'pdf' | 'url';
  source_name: string;
  created_at: Date;
  analyzed_at: Date | null;
}

export interface ApiConfig {
  id: string;
  name: string;
  endpoint: string;
  model: string;
  api_key: string;
  temperature: number;
  max_tokens: number;
  streaming: boolean;
  is_active: boolean;
  created_at: Date;
}

export interface AnalysisField {
  key: string;
  label: string;
  value: string | null;
  category: 'basic' | 'theory' | 'variable' | 'other';
}

export const FIELD_DEFINITIONS: { key: keyof Paper; label: string; category: AnalysisField['category'] }[] = [
  { key: 'title', label: '标题', category: 'basic' },
  { key: 'authors', label: '作者', category: 'basic' },
  { key: 'year', label: '年份', category: 'basic' },
  { key: 'journal_level', label: '期刊级别', category: 'basic' },
  { key: 'article_type', label: '文章类型', category: 'basic' },
  { key: 'field', label: '领域', category: 'basic' },
  { key: 'research_subject', label: '研究主体', category: 'basic' },
  { key: 'abstract', label: '摘要', category: 'basic' },
  { key: 'research_theory', label: '研究理论', category: 'theory' },
  { key: 'research_method', label: '研究方法', category: 'theory' },
  { key: 'model_type', label: '模型类型', category: 'theory' },
  { key: 'model_diagram_description', label: '模型图描述', category: 'theory' },
  { key: 'iv', label: '自变量', category: 'variable' },
  { key: 'dv', label: '因变量', category: 'variable' },
  { key: 'dv_direction', label: '因变量方向', category: 'variable' },
  { key: 'mediator', label: '中介变量', category: 'variable' },
  { key: 'moderator', label: '调节变量', category: 'variable' },
  { key: 'antecedent_outcome', label: '前因/结果', category: 'variable' },
  { key: 'conclusion', label: '结论', category: 'other' },
  { key: 'features', label: '特色', category: 'other' },
];

/** Fields eligible for translation */
export const TRANSLATABLE_FIELDS = FIELD_DEFINITIONS.filter(
  d => d.key !== 'year'
).map(d => d.key);
