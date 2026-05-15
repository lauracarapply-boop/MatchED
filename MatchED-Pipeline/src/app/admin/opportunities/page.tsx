'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';

interface Opportunity {
  id: string;
  title: string;
  organization_name: string | null;
  opportunity_type: string;
  funding_type: string;
  status: string;
  country: string | null;
  application_deadline: string | null;
  submission_source: string;
  source_name: string;
  source_url: string;
  confidence_score: number;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'PUBLISHED', label: 'Publicados' },
  { value: 'APPROVED', label: 'Aprovados' },
  { value: 'NEEDS_REVIEW', label: 'Em Revisão' },
  { value: 'USER_SUBMITTED_PENDING', label: 'Enviados por Usuários' },
  { value: 'AI_CAPTURED_PENDING', label: 'Capturados por IA' },
  { value: 'REJECTED', label: 'Rejeitados' },
];

const STATUS_BADGE: Record<string, string> = {
  PUBLISHED: 'bg-green-100 text-green-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  NEEDS_REVIEW: 'bg-yellow-100 text-yellow-800',
  USER_SUBMITTED_PENDING: 'bg-indigo-100 text-indigo-800',
  AI_CAPTURED_PENDING: 'bg-purple-100 text-purple-800',
  REJECTED: 'bg-red-100 text-red-800',
  DRAFT: 'bg-gray-100 text-gray-800',
};

export default function AllOpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (status !== 'all') params.set('status', status);
      const res = await fetch(`/api/admin/opportunities?${params}`);
      if (res.ok) {
        const data = await res.json();
        setOpportunities(data.opportunities || []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => { fetchOpportunities(); }, [fetchOpportunities]);

  const handleAction = async (id: string, action: string) => {
    try {
      const res = await fetch(`/api/admin/opportunities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) fetchOpportunities();
      else alert('Erro ao atualizar oportunidade');
    } catch { alert('Erro ao atualizar oportunidade'); }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Todas as Oportunidades</h1>
            <p className="text-gray-600 mt-1">{total} encontrada(s)</p>
          </div>
          <Link
            href="/admin/opportunities/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + Adicionar
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-4 flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Status:</label>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
          ) : opportunities.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Nenhuma oportunidade encontrada.</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Título</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fonte</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confiança</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deadline</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {opportunities.map(opp => (
                  <tr key={opp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{opp.title}</div>
                      <div className="text-xs text-gray-500">{opp.organization_name}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{opp.opportunity_type}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_BADGE[opp.status] || 'bg-gray-100 text-gray-800'}`}>
                        {opp.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {opp.submission_source === 'AI' ? '🤖 IA' : opp.submission_source === 'USER' ? '👤 Usuário' : '⚙️ Admin'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {(opp.confidence_score * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {opp.application_deadline ? new Date(opp.application_deadline).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <a href={opp.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">Ver</a>
                        {(opp.status === 'NEEDS_REVIEW' || opp.status === 'AI_CAPTURED_PENDING' || opp.status === 'USER_SUBMITTED_PENDING') && (
                          <>
                            <button onClick={() => handleAction(opp.id, 'publish')} className="text-green-600 hover:underline text-xs">Publicar</button>
                            <button onClick={() => handleAction(opp.id, 'reject')} className="text-red-600 hover:underline text-xs">Rejeitar</button>
                          </>
                        )}
                        {opp.status === 'APPROVED' && (
                          <button onClick={() => handleAction(opp.id, 'publish')} className="text-green-600 hover:underline text-xs">Publicar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Página {page} de {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">← Anterior</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">Próxima →</button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
