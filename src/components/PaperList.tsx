import { useState, useRef } from 'react';
import type { Paper } from '../types';
import { db } from '../db';
import { parsePDF } from '../services/pdfParser';

interface Props {
  papers: Paper[];
  selectedPaperId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (papers: Paper[]) => void;
  onReanalyze?: (paper: Paper, text?: string) => void;
  currentCustomFieldKeys?: string[];
}

function isPaperStale(paper: Paper, currentKeys: string[]): boolean {
  if (paper.status !== 'completed') return false;
  if (!currentKeys.length) return false;
  const analyzedKeys = paper.analyzed_field_keys || [];
  // Paper is stale if there are new custom fields not in analyzed keys
  return currentKeys.some(k => !analyzedKeys.includes(k));
}

const STATUS_ICON: Record<Paper['status'], string> = {
  pending: '⏳',
  analyzing: '⚡',
  completed: '✅',
  error: '❌',
  translating: '🔄',
};

export function PaperList({ papers, selectedPaperId, onSelect, onDelete, onReorder, onReanalyze, currentCustomFieldKeys = [] }: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingReanalyzePaper, setPendingReanalyzePaper] = useState<Paper | null>(null);

  const handleReanalyzeClick = (paper: Paper) => {
    if (paper.raw_text) {
      onReanalyze?.(paper);
    } else {
      // No raw text stored — need to re-upload
      setPendingReanalyzePaper(paper);
      fileInputRef.current?.click();
    }
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingReanalyzePaper) return;
    try {
      const parsed = await parsePDF(file);
      onReanalyze?.(pendingReanalyzePaper, parsed.fullText);
    } catch (err: any) {
      alert('PDF 解析失败: ' + (err.message || '未知错误'));
    }
    setPendingReanalyzePaper(null);
    e.target.value = '';
  };

  if (papers.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
        <div className="text-3xl mb-2">📭</div>
        <p className="text-sm">暂无论文</p>
        <p className="text-xs mt-1">拖入 PDF 开始分析</p>
      </div>
    );
  }

  const pending = papers.filter(p => p.status === 'pending').length;
  const analyzing = papers.filter(p => p.status === 'analyzing').length;
  const completed = papers.filter(p => p.status === 'completed').length;
  const errors = papers.filter(p => p.status === 'error').length;

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    // Make the dragged element semi-transparent
    (e.currentTarget as HTMLElement).style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDragIndex(null);
    setDragOverIndex(null);
    (e.currentTarget as HTMLElement).style.opacity = '1';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...papers];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);

    // Update order values in DB
    const now = Date.now();
    for (let i = 0; i < reordered.length; i++) {
      reordered[i] = { ...reordered[i], order: now - i };
      await db.papers.update(reordered[i].id, { order: now - i } as any);
    }

    onReorder(reordered);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFilePicked}
      />
      {/* Summary bar */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          论文列表 <span className="text-gray-400 font-normal">({papers.length})</span>
        </span>
        <div className="flex gap-3 text-xs text-gray-500">
          {completed > 0 && <span>✅ {completed}</span>}
          {analyzing > 0 && <span className="text-blue-500">⚡ {analyzing}</span>}
          {pending > 0 && <span>⏳ {pending}</span>}
          {errors > 0 && <span className="text-red-500">❌ {errors}</span>}
        </div>
      </div>

      {/* List with drag reorder */}
      <div className="divide-y divide-gray-50 max-h-[60vh] overflow-y-auto">
        {papers.map((paper, index) => (
          <div
            key={paper.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onClick={() => onSelect(paper.id)}
            className={`px-4 py-3 cursor-pointer transition-all hover:bg-gray-50 group ${
              selectedPaperId === paper.id
                ? 'bg-blue-50 border-l-2 border-l-blue-500'
                : 'border-l-2 border-l-transparent'
            } ${
              dragOverIndex === index && dragIndex !== index
                ? 'border-t-2 border-t-blue-400'
                : ''
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              {/* Drag handle */}
              <div className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing text-xs pt-0.5 flex-shrink-0 select-none" title="拖拽排序">
                ⠿
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-800 truncate">
                  {paper.title || paper.source_name}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {paper.authors && <span>{paper.authors} · </span>}
                  {paper.year && <span>{paper.year} · </span>}
                  {paper.journal_level && <span>{paper.journal_level}</span>}
                  {!paper.authors && !paper.year && (
                    <span>{paper.source_type === 'pdf' ? 'PDF' : 'URL'} · {paper.status === 'analyzing' ? '分析中...' : paper.status === 'pending' ? '等待中' : paper.status === 'error' ? paper.error_message : ''}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-lg">{STATUS_ICON[paper.status]}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(paper.id); }}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 text-sm transition-colors"
                  title="删除此论文"
                >
                  ✕
                </button>
                {isPaperStale(paper, currentCustomFieldKeys) && onReanalyze && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleReanalyzeClick(paper); }}
                    className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 transition-colors"
                    title={paper.raw_text ? '有新自定义字段，点击更新分析' : '缺少原始文本，点击后需重新选择PDF文件'}
                  >
                    {paper.raw_text ? '更新' : '更新*'}
                  </button>
                )}
              </div>
            </div>
            {paper.status === 'analyzing' && (
              <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 animate-pulse-bar rounded-full" style={{ width: '60%' }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
