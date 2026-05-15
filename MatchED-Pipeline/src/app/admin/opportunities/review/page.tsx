'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';

interface Opportunity {
  id: string;
  title: string;
  organization_name: string;
  opportunity_type: string;
  funding_type: string;
  short_description: string;
  source_url: string;
  application_url?: string;
  application_deadline?: string;
  country?: string;
  city?: string;
  is_remote: boolean;
  is_online: boolean;
  submission_source: 'USER' | 'AI';
  status: string;
  education_levels: string[];
  fields_of_interest: string[];
  benefits: string[];
  costs_covered: string[];
  documents_required: string[];
  notes_from_submitter?: string;
  created_at: string;
  submitted_by?: {
    email: string;
  };
}

const StatusBadge = ({ status }: { status: string }) => {
  const statusConfig = {
    NEEDS_REVIEW: { color: 'bg-yellow-100 text-yellow-800', label: 'Precisa Revisão' },
    USER_SUBMITTED_PENDING: { color: 'bg-blue-100 text-blue-800', label: 'Enviado por Usuário' },
    AI_CAPTURED_PENDING: { color: 'bg-purple-100 text-purple-800', label: 'Capturado por IA' },
    APPROVED: { color: 'bg-green-100 text-green-800', label: 'Aprovado' },
    PUBLISHED: { color: 'bg-green-100 text-green-800', label: 'Publicado' },
    REJECTED: { color: 'bg-red-100 text-red-800', label: 'Rejeitado' },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || {
    color: 'bg-gray-100 text-gray-800',
    label: status,
  };

  return (
    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
      {config.label}
    </span>
  );
};

const OpportunityCard = ({
  opportunity,
  onApprove,
  onReject,
  onEdit,
}: {
  opportunity: Opportunity;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (opportunity: Opportunity) => void;
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatDeadline = (deadline?: string) => {
    if (!deadline) return 'Não informado';
    const date = new Date(deadline);
    const now = new Date();
    const daysUntil = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) return `Expirado (${formatDate(deadline)})`;
    if (daysUntil === 0) return 'Hoje';
    if (daysUntil === 1) return 'Amanhã';
    return `${daysUntil} dias (${formatDate(deadline)})`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{opportunity.title}</h3>
            <StatusBadge status={opportunity.status} />
          </div>
          <p className="text-sm text-gray-600 mb-2">
            {opportunity.organization_name} • {opportunity.opportunity_type} • {opportunity.funding_type}
          </p>
          <p className="text-sm text-gray-500">
            Enviado em {formatDate(opportunity.created_at)}
            {opportunity.submitted_by && ` por ${opportunity.submitted_by.email}`}
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => onEdit(opportunity)}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Editar
          </button>
          <button
            onClick={() => onReject(opportunity.id)}
            className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
          >
            Rejeitar
          </button>
          <button
            onClick={() => onApprove(opportunity.id)}
            className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
          >
            Aprovar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm font-medium text-gray-700">Localização</p>
          <p className="text-sm text-gray-600">
            {opportunity.country || 'Não informado'}
            {opportunity.city && `, ${opportunity.city}`}
            {opportunity.is_remote && ' (Remoto)'}
            {opportunity.is_online && ' (Online)'}
          </p>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700">Deadline</p>
          <p className="text-sm text-gray-600">{formatDeadline(opportunity.application_deadline)}</p>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm font-medium text-gray-700 mb-1">Descrição</p>
        <p className="text-sm text-gray-600 line-clamp-2">{opportunity.short_description}</p>
      </div>

      {opportunity.education_levels.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-1">Níveis Educacionais</p>
          <div className="flex flex-wrap gap-1">
            {opportunity.education_levels.map(level => (
              <span key={level} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                {level}
              </span>
            ))}
          </div>
        </div>
      )}

      {opportunity.fields_of_interest.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-1">Áreas de Interesse</p>
          <div className="flex flex-wrap gap-1">
            {opportunity.fields_of_interest.map(field => (
              <span key={field} className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                {field}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="flex space-x-4 text-sm text-gray-500">
          <a
            href={opportunity.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600"
          >
            Ver fonte
          </a>
          {opportunity.application_url && (
            <a
              href={opportunity.application_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600"
            >
              Ver aplicação
            </a>
          )}
        </div>
        <span className="text-xs text-gray-400">
          {opportunity.submission_source === 'USER' ? '👤 Usuário' : '🤖 IA'}
        </span>
      </div>
    </div>
  );
};

export default function OpportunityReview() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchOpportunities();
  }, [filter]);

  const fetchOpportunities = async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);

      const response = await fetch(`/api/admin/opportunities/review?${params}`);

      if (response.ok) {
        const data = await response.json();
        setOpportunities(data);
      } else {
        console.error('Failed to fetch opportunities');
      }
    } catch (error) {
      console.error('Error fetching opportunities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/opportunities/${id}/approve`, {
        method: 'POST',
      });

      if (response.ok) {
        fetchOpportunities(); // Refresh the list
      } else {
        alert('Erro ao aprovar oportunidade');
      }
    } catch (error) {
      console.error('Error approving opportunity:', error);
      alert('Erro ao aprovar oportunidade');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Motivo da rejeição (opcional):');
    try {
      const response = await fetch(`/api/admin/opportunities/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (response.ok) {
        fetchOpportunities(); // Refresh the list
      } else {
        alert('Erro ao rejeitar oportunidade');
      }
    } catch (error) {
      console.error('Error rejecting opportunity:', error);
      alert('Erro ao rejeitar oportunidade');
    }
  };

  const handleEdit = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Revisar Oportunidades</h1>
            <p className="text-gray-600 mt-2">
              Gerencie oportunidades enviadas por usuários e capturadas pela IA
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Filtrar por status:</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todas aguardando revisão</option>
              <option value="USER_SUBMITTED_PENDING">Enviadas por usuários</option>
              <option value="AI_CAPTURED_PENDING">Capturadas por IA</option>
              <option value="NEEDS_REVIEW">Precisam revisão</option>
            </select>
          </div>
        </div>

        {/* Opportunities List */}
        <div className="space-y-4">
          {opportunities.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">Nenhuma oportunidade encontrada para revisão.</p>
            </div>
          ) : (
            opportunities.map((opportunity) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                onApprove={handleApprove}
                onReject={handleReject}
                onEdit={handleEdit}
              />
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
}