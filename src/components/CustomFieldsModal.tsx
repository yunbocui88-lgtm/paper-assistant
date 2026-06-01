import { useState } from 'react';
import { FIELD_DEFINITIONS } from '../types';

interface Props {
  customFields: Record<string, string | null>;
  onCustomFieldsChange: (fields: Record<string, string | null>) => void;
  disabledStandardFields: Set<string>;
  onDisabledFieldsChange: (fields: Set<string>) => void;
  onFieldOrderChange?: () => void;
  onClose: () => void;
  projectId: string;
}

interface FieldItem {
  key: string;
  label: string;
  isStandard: boolean;
}

function getFieldOrderKey(projectId: string) {
  return `paper_assistant_field_order_${projectId}`;
}

function loadFieldOrder(projectId: string): string[] {
  try {
    const saved = localStorage.getItem(getFieldOrderKey(projectId));
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function saveFieldOrder(order: string[], projectId: string) {
  localStorage.setItem(getFieldOrderKey(projectId), JSON.stringify(order));
}

export function CustomFieldsModal({
  customFields,
  onCustomFieldsChange,
  disabledStandardFields,
  onDisabledFieldsChange,
  onFieldOrderChange,
  onClose,
  projectId,
}: Props) {
  const [newKey, setNewKey] = useState('');
  const [dragKey, setDragKey] = useState<number | null>(null);
  const [overKey, setOverKey] = useState<number | null>(null);
  const [fieldOrder, setFieldOrder] = useState<string[]>(() => loadFieldOrder(projectId));

  // Build unified field list respecting saved order
  const enabledStandard = FIELD_DEFINITIONS.filter(d => !disabledStandardFields.has(d.key));
  const customKeys = Object.keys(customFields);
  const allEnabledKeys = new Set([
    ...enabledStandard.map(d => d.key),
    ...customKeys,
  ]);

  // Ensure all enabled keys are in fieldOrder (new ones go to end)
  let ordered = fieldOrder.filter(k => allEnabledKeys.has(k));
  for (const key of allEnabledKeys) {
    if (!ordered.includes(key)) ordered.push(key);
  }

  // Build display items
  const allFields: FieldItem[] = ordered.map(key => {
    const std = FIELD_DEFINITIONS.find(d => d.key === key);
    if (std) return { key: std.key, label: std.label, isStandard: true };
    return { key, label: key, isStandard: false };
  });

  const disabledStandard = FIELD_DEFINITIONS.filter(d => disabledStandardFields.has(d.key));
  const enabledCount = allFields.length;
  const disabledCount = disabledStandard.length;

  const toggleStandardField = (key: string) => {
    const next = new Set(disabledStandardFields);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    localStorage.setItem('paper_assistant_disabled_fields', JSON.stringify([...next]));
    onDisabledFieldsChange(next);
  };

  const addCustomField = () => {
    const key = newKey.trim();
    if (!key || customFields[key] !== undefined) return;
    onCustomFieldsChange({ ...customFields, [key]: null });
    // Also add new field to saved order so it doesn't always stay at the bottom
    const currentOrder = [...ordered];
    if (!currentOrder.includes(key)) currentOrder.push(key);
    setFieldOrder(currentOrder);
    saveFieldOrder(currentOrder, projectId);
    onFieldOrderChange?.();
    setNewKey('');
  };

  const deleteCustomField = (key: string) => {
    const next = { ...customFields };
    delete next[key];
    onCustomFieldsChange(next);
  };

  // Drag to reorder unified list
  const handleDragStart = (index: number) => {
    setDragKey(index);
  };

  const handleDragEnter = (index: number) => {
    setOverKey(index);
  };

  const handleDragEnd = () => {
    if (dragKey === null || overKey === null || dragKey === overKey) {
      setDragKey(null);
      setOverKey(null);
      return;
    }

    const items = [...ordered];
    const [moved] = items.splice(dragKey, 1);
    items.splice(overKey, 0, moved);

    // Separate standard and custom
    const newCustomOrder: Record<string, string | null> = {};
    for (const key of items) {
      if (!FIELD_DEFINITIONS.some(d => d.key === key)) {
        newCustomOrder[key] = customFields[key] ?? null;
      }
    }

    setFieldOrder(items);
    saveFieldOrder(items, projectId);
    onCustomFieldsChange(newCustomOrder);
    onFieldOrderChange?.();
    setDragKey(null);
    setOverKey(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">🔧 分析字段管理</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              已启用 {enabledCount} 个字段，已禁用 {disabledCount} 个 · 拖拽可排序
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        {/* Enabled fields — horizontal tag layout */}
        <div className="px-5 py-4 border-b border-gray-50">
          <h4 className="text-xs font-medium text-gray-500 mb-3">
            ✅ 已启用字段（分析时 AI 会提取这些内容）
          </h4>
          <div className="flex flex-wrap gap-2 items-center">
            {allFields.map((field, index) => (
              <div key={field.key} className="flex items-center gap-2">
                {/* Drop-indicator bar: shown before target when a different item is dragged over */}
                {dragKey !== null && overKey === index && dragKey !== index && (
                  <div className="w-1.5 h-7 bg-blue-500 rounded-full flex-shrink-0 animate-pulse" />
                )}
                <div
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={e => e.preventDefault()}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm cursor-grab active:cursor-grabbing select-none transition-all bg-blue-50 text-blue-700 border border-blue-200 ${
                    dragKey === index ? 'opacity-30 scale-90' : ''
                  } ${
                    overKey === index && dragKey !== index ? 'border-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.35)]' : ''
                  }`}
                  title={field.isStandard ? '标准字段 · 拖拽排序' : '自定义字段 · 拖拽排序'}
                >
                  <span className="text-xs opacity-50">⠿</span>
                  <span>{field.label}</span>
                  {field.isStandard ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleStandardField(field.key); }}
                      className="ml-1 w-4 h-4 flex items-center justify-center rounded-full hover:bg-red-100 hover:text-red-500 text-gray-400 text-xs"
                      title="禁用"
                    >
                      ×
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteCustomField(field.key); }}
                      className="ml-1 w-4 h-4 flex items-center justify-center rounded-full hover:bg-red-100 hover:text-red-500 text-gray-400 text-xs"
                      title="删除"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
            {/* Drop-indicator at end: shown when dragging past the last element */}
            {dragKey !== null && overKey === allFields.length && dragKey !== allFields.length && (
              <div className="w-1.5 h-7 bg-blue-500 rounded-full flex-shrink-0 animate-pulse" />
            )}
          </div>
          {allFields.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">所有字段都已禁用，请从下方启用</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Disabled fields */}
          {disabledStandard.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-400 mb-2">
                🚫 已禁用的标准字段（点击启用）
              </h4>
              <div className="flex flex-wrap gap-2">
                {disabledStandard.map(def => (
                  <button
                    key={def.key}
                    onClick={() => toggleStandardField(def.key)}
                    className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-gray-50 text-gray-400 border border-gray-200 line-through hover:bg-green-50 hover:text-green-600 hover:border-green-300 hover:no-underline transition-all"
                  >
                    {def.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add custom field */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 mb-2">✏️ 添加自定义字段</h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                placeholder="字段名"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={e => e.key === 'Enter' && addCustomField()}
              />
              <button
                onClick={addCustomField}
                disabled={!newKey.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex-shrink-0"
              >
                + 添加
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
