import { useState } from 'react';
import type { Paper, ApiConfig } from '../types';
import { FIELD_DEFINITIONS } from '../types';
import { translatePaperFields } from '../services/llmAnalyzer';
import { db } from '../db';
import {
  copyFieldValue,
  copyToClipboard,
  formatTableRow,
  formatLabeledText,
  formatNaturalSummary,
} from '../utils/copy';

interface Props {
  paper: Paper;
  apiConfig?: ApiConfig | null;
  onUpdate: (paper: Paper) => void;
  fieldOrder?: string[];
  onFieldOrderChange?: () => void;
}

export function PaperCard({ paper, apiConfig, onUpdate, fieldOrder = [], onFieldOrderChange }: Props) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [batchCopied, setBatchCopied] = useState<string | null>(null);
  const [showChinese, setShowChinese] = useState(false);
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  // Drag-to-reorder state
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const hasTranslation = Object.keys(paper.translated_fields || {}).length > 0;

  const getValue = (key: string): string | null => {
    if (showChinese && hasTranslation) {
      const t = (paper.translated_fields || {})[key];
      if (t) return t;
    }
    const val = (paper as any)[key];
    if (key === 'year' && typeof val === 'number') return String(val);
    return typeof val === 'string' ? val : null;
  };

  const copyField = async (key: string) => {
    const value = getValue(key);
    if (copyFieldValue(value)) {
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 1500);
    }
  };

  const getAllFields = (): Record<string, string | null> => {
    const fields: Record<string, string | null> = {};
    for (const def of FIELD_DEFINITIONS) {
      fields[def.key] = getValue(def.key);
    }
    for (const [k] of Object.entries(paper.custom_fields || {})) {
      fields[k] = getValue(k);
    }
    return fields;
  };

  const fieldLabels: Record<string, string> = {};
  for (const def of FIELD_DEFINITIONS) {
    fieldLabels[def.key] = def.label;
  }
  for (const k of Object.keys(paper.custom_fields || {})) {
    fieldLabels[k] = k;
  }

  const handleTranslate = async () => {
    if (!apiConfig) {
      setTranslateError('请先配置 API');
      return;
    }
    setTranslating(true);
    setTranslateError(null);
    try {
      const translated = await translatePaperFields(paper, apiConfig);
      const updated = {
        ...paper,
        translated_fields: translated,
      };
      await db.papers.put(updated);
      onUpdate(updated);
      setShowChinese(true);
    } catch (err: any) {
      setTranslateError(err.message || '翻译失败');
    } finally {
      setTranslating(false);
    }
  };

  // Loading / Error states
  if (paper.status === 'pending' || paper.status === 'analyzing' || paper.status === 'translating') {
    const label = paper.status === 'analyzing' ? '正在分析中...' :
      paper.status === 'translating' ? '正在翻译中...' : '等待分析...';
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="text-5xl mb-4">
          {paper.status === 'analyzing' || paper.status === 'translating' ? '⚡' : '⏳'}
        </div>
        <p className="text-gray-600 font-medium">{label}</p>
        <p className="text-sm text-gray-400 mt-1 truncate">{paper.source_name}</p>
        {(paper.status === 'analyzing' || paper.status === 'translating') && (
          <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden max-w-xs mx-auto">
            <div className="h-full bg-blue-500 animate-pulse-bar rounded-full" style={{ width: '60%' }} />
          </div>
        )}
      </div>
    );
  }

  if (paper.status === 'error') {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
        <div className="text-4xl mb-3">❌</div>
        <p className="text-red-600 font-medium">分析失败</p>
        <p className="text-sm text-gray-500 mt-1">{paper.error_message || '未知错误'}</p>
      </div>
    );
  }

  // ── Completed paper ──────────────────────────────────
  const allFields = getAllFields();
  const toggleExpand = (key: string) => {
    setExpandedFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const needsClamp = (value: string | null): boolean => {
    return !!value && value.length > 80; // Approximate: 80 chars likely needs 3+ lines
  };

  const hasTranslatableContent = FIELD_DEFINITIONS.some(d => {
    const val = (paper as any)[d.key];
    return val && typeof val === 'string' && /[a-zA-Z]/.test(val);
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 leading-snug">
              {getValue('title') || paper.source_name}
            </h2>
            <div className="flex flex-wrap gap-2 mt-2">
              {paper.year && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{paper.year}</span>
              )}
              {paper.journal_level && (
                <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{getValue('journal_level')}</span>
              )}
              {paper.article_type && (
                <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{getValue('article_type')}</span>
              )}
              {paper.field && (
                <span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">{getValue('field')}</span>
              )}
            </div>
            {paper.authors && (
              <p className="text-sm text-gray-500 mt-1">{getValue('authors')}</p>
            )}
          </div>

          {/* Translation toggle */}
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            {hasTranslatableContent && !hasTranslation && (
              <button
                onClick={handleTranslate}
                disabled={translating}
                className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 whitespace-nowrap"
              >
                {translating ? '🔄 翻译中...' : '🌐 翻译为中文'}
              </button>
            )}
            {hasTranslation && (
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={showChinese}
                  onChange={e => setShowChinese(e.target.checked)}
                  className="accent-indigo-600"
                />
                <span className={showChinese ? 'text-indigo-600 font-medium' : 'text-gray-400'}>
                  显示中文
                </span>
              </label>
            )}
            {translateError && (
              <p className="text-xs text-red-500">{translateError}</p>
            )}
          </div>
        </div>
      </div>

      {/* Field grid */}
      <div className="p-6">
        {/* Copy buttons */}
        <div className="flex gap-2 mb-4 flex-wrap items-center">
          <button
            onClick={() => {
              if (copyToClipboard(formatTableRow([{ fields: allFields, headers: Object.keys(allFields) }]))) {
                setBatchCopied('table');
                setTimeout(() => setBatchCopied(null), 2000);
              }
            }}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              batchCopied === 'table' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {batchCopied === 'table' ? '✅ 已复制' : '📊 复制为表格行'}
          </button>
          <button
            onClick={() => {
              if (copyToClipboard(formatLabeledText(allFields, fieldLabels))) {
                setBatchCopied('labeled');
                setTimeout(() => setBatchCopied(null), 2000);
              }
            }}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              batchCopied === 'labeled' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {batchCopied === 'labeled' ? '✅ 已复制' : '📝 复制为标签文本'}
          </button>
          <button
            onClick={() => {
              if (copyToClipboard(formatNaturalSummary(allFields))) {
                setBatchCopied('summary');
                setTimeout(() => setBatchCopied(null), 2000);
              }
            }}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              batchCopied === 'summary' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {batchCopied === 'summary' ? '✅ 已复制' : '📄 复制为摘要'}
          </button>
          {copiedField && (
            <span className="text-xs text-green-600 px-2 py-1.5">✅ 字段已复制</span>
          )}
          {showChinese && (
            <span className="text-xs text-indigo-600 px-2 py-1.5 bg-indigo-50 rounded">🇨🇳 当前为中文版</span>
          )}
        </div>

        {/* Sort fields by stored order */}
        {(() => {
          // Build ordered list: follow stored order for both standard and custom fields in one pass
          const ordered: string[] = [];
          for (const key of fieldOrder) {
            if (FIELD_DEFINITIONS.some(d => d.key === key) || paper.custom_fields?.[key] !== undefined) {
              ordered.push(key);
            }
          }
          for (const d of FIELD_DEFINITIONS) {
            if (!ordered.includes(d.key)) ordered.push(d.key);
          }
          for (const k of Object.keys(paper.custom_fields || {})) {
            if (!ordered.includes(k)) ordered.push(k);
          }

          // Drag handlers for in-place field reordering
          const handleFieldDragStart = (e: React.DragEvent, key: string) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', key);
            setDragKey(key);
          };

          const handleFieldDragEnter = (key: string) => {
            setDragOverKey(key);
          };

          const handleFieldDragEnd = () => {
            if (!dragKey || !dragOverKey || dragKey === dragOverKey) {
              setDragKey(null);
              setDragOverKey(null);
              return;
            }
            const items = [...ordered];
            const dragIdx = items.indexOf(dragKey);
            const overIdx = items.indexOf(dragOverKey);
            if (dragIdx === -1 || overIdx === -1) {
              setDragKey(null);
              setDragOverKey(null);
              return;
            }
            const [moved] = items.splice(dragIdx, 1);
            items.splice(overIdx, 0, moved);
            localStorage.setItem(`paper_assistant_field_order_${paper.project_id}`, JSON.stringify(items));
            onFieldOrderChange?.();
            setDragKey(null);
            setDragOverKey(null);
          };

          return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ordered.map(key => {
            const def = FIELD_DEFINITIONS.find(d => d.key === key);
            const isCustom = !def;
            const value = getValue(key);
            const isClampable = needsClamp(value);
            const isExpanded = expandedFields.has(key);
            const isDragged = dragKey === key;
            const isDragOver = dragOverKey === key && dragKey !== key;

            return (
              <div
                key={key}
                draggable
                onDragStart={(e) => handleFieldDragStart(e, key)}
                onDragEnter={() => handleFieldDragEnter(key)}
                onDragEnd={handleFieldDragEnd}
                onDragOver={e => e.preventDefault()}
                className={`group relative px-3 py-2 rounded-lg border transition-all hover:bg-blue-50 hover:border-blue-200 ${
                  copiedField === key ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-100'
                } ${isClampable ? 'col-span-full' : ''} ${
                  isDragged ? 'opacity-30 scale-90' : ''
                } ${
                  isDragOver ? 'border-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.35)]' : ''
                }`}
                title="拖拽可排序"
              >
                {/* Blue pulse insertion bar — shown on drop target */}
                {isDragOver && (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500 rounded-l-lg animate-pulse" />
                )}
                {/* Drag handle — top-left */}
                <div className="absolute top-1 left-1 w-5 h-5 hidden group-hover:flex items-center justify-center rounded text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing text-xs leading-none select-none" title="拖拽排序">
                  ⠿
                </div>
                {/* Copy button — top-right, all fields */}
                <button
                  onClick={(e) => { e.stopPropagation(); copyField(key); }}
                  className={`absolute top-1 right-1 w-5 h-5 hidden group-hover:flex items-center justify-center rounded-full text-xs leading-none shadow-sm transition-colors ${
                    isCustom ? 'right-7' : 'right-1'
                  } ${
                    copiedField === key
                      ? 'bg-green-500 text-white'
                      : 'bg-white border border-gray-200 text-gray-400 hover:text-blue-500 hover:border-blue-300'
                  }`}
                  title="复制字段内容"
                >
                  {copiedField === key ? '✓' : '📋'}
                </button>
                {/* Delete button — top-right, custom fields only */}
                {isCustom && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const next = { ...paper.custom_fields };
                      delete next[key];
                      const updated = { ...paper, custom_fields: next };
                      await db.papers.put(updated);
                      onUpdate(updated);
                    }}
                    className="absolute top-1 right-1 w-5 h-5 hidden group-hover:flex items-center justify-center rounded-full bg-white border border-gray-200 hover:bg-red-50 hover:border-red-300 hover:text-red-500 text-gray-400 text-xs leading-none shadow-sm"
                    title={`删除字段 "${key}"`}
                  >
                    ×
                  </button>
                )}
                {/* Field content */}
                <div className="text-xs text-gray-400 mb-0.5">{isCustom ? key : def!.label}</div>
                <div className={`text-sm text-gray-800 break-words ${
                  isClampable && !isExpanded ? 'line-clamp-3' : ''
                }`}>
                  {value || <span className="text-gray-300 italic">无数据</span>}
                </div>
                {isClampable && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleExpand(key); }}
                    className="text-xs text-blue-500 hover:text-blue-700 mt-1"
                  >
                    {isExpanded ? '▲ 收起' : '▼ 展开'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
          );
        })()}
      </div>
    </div>
  );
}
