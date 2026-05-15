'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';

interface Source {
  id: string;
  name: string;
  base_url: string;
  is_active: boolean;
  crawl_frequency: string;
  last_crawled_at: string | null;
  last_successful_crawl_at: string | null;
  last_error: string | null;
  created_at: string;
}

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [crawling, setCrawling] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/sources')
      .then(r => r.json())
      .then(d => setSources(d.sources || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const triggerCrawl = async (sourceId: string, sourceName: string) => {
    setCrawling(sourceId);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/crawl/${sourceId}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `✅ Crawl de "${sourceName}" concluído: ${data.opportunitiesCreated} criadas, ${data.opportunitiesSkipped} ignoradas.` });
      } else {
        setMessage({ type: 'error', text: `Erro: ${data.error}` });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: `Erro ao iniciar crawl: ${e.message}` });
    } finally {
      setCrawling(null);
    }
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleString('pt-BR') : '—';

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fontes IA</h1>
          <p className="text-gray-600 mt-1">Gerencie as fontes de dados e dispare crawls manualmente.</p>
        </div>

        {message && (
          <div className={`p-4 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
          ) : sources.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="mb-2">Nenhuma fonte configurada.</p>
              <p className="text-xs">Execute <code className="bg-gray-100 px-1 rounded">npm run db:seed</code> para adicionar as fontes padrão.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fonte</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Frequência</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Último Crawl</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sources.map(source => (
                  <tr key={source.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{source.name}</div>
                      <a href={source.base_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">{source.base_url}</a>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{source.crawl_frequency}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      <div>{formatDate(source.last_successful_crawl_at)}</div>
                      {source.last_error && <div className="text-red-500 mt-0.5 truncate max-w-xs" title={source.last_error}>{source.last_error}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${source.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                        {source.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => triggerCrawl(source.id, source.name)}
                        disabled={crawling === source.id || !source.is_active}
                        className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                      >
                        {crawling === source.id ? '⏳ Crawling...' : '🤖 Executar Crawl'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <strong>Nota:</strong> O crawl pode levar alguns minutos dependendo do número de páginas. Fique nesta página para ver o resultado.
        </div>
      </div>
    </AdminLayout>
  );
}
