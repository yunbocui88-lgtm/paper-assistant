import { useState } from 'react';
import * as XLSX from 'xlsx';
import type { Paper } from '../types';
import { FIELD_DEFINITIONS } from '../types';

interface Props {
  papers: Paper[];
  fieldOrder?: string[];
}

export function ExportPanel({ papers, fieldOrder = [] }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');

  const completedPapers = papers.filter(p => p.status === 'completed');

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === completedPapers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(completedPapers.map(p => p.id)));
    }
  };

  const exportPapers = () => {
    const toExport = completedPapers.filter(p =>
      selectedIds.size === 0 || selectedIds.has(p.id)
    );

    if (toExport.length === 0) {
      alert('请选择要导出的论文');
      return;
    }

    // Collect all custom field keys across selected papers
    const allCustomKeys = new Set(toExport.flatMap(p => Object.keys(p.custom_fields || {})));

    // Build ordered column list respecting user's saved fieldOrder
    const allFieldKeys: string[] = [];
    for (const key of fieldOrder) {
      if (FIELD_DEFINITIONS.some(d => d.key === key) || allCustomKeys.has(key)) {
        allFieldKeys.push(key);
      }
    }
    // Append any standard fields not in fieldOrder
    for (const d of FIELD_DEFINITIONS) {
      if (!allFieldKeys.includes(d.key)) allFieldKeys.push(d.key);
    }
    // Append any custom fields not in fieldOrder
    for (const k of allCustomKeys) {
      if (!allFieldKeys.includes(k)) allFieldKeys.push(k);
    }

    const headers = allFieldKeys.map(k => {
      const def = FIELD_DEFINITIONS.find(d => d.key === k);
      return def ? def.label : k;
    });

    const rows = toExport.map(p => {
      return allFieldKeys.map(k => {
        const val = (p as any)[k] ?? (p.custom_fields || {})[k];
        if (val == null) return '';
        return val ?? '';
      });
    });

    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Auto column widths
    const colWidths = headers.map((h, i) => ({
      wch: Math.max(h.length * 2, ...rows.map(r => String(r[i] || '').length)),
    }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '论文分析结果');

    if (exportFormat === 'xlsx') {
      XLSX.writeFile(wb, `论文分析结果_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } else {
      XLSX.writeFile(wb, `论文分析结果_${new Date().toISOString().slice(0, 10)}.csv`, { bookType: 'csv' });
    }
  };

  if (completedPapers.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <div className="text-5xl mb-4">📊</div>
          <p className="text-lg">没有可导出的论文</p>
          <p className="text-sm mt-2">请先分析论文后再导出</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900">📊 导出论文数据</h2>
          <div className="flex gap-2">
            <select
              value={exportFormat}
              onChange={e => setExportFormat(e.target.value as 'xlsx' | 'csv')}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV (.csv)</option>
            </select>
            <button
              onClick={exportPapers}
              className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              📥 导出
            </button>
          </div>
        </div>

        <div className="text-sm text-gray-500 mb-4">
          共 {completedPapers.length} 篇已完成分析的论文。
          {selectedIds.size > 0 && <span> 已选中 {selectedIds.size} 篇。</span>}
          {selectedIds.size === 0 && <span> 未选择时导出全部。</span>}
        </div>

        {/* Select all toggle */}
        <label className="flex items-center gap-2 cursor-pointer mb-4 text-sm">
          <input
            type="checkbox"
            checked={selectedIds.size === completedPapers.length}
            onChange={toggleAll}
            className="accent-blue-600"
          />
          <span className="text-gray-600">全选</span>
        </label>

        {/* Paper list */}
        <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto border border-gray-100 rounded-lg">
          {completedPapers.map(paper => (
            <label
              key={paper.id}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(paper.id)}
                onChange={() => toggleSelect(paper.id)}
                className="accent-blue-600"
              />
              <div className="min-w-0">
                <div className="text-sm text-gray-800 truncate">
                  {paper.title || paper.source_name}
                </div>
                <div className="text-xs text-gray-400">
                  {paper.authors && <span>{paper.authors} · </span>}
                  {paper.year && <span>{paper.year} · </span>}
                  {paper.journal_level}
                </div>
              </div>
            </label>
          ))}
        </div>

        {/* Preview table */}
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">📋 导出预览（前 3 篇）</h3>
          <div className="overflow-x-auto">
            {(() => {
              // Build preview columns in fieldOrder (first 8 for compact display)
              const previewKeys: string[] = [];
              for (const key of fieldOrder) {
                if (FIELD_DEFINITIONS.some(d => d.key === key)) previewKeys.push(key);
              }
              for (const d of FIELD_DEFINITIONS) {
                if (!previewKeys.includes(d.key)) previewKeys.push(d.key);
              }
              const displayKeys = previewKeys.slice(0, 8);
              const displayLabels = displayKeys.map(k => {
                const def = FIELD_DEFINITIONS.find(d => d.key === k);
                return def ? def.label : k;
              });

              return (
            <table className="text-xs border-collapse w-full">
              <thead>
                <tr className="bg-gray-50">
                  {displayKeys.map((k, i) => (
                    <th key={k} className="border border-gray-200 px-2 py-1 text-left text-gray-600 whitespace-nowrap">
                      {displayLabels[i]}
                    </th>
                  ))}
                  <th className="border border-gray-200 px-2 py-1 text-left text-gray-400">...</th>
                </tr>
              </thead>
              <tbody>
                {(selectedIds.size > 0
                  ? completedPapers.filter(p => selectedIds.has(p.id))
                  : completedPapers
                ).slice(0, 3).map(paper => (
                  <tr key={paper.id}>
                    {displayKeys.map(k => {
                      const val = (paper as any)[k] ?? (paper.custom_fields || {})[k];
                      return (
                        <td key={k} className="border border-gray-200 px-2 py-1 text-gray-700 max-w-32 truncate">
                          {val ?? '-'}
                        </td>
                      );
                    })}
                    <td className="border border-gray-200 px-2 py-1 text-gray-400">...</td>
                  </tr>
                ))}
              </tbody>
            </table>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
