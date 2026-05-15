'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';

interface Metrics {
  totalUsers: number;
  totalPublishedOpportunities: number;
  totalPendingReview: number;
  totalAICaptured: number;
  totalUserSubmitted: number;
  totalApplicationsStarted: number;
  totalApplicationsCompleted: number;
  totalQuestsStarted: number;
  totalQuestsCompleted: number;
  totalMatches: number;
  averageMatchScore: number;
  expiringSoon: number;
}

const Bar = ({ value, max, color }: { value: number; max: number; color: string }) => (
  <div className="w-full bg-gray-100 rounded-full h-2">
    <div
      className={`h-2 rounded-full ${color}`}
      style={{ width: max > 0 ? `${(value / max) * 100}%` : '0%' }}
    />
  </div>
);

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/metrics')
      .then(r => r.json())
      .then(setMetrics)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </AdminLayout>
    );
  }

  if (!metrics) {
    return (
      <AdminLayout>
        <div className="text-center text-gray-500 py-16">Erro ao carregar métricas.</div>
      </AdminLayout>
    );
  }

  const conversionRate = metrics.totalApplicationsStarted > 0
    ? ((metrics.totalApplicationsCompleted / metrics.totalApplicationsStarted) * 100).toFixed(1)
    : '0.0';

  const questCompletionRate = metrics.totalQuestsStarted > 0
    ? ((metrics.totalQuestsCompleted / metrics.totalQuestsStarted) * 100).toFixed(1)
    : '0.0';

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">Métricas de uso e performance da plataforma</p>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Usuários', value: metrics.totalUsers, color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: 'Publicadas', value: metrics.totalPublishedOpportunities, color: 'text-green-700', bg: 'bg-green-50' },
            { label: 'Em Revisão', value: metrics.totalPendingReview, color: 'text-yellow-700', bg: 'bg-yellow-50' },
            { label: 'Matches', value: metrics.totalMatches, color: 'text-purple-700', bg: 'bg-purple-50' },
          ].map(kpi => (
            <div key={kpi.label} className={`${kpi.bg} rounded-lg p-5`}>
              <p className="text-sm text-gray-600">{kpi.label}</p>
              <p className={`text-3xl font-bold ${kpi.color}`}>{kpi.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Opportunities by source */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Oportunidades por Fonte</h2>
          <div className="space-y-4">
            {[
              { label: '🤖 Capturadas por IA', value: metrics.totalAICaptured, color: 'bg-purple-500' },
              { label: '👤 Enviadas por Usuários', value: metrics.totalUserSubmitted, color: 'bg-blue-500' },
            ].map(item => {
              const total = metrics.totalAICaptured + metrics.totalUserSubmitted;
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">{item.label}</span>
                    <span className="font-medium">{item.value} ({total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%)</span>
                  </div>
                  <Bar value={item.value} max={total} color={item.color} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Applications & Quests */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Aplicações</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Iniciadas</span>
                <span className="font-medium">{metrics.totalApplicationsStarted}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Concluídas</span>
                <span className="font-medium">{metrics.totalApplicationsCompleted}</span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="text-gray-700 font-medium">Taxa de Conversão</span>
                <span className="font-bold text-green-600">{conversionRate}%</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quests</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Iniciadas</span>
                <span className="font-medium">{metrics.totalQuestsStarted}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Concluídas</span>
                <span className="font-medium">{metrics.totalQuestsCompleted}</span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="text-gray-700 font-medium">Taxa de Conclusão</span>
                <span className="font-bold text-purple-600">{questCompletionRate}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Match score & expiring */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Score Médio de Match</h2>
            <p className="text-5xl font-bold text-blue-600">{metrics.averageMatchScore.toFixed(1)}</p>
            <p className="text-sm text-gray-500 mt-1">de 0 a 100</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Expirando em 7 dias</h2>
            <p className={`text-5xl font-bold ${metrics.expiringSoon > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {metrics.expiringSoon}
            </p>
            <p className="text-sm text-gray-500 mt-1">oportunidades com deadline próximo</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
