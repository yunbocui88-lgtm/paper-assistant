import { useState, useEffect, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { db } from './db';
import type { Paper, ApiConfig, Project } from './types';
import { DropZone } from './components/DropZone';
import { analyzePaper } from './services/llmAnalyzer';
import { PaperList } from './components/PaperList';
import { PaperCard } from './components/PaperCard';
import { ApiConfigPanel } from './components/ApiConfig';
import { ExportPanel } from './components/ExportPanel';

type Tab = 'papers' | 'api' | 'export';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('papers');
  const [papers, setPapers] = useState<Paper[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [customFields, setCustomFields] = useState<Record<string, string | null>>({});
  const [disabledStandardFields, setDisabledStandardFields] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('paper_assistant_disabled_fields');
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch { return new Set<string>(); }
  });
  const [fieldOrder, setFieldOrder] = useState<string[]>([]);

  // Reload fieldOrder when switching projects
  useEffect(() => {
    if (activeProjectId) {
      try {
        const saved = localStorage.getItem(`paper_assistant_field_order_${activeProjectId}`);
        setFieldOrder(saved ? JSON.parse(saved) : []);
      } catch { setFieldOrder([]); }
    }
  }, [activeProjectId]);

  const refreshFieldOrder = useCallback(() => {
    if (!activeProjectId) return;
    try {
      const saved = localStorage.getItem(`paper_assistant_field_order_${activeProjectId}`);
      if (saved) setFieldOrder(JSON.parse(saved));
    } catch {}
  }, [activeProjectId]);
  const [showProjectInput, setShowProjectInput] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const loadProjects = useCallback(async () => {
    const all = await db.projects.orderBy('created_at').toArray();
    setProjects(all);
    return all;
  }, []);

  const loadPapers = useCallback(async (projectId: string | null) => {
    if (!projectId) {
      setPapers([]);
      return;
    }
    const allPapers = await db.papers
      .where('project_id').equals(projectId)
      .sortBy('order');
    setPapers(allPapers);
  }, []);

  // Init: load projects, set active to first or create default
  useEffect(() => {
    const init = async () => {
      const allProjects = await loadProjects();
      if (allProjects.length === 0) {
        // Create default project
        const defaultProject: Project = {
          id: uuid(),
          name: '默认项目',
          created_at: new Date(),
        };
        await db.projects.put(defaultProject);
        setProjects([defaultProject]);
        setActiveProjectId(defaultProject.id);
      } else {
        setActiveProjectId(allProjects[0].id);
      }
      db.apiConfigs.toArray().then(all => {
        const active = all.find(c => c.is_active);
        if (active) setApiConfig(active);
      });
    };
    init();
  }, [loadProjects]);

  // Reload papers when active project changes
  useEffect(() => {
    if (activeProjectId) {
      loadPapers(activeProjectId);
      setSelectedPaperId(null);
    }
  }, [activeProjectId, loadPapers]);

  const activeProject = projects.find(p => p.id === activeProjectId) || null;
  const selectedPaper = papers.find(p => p.id === selectedPaperId) || null;

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    const project: Project = { id: uuid(), name, created_at: new Date() };
    await db.projects.put(project);
    setProjects(prev => [...prev, project]);
    setActiveProjectId(project.id);
    setNewProjectName('');
    setShowProjectInput(false);
  };

  const handleDeleteProject = async (id: string) => {
    if (projects.length <= 1) {
      alert('至少保留一个项目');
      return;
    }
    // Delete all papers in this project
    const projectPapers = await db.papers.where('project_id').equals(id).toArray();
    for (const p of projectPapers) {
      await db.papers.delete(p.id);
    }
    await db.projects.delete(id);
    const updated = projects.filter(p => p.id !== id);
    setProjects(updated);
    if (activeProjectId === id) {
      setActiveProjectId(updated[0]?.id || null);
    }
  };

  const handlePapersAdded = useCallback((newPapers: Paper[]) => {
    setPapers(prev => [...newPapers, ...prev]);
  }, []);

  const handlePaperUpdate = useCallback((updated: Paper) => {
    setPapers(prev => prev.map(p => p.id === updated.id ? updated : p));
  }, []);

  const handleDeletePaper = useCallback(async (id: string) => {
    await db.papers.delete(id);
    if (selectedPaperId === id) setSelectedPaperId(null);
    setPapers(prev => prev.filter(p => p.id !== id));
  }, [selectedPaperId]);

  const handleReorder = useCallback((reordered: Paper[]) => {
    setPapers(reordered);
  }, []);

  const handleReanalyze = useCallback(async (paper: Paper, text?: string) => {
    if (!apiConfig) {
      alert('请先配置 API');
      return;
    }
    const rawText = text || paper.raw_text;
    if (!rawText) {
      alert('缺少论文原文，请重新选择 PDF 文件。');
      return;
    }
    // Mark as analyzing
    const analyzing = { ...paper, status: 'analyzing' as const };
    await db.papers.put(analyzing);
    setPapers(prev => prev.map(p => p.id === paper.id ? analyzing : p));

    try {
      const result = await analyzePaper(paper, rawText, apiConfig, customFields, disabledStandardFields);
      const updated: Paper = {
        ...paper,
        ...result,
        raw_text: rawText,
        analyzed_field_keys: Object.keys(customFields),
        status: 'completed' as const,
        analyzed_at: new Date(),
      };
      await db.papers.put(updated);
      setPapers(prev => prev.map(p => p.id === paper.id ? updated : p));
    } catch (err: any) {
      const failed = { ...paper, status: 'error' as const, error_message: err.message };
      await db.papers.put(failed);
      setPapers(prev => prev.map(p => p.id === paper.id ? failed : p));
    }
  }, [apiConfig, customFields, disabledStandardFields]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="px-6 xl:px-10">
          <div className="flex items-center justify-between h-14 gap-4">
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2 flex-shrink-0">
              📄 论文阅读助手
            </h1>

            {/* Project selector */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-xs text-gray-400 flex-shrink-0">📁</span>
              <select
                value={activeProjectId || ''}
                onChange={e => setActiveProjectId(e.target.value)}
                className="text-sm font-medium bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px] truncate"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {showProjectInput ? (
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    placeholder="项目名称"
                    className="text-sm px-2 py-1 border border-gray-300 rounded w-28 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={e => { e.key === 'Enter' && handleCreateProject(); e.key === 'Escape' && setShowProjectInput(false); }}
                    autoFocus
                  />
                  <button onClick={handleCreateProject} className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">✓</button>
                  <button onClick={() => setShowProjectInput(false)} className="text-xs px-2 py-1 text-gray-400 hover:text-gray-600">✕</button>
                </div>
              ) : (
                <button
                  onClick={() => setShowProjectInput(true)}
                  className="text-xs px-2 py-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                  title="新建项目"
                >
                  ＋新建项目
                </button>
              )}
              {projects.length > 1 && activeProject && (
                <button
                  onClick={() => {
                    if (confirm(`确定删除项目「${activeProject.name}」及其所有论文？此操作不可恢复。`)) {
                      handleDeleteProject(activeProject.id);
                    }
                  }}
                  className="text-xs px-1.5 py-1 text-gray-300 hover:text-red-500 rounded"
                  title="删除当前项目"
                >
                  🗑
                </button>
              )}
            </div>

            {/* Tab nav */}
            <nav className="flex gap-1 flex-shrink-0">
              {([
                ['papers', '📋 论文库'],
                ['api', '⚙️ API'],
                ['export', '📊 导出'],
              ] as [Tab, string][]).map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full px-6 xl:px-10 py-6">
        {activeTab === 'papers' && (
          <div className="space-y-6">
            {activeProject && (
              <DropZone
                onPapersAdded={handlePapersAdded}
                apiConfig={apiConfig}
                isAnalyzing={isAnalyzing}
                setIsAnalyzing={setIsAnalyzing}
                onPaperUpdate={handlePaperUpdate}
                customFields={customFields}
                setCustomFields={setCustomFields}
                disabledStandardFields={disabledStandardFields}
                setDisabledStandardFields={setDisabledStandardFields}
                onFieldOrderChange={refreshFieldOrder}
                projectId={activeProject.id}
              />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] xl:grid-cols-[340px_1fr] gap-6">
              <div>
                <PaperList
                  papers={papers}
                  selectedPaperId={selectedPaperId}
                  onSelect={setSelectedPaperId}
                  onDelete={handleDeletePaper}
                  onReorder={handleReorder}
                  onReanalyze={handleReanalyze}
                  currentCustomFieldKeys={Object.keys(customFields)}
                />
              </div>
              <div className="min-w-0">
                {selectedPaper ? (
                  <PaperCard
                    paper={selectedPaper}
                    apiConfig={apiConfig}
                    onUpdate={handlePaperUpdate}
                    fieldOrder={fieldOrder}
                    onFieldOrderChange={refreshFieldOrder}
                  />
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
                    <div className="text-5xl mb-4">📑</div>
                    <p className="text-lg">选择一篇论文查看分析结果</p>
                    <p className="text-sm mt-2">或拖入新论文开始分析</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'api' && (
          <ApiConfigPanel config={apiConfig} onConfigChange={setApiConfig} />
        )}

        {activeTab === 'export' && (
          <ExportPanel papers={papers} fieldOrder={fieldOrder} />
        )}
      </main>
    </div>
  );
}

export default App;
