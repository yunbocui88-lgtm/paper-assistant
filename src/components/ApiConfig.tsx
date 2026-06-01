import { useState, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import type { ApiConfig } from '../types';
import { db } from '../db';

interface Props {
  config: ApiConfig | null;
  onConfigChange: (config: ApiConfig | null) => void;
}

// ── Preset API providers ──────────────────────────────────
interface Preset {
  name: string;
  endpoint: string;
  model: string;
  note: string;
}

const PRESETS: Preset[] = [
  {
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    note: '性价比高，浏览器直连 ✅',
  },
  {
    name: '豆包 (Doubao / 字节)',
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    model: 'doubao-pro-32k',
    note: '字节跳动旗下，需在火山引擎创建推理点 ✅',
  },
  {
    name: 'Kimi (月之暗面)',
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    model: 'moonshot-v1-8k',
    note: '长文本处理能力强，128k 上下文 ✅',
  },
  {
    name: 'Qwen (通义千问 / 阿里云)',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: 'qwen-plus',
    note: '阿里云百炼平台，中文能力强 ✅',
  },
  {
    name: '小米 (MiLM)',
    endpoint: 'https://api.xiaomi.com/v1/chat/completions',
    model: 'mi-lm',
    note: '小米大模型，需确认官方 endpoint 是否更新',
  },
  {
    name: '智谱AI (GLM)',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4-flash',
    note: '清华系，GLM-4 系列模型 ✅',
  },
  {
    name: '硅基流动 (SiliconFlow)',
    endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
    model: 'deepseek-ai/DeepSeek-V3',
    note: '国内模型聚合平台，免费额度 ✅',
  },
  {
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
    note: '⚠️ 浏览器可能被 CORS 拦截',
  },
  {
    name: 'Groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    note: '海外平台，免费额度，速度极快 ✅',
  },
  {
    name: 'Together AI',
    endpoint: 'https://api.together.xyz/v1/chat/completions',
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    note: '海外开源模型聚合平台 ✅',
  },
  {
    name: 'Ollama (本地)',
    endpoint: 'http://localhost:11434/v1/chat/completions',
    model: 'llama3',
    note: '需先运行 ollama serve，免费本地运行',
  },
  {
    name: 'vLLM / OpenRouter / 自定义',
    endpoint: '',
    model: '',
    note: '任意 OpenAI 兼容接口，自行填写',
  },
];

// ── Component ─────────────────────────────────────────────
export function ApiConfigPanel({ config: _config, onConfigChange }: Props) {
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<ApiConfig, 'id' | 'created_at'>>({
    name: '',
    endpoint: '',
    model: '',
    api_key: '',
    temperature: 0.3,
    max_tokens: 8192,
    streaming: true,
    is_active: true,
  });
  const [testResult, setTestResult] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  useEffect(() => {
    db.apiConfigs.toArray().then(all => {
      setConfigs(all);
      const active = all.find(c => c.is_active);
      if (active) onConfigChange(active);
    });
  }, [onConfigChange]);

  const pickPreset = (presetName: string) => {
    const preset = PRESETS.find(p => p.name === presetName);
    if (!preset) return;
    setSelectedPreset(presetName);
    setForm(prev => ({
      ...prev,
      name: preset.name,
      endpoint: preset.endpoint,
      model: preset.model,
    }));
    setTestResult(null);
  };

  const handleEdit = (c: ApiConfig) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      endpoint: c.endpoint,
      model: c.model,
      api_key: c.api_key,
      temperature: c.temperature,
      max_tokens: c.max_tokens,
      streaming: c.streaming,
      is_active: c.is_active,
    });
    setSelectedPreset('');
    setShowForm(true);
    setTestResult(null);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.endpoint.trim() || !form.api_key.trim()) {
      alert('请填写名称、Endpoint 和 API Key');
      return;
    }

    const now = new Date();
    const saved: ApiConfig = {
      id: editingId || uuid(),
      ...form,
      created_at: now,
    };

    await db.apiConfigs.put(saved);
    const updated = await db.apiConfigs.toArray();
    setConfigs(updated);

    if (saved.is_active) {
      for (const c of updated) {
        if (c.id !== saved.id && c.is_active) {
          await db.apiConfigs.update(c.id, { is_active: false } as any);
        }
      }
    }

    onConfigChange(saved);
    setShowForm(false);
    setEditingId(null);
    setSelectedPreset('');
  };

  const handleDelete = async (id: string) => {
    await db.apiConfigs.delete(id);
    const updated = await db.apiConfigs.toArray();
    setConfigs(updated);
    const wasActive = configs.find(c => c.id === id)?.is_active;
    if (wasActive) {
      onConfigChange(updated.find(c => c.is_active) || null);
    }
  };

  const handleSetActive = async (id: string) => {
    for (const c of configs) {
      await db.apiConfigs.update(c.id, { is_active: (c.id === id) } as any);
    }
    const updated = await db.apiConfigs.toArray();
    setConfigs(updated);
    onConfigChange(updated.find(c => c.id === id) || null);
  };

  const handleTestConnection = async () => {
    setTestResult('测试中...');
    try {
      const response = await fetch(form.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${form.api_key}`,
        },
        body: JSON.stringify({
          model: form.model,
          messages: [{ role: 'user', content: 'Hi, reply with just "OK".' }],
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        setTestResult(`✅ 连接成功！模型回复: "${content}"`);
      } else {
        const text = await response.text().catch(() => '无法读取错误信息');
        if (response.status === 401 || response.status === 403) {
          setTestResult(`❌ API Key 无效 (${response.status})。请检查 Key 是否正确`);
        } else if (response.status === 404) {
          setTestResult(`❌ Endpoint 地址不存在 (404)。请检查 URL 路径`);
        } else {
          setTestResult(`❌ 请求失败 (${response.status}): ${text.slice(0, 150)}`);
        }
      }
    } catch (err: any) {
      const msg = err.message || String(err);
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setTestResult(
          '❌ 网络请求被阻止。可能原因：\n' +
          '1. 浏览器 CORS 策略拦截（常见于 OpenAI）\n' +
          '2. 网络不通，请检查是否能访问该地址\n' +
          '3. 使用了 HTTP 而非 HTTPS\n' +
          '建议：尝试 DeepSeek / Groq，它们允许浏览器直连'
        );
      } else if (msg.includes('timeout') || msg.includes('Timeout')) {
        setTestResult('❌ 连接超时（15秒）。请检查网络或更换 API');
      } else {
        setTestResult(`❌ 连接失败: ${msg.slice(0, 200)}`);
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* ── Preset grid ──────────────────────────────── */}
      {!showForm && (
        <>
          <h2 className="text-lg font-bold text-gray-900 mb-1">⚙️ API 配置</h2>
          <p className="text-sm text-gray-500 mb-4">选择一个预设提供商，填入你的 API Key 即可</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            {PRESETS.map(preset => (
              <button
                key={preset.name}
                onClick={() => {
                  pickPreset(preset.name);
                  // Start editing with this preset
                  setEditingId(uuid());
                  setShowForm(true);
                  setForm(prev => ({
                    ...prev,
                    name: preset.name,
                    endpoint: preset.endpoint,
                    model: preset.model,
                    api_key: '',
                  }));
                  setSelectedPreset(preset.name);
                }}
                className={`text-left p-4 rounded-xl border transition-all hover:shadow-md ${
                  selectedPreset === preset.name
                    ? 'border-blue-400 bg-blue-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="text-sm font-medium text-gray-800">{preset.name}</div>
                <div className="text-xs text-gray-400 mt-1 truncate font-mono">
                  {preset.endpoint || '自定义 endpoint'}
                </div>
                <div className="text-xs mt-1.5 text-gray-500">{preset.note}</div>
              </button>
            ))}
          </div>

          {/* ── Saved configs ──────────────────────────── */}
          {configs.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">已保存的配置</h3>
              <div className="space-y-2">
                {configs.map(c => (
                  <div
                    key={c.id}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
                      c.is_active ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg flex-shrink-0">
                        {c.is_active ? '⭐' : '🔌'}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{c.name}</div>
                        <div className="text-xs text-gray-400 truncate">{c.model}</div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 ml-2">
                      {!c.is_active && (
                        <button onClick={() => handleSetActive(c.id)}
                          className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded">
                          启用
                        </button>
                      )}
                      <button onClick={() => handleEdit(c)}
                        className="text-xs px-2 py-1 text-gray-500 hover:bg-gray-100 rounded">
                        编辑
                      </button>
                      <button onClick={() => handleDelete(c.id)}
                        className="text-xs px-2 py-1 text-red-400 hover:bg-red-50 rounded">
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Edit form ────────────────────────────────── */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              {editingId && configs.find(c => c.id === editingId) ? '编辑' : '新增'} API 配置
            </h2>
            {selectedPreset && (
              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full">
                {selectedPreset}
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">名称</label>
              <input
                type="text" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                readOnly={!!selectedPreset && selectedPreset !== 'vLLM / OpenRouter / 自定义'}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">API Endpoint URL</label>
              <input
                type="url" value={form.endpoint}
                onChange={e => setForm({ ...form, endpoint: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                readOnly={!!selectedPreset && selectedPreset !== 'vLLM / OpenRouter / 自定义'}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">模型名称</label>
              <input
                type="text" value={form.model}
                onChange={e => setForm({ ...form, model: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">API Key</label>
              <input
                type="password" value={form.api_key}
                onChange={e => setForm({ ...form, api_key: e.target.value })}
                placeholder="sk-..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">🔒 仅存储在浏览器本地，不会上传</p>
            </div>

            <details className="text-sm">
              <summary className="text-gray-500 cursor-pointer">⚙️ 高级选项</summary>
              <div className="mt-3 space-y-3 pl-2">
                <div className="flex items-center gap-4">
                  <label className="text-xs text-gray-500 w-24">Temperature</label>
                  <input type="range" min="0" max="1" step="0.1" value={form.temperature}
                    onChange={e => setForm({ ...form, temperature: parseFloat(e.target.value) })}
                    className="flex-1" />
                  <span className="text-xs text-gray-600 w-8">{form.temperature}</span>
                </div>
                <div className="flex items-center gap-4">
                  <label className="text-xs text-gray-500 w-24">Max Tokens</label>
                  <input type="number" value={form.max_tokens}
                    onChange={e => setForm({ ...form, max_tokens: parseInt(e.target.value) || 8192 })}
                    className="w-24 px-2 py-1 border border-gray-300 rounded text-sm" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.streaming}
                    onChange={e => setForm({ ...form, streaming: e.target.checked })}
                    className="accent-blue-600" />
                  <span className="text-xs text-gray-600">启用流式输出（分析结果实时显示）</span>
                </label>
              </div>
            </details>

            {testResult && (
              <div className={`text-xs px-3 py-2 rounded whitespace-pre-line ${
                testResult.includes('✅') ? 'bg-green-50 text-green-700' :
                testResult.includes('测试中') ? 'bg-blue-50 text-blue-700' :
                'bg-red-50 text-red-700'
              }`}>
                {testResult}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={handleTestConnection}
                className="flex-1 px-4 py-2 border border-green-300 text-green-700 rounded-lg text-sm hover:bg-green-50">
                🔌 测试连接
              </button>
              <button onClick={handleSave}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                💾 保存
              </button>
              <button onClick={() => { setShowForm(false); setEditingId(null); setSelectedPreset(''); }}
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
