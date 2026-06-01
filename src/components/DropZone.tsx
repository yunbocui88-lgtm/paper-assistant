import { useState, useRef, useCallback } from 'react';
import type { Paper, ApiConfig } from '../types';
import { parsePDF } from '../services/pdfParser';
import { analyzePaper, createPendingPaper } from '../services/llmAnalyzer';
import { fetchURLText } from '../services/urlFetcher';
import { CustomFieldsModal } from './CustomFieldsModal';
import { db } from '../db';

interface Props {
  onPapersAdded: (papers: Paper[]) => void;
  apiConfig: ApiConfig | null;
  isAnalyzing: boolean;
  setIsAnalyzing: (v: boolean) => void;
  onPaperUpdate: (paper: Paper) => void;
  customFields: Record<string, string | null>;
  setCustomFields: (v: Record<string, string | null>) => void;
  disabledStandardFields: Set<string>;
  setDisabledStandardFields: (v: Set<string>) => void;
  onFieldOrderChange?: () => void;
  projectId: string;
}

export function DropZone({ onPapersAdded, apiConfig, isAnalyzing, setIsAnalyzing, onPaperUpdate, customFields, setCustomFields, disabledStandardFields, setDisabledStandardFields, onFieldOrderChange, projectId }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [showCustomFields, setShowCustomFields] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFileContent = useCallback(async (paper: Paper, text: string) => {
    if (!apiConfig) return;

    try {
      const result = await analyzePaper(paper, text, apiConfig, customFields, disabledStandardFields);

      const completed: Paper = {
        ...paper,
        ...result,
        raw_text: text,
        analyzed_field_keys: Object.keys(customFields),
        status: 'completed',
        analyzed_at: new Date(),
      };
      await db.papers.put(completed);
      onPaperUpdate(completed);
    } catch (err: any) {
      const failed: Paper = {
        ...paper,
        status: 'error',
        error_message: err.message || '分析失败',
        analyzed_at: new Date(),
      };
      await db.papers.put(failed);
      onPaperUpdate(failed);
    }
  }, [apiConfig, customFields, disabledStandardFields, onPaperUpdate]);

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter(f =>
      f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );

    if (files.length === 0) {
      alert('仅支持 PDF 文件');
      return;
    }

    if (!apiConfig) {
      alert('请先在 "API 配置" 页面设置大模型接口');
      return;
    }

    setIsAnalyzing(true);

    // Create pending papers for all files (new papers go to top)
    const now = Date.now();
    const newPapers = files.map((f, i) => createPendingPaper(f.name, 'pdf', projectId, now - i, customFields));
    for (const p of newPapers) {
      await db.papers.put(p);
    }
    onPapersAdded(newPapers);

    // Process sequentially
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const paper = newPapers[i];

      // Update to analyzing
      const analyzingPaper = { ...paper, status: 'analyzing' as const };
      await db.papers.put(analyzingPaper);
      onPaperUpdate(analyzingPaper);

      try {
        const parsed = await parsePDF(file);

        // Analyze with LLM
        const result = await analyzePaper(paper, parsed.fullText, apiConfig, customFields, disabledStandardFields);

        const final: Paper = {
          ...paper,
          ...result,
          raw_text: parsed.fullText,
          analyzed_field_keys: Object.keys(customFields),
          status: 'completed',
          analyzed_at: new Date(),
        };
        await db.papers.put(final);
        onPaperUpdate(final);
      } catch (err: any) {
        const failed: Paper = {
          ...paper,
          status: 'error',
          error_message: err.message || '分析失败',
          analyzed_at: new Date(),
        };
        await db.papers.put(failed);
        onPaperUpdate(failed);
      }
    }

    setIsAnalyzing(false);
  }, [apiConfig, customFields, projectId, onPapersAdded, onPaperUpdate, setIsAnalyzing]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  }, [handleFiles]);

  const handleUrlSubmit = useCallback(async () => {
    if (!urlInput.trim() || !apiConfig) return;

    setIsAnalyzing(true);
    setShowUrlInput(false);

    const paper = createPendingPaper(urlInput, 'url', projectId, Date.now(), customFields);
    await db.papers.put(paper);
    onPapersAdded([paper]);

    const analyzingPaper = { ...paper, status: 'analyzing' as const };
    await db.papers.put(analyzingPaper);
    onPaperUpdate(analyzingPaper);

    try {
      const text = await fetchURLText(urlInput);
      await processFileContent(paper, text);
    } catch (err: any) {
      const failed: Paper = {
        ...paper,
        status: 'error',
        error_message: err.message || '抓取失败',
        analyzed_at: new Date(),
      };
      await db.papers.put(failed);
      onPaperUpdate(failed);
    }

    setUrlInput('');
    setIsAnalyzing(false);
  }, [urlInput, apiConfig, customFields, projectId, onPapersAdded, onPaperUpdate, processFileContent, setIsAnalyzing]);

  return (
    <div>
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          isDragOver
            ? 'border-blue-500 bg-blue-50 scale-[1.02]'
            : 'border-gray-300 hover:border-gray-400 bg-white'
        } ${isAnalyzing ? 'opacity-75 pointer-events-none' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        {isAnalyzing ? (
          <div>
            <div className="text-4xl mb-3">🔄</div>
            <p className="text-gray-600 font-medium">正在分析论文...</p>
            <p className="text-sm text-gray-400 mt-1">请稍候，可查看下方进度</p>
          </div>
        ) : (
          <div className="cursor-pointer">
            <div className="text-4xl mb-3">📄</div>
            <p className="text-gray-700 font-medium">
              拖拽 PDF 文件到此处，或点击选择文件
            </p>
            <p className="text-sm text-gray-400 mt-1">
              支持批量上传 · 自动排队分析
            </p>
          </div>
        )}
      </div>

      {/* URL input + custom fields */}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button
          onClick={(e) => { e.stopPropagation(); setShowUrlInput(!showUrlInput); }}
          className="text-sm text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg border border-blue-200 hover:border-blue-300 bg-blue-50"
        >
          🔗 粘贴论文链接
        </button>
        <span className="text-xs text-gray-400">
          自定义字段: {Object.keys(customFields).length} 个
        </span>
      </div>

      {showUrlInput && (
        <div className="mt-2 flex gap-2" onClick={e => e.stopPropagation()}>
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="粘贴 arXiv / 期刊论文 URL"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
          />
          <button
            onClick={handleUrlSubmit}
            disabled={!urlInput.trim() || isAnalyzing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            分析
          </button>
        </div>
      )}

      {/* Custom fields button */}
      <div className="mt-3 flex items-center gap-2" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => setShowCustomFields(true)}
          className="text-sm text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg border border-blue-200 hover:border-blue-300 bg-blue-50"
        >
          🔧 自定义分析字段 {Object.keys(customFields).length > 0 && `(${Object.keys(customFields).length})`}
        </button>
        {Object.keys(customFields).length > 0 && (
          <span className="text-xs text-gray-400">
            {Object.keys(customFields).slice(0, 3).join('、')}
            {Object.keys(customFields).length > 3 && ` 等 ${Object.keys(customFields).length} 个`}
          </span>
        )}
      </div>

      {/* Custom fields modal */}
      {showCustomFields && (
        <CustomFieldsModal
          customFields={customFields}
          onCustomFieldsChange={setCustomFields}
          disabledStandardFields={disabledStandardFields}
          onDisabledFieldsChange={setDisabledStandardFields}
          onFieldOrderChange={onFieldOrderChange}
          onClose={() => { setShowCustomFields(false); onFieldOrderChange?.(); }}
          projectId={projectId}
        />
      )}
    </div>
  );
}
