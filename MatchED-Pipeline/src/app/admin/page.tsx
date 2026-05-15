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

const MetricCard = ({ title, value, subtitle, color = 'blue' }: {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div className={`p-6 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
          {subtitle && <p className="text-sm opacity-75 mt-1">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
};

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/admin/metrics');

      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      } else {
        console.error('Failed to fetch metrics');
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Visão geral do sistema MatchED</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <MetricCard
            title="Total de Usuários"
            value={metrics?.totalUsers || 0}
            color="blue"
          />

          <MetricCard
            title="Oportunidades Publicadas"
            value={metrics?.totalPublishedOpportunities || 0}
            color="green"
          />

          <MetricCard
            title="Aguardando Revisão"
            value={metrics?.totalPendingReview || 0}
            subtitle="Precisa de atenção"
            color="yellow"
          />

          <MetricCard
            title="Capturadas por IA"
            value={metrics?.totalAICaptured || 0}
            color="purple"
          />

          <MetricCard
            title="Enviadas por Usuários"
            value={metrics?.totalUserSubmitted || 0}
            color="blue"
          />

          <MetricCard
            title="Aplicações Iniciadas"
            value={metrics?.totalApplicationsStarted || 0}
            color="green"
          />

          <MetricCard
            title="Aplicações Concluídas"
            value={metrics?.totalApplicationsCompleted || 0}
            color="green"
          />

          <MetricCard
            title="Quests Iniciadas"
            value={metrics?.totalQuestsStarted || 0}
            color="purple"
          />

          <MetricCard
            title="Quests Concluídas"
            value={metrics?.totalQuestsCompleted || 0}
            color="purple"
          />

          <MetricCard
            title="Matches Gerados"
            value={metrics?.totalMatches || 0}
            color="blue"
          />

          <MetricCard
            title="Score Médio de Match"
            value={metrics?.averageMatchScore ? metrics.averageMatchScore.toFixed(1) : '0.0'}
            subtitle="de 0 a 100"
            color="green"
          />

          <MetricCard
            title="Expirando em 7 dias"
            value={metrics?.expiringSoon || 0}
            subtitle="deadlines próximos"
            color="red"
          />
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Atividades Recentes</h2>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Sistema</span> processou 5 novas oportunidades da IA
                </p>
                <p className="text-xs text-gray-400">2 horas atrás</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">João Silva</span> enviou uma nova oportunidade
                </p>
                <p className="text-xs text-gray-400">4 horas atrás</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Admin</span> aprovou 3 oportunidades
                </p>
                <p className="text-xs text-gray-400">6 horas atrás</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Ações Rápidas</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/admin/opportunities/review"
              className="flex items-center justify-center px-4 py-3 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-colors"
            >
              <span className="mr-2">🔍</span>
              Revisar Oportunidades
            </a>

            <a
              href="/admin/opportunities/new"
              className="flex items-center justify-center px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <span className="mr-2">➕</span>
              Adicionar Manualmente
            </a>

            <a
              href="/admin/sources"
              className="flex items-center justify-center px-4 py-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <span className="mr-2">🤖</span>
              Executar Crawler
            </a>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}