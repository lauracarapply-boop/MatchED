'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';

const OPPORTUNITY_TYPES = [
  'SCHOLARSHIP', 'FELLOWSHIP', 'INTERNSHIP', 'JOB', 'VOLUNTEERING',
  'GRANT', 'COMPETITION', 'CONFERENCE', 'EXCHANGE_PROGRAM', 'SUMMER_PROGRAM',
  'ONLINE_COURSE', 'WORKSHOP', 'RESEARCH', 'LEADERSHIP_PROGRAM', 'OTHER',
];

const FUNDING_TYPES = [
  'FULLY_FUNDED', 'PARTIALLY_FUNDED', 'PAID', 'UNPAID', 'STIPEND',
  'TUITION_ONLY', 'TRAVEL_ONLY', 'SELF_FUNDED', 'UNKNOWN',
];

const EDUCATION_LEVELS = [
  'HIGH_SCHOOL', 'GAP_YEAR', 'UNDERGRADUATE', 'MASTERS',
  'PHD', 'POSTDOC', 'EARLY_CAREER', 'PROFESSIONAL', 'ANY',
];

export default function NewOpportunityPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);

  const toggleLevel = (level: string) => {
    setSelectedLevels(prev =>
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    );
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = e.currentTarget;
    const data = new FormData(form);

    const body = {
      title: data.get('title'),
      organization_name: data.get('organization_name'),
      opportunity_type: data.get('opportunity_type'),
      funding_type: data.get('funding_type'),
      description_short: data.get('description_short'),
      description_long: data.get('description_long'),
      source_url: data.get('source_url'),
      application_url: data.get('application_url'),
      application_deadline: data.get('application_deadline') || null,
      country: data.get('country'),
      city: data.get('city'),
      is_remote: data.get('is_remote') === 'on',
      is_online: data.get('is_online') === 'on',
      education_levels: selectedLevels,
      fields_of_interest: String(data.get('fields_of_interest') || '').split(',').map(s => s.trim()).filter(Boolean),
      tags: String(data.get('tags') || '').split(',').map(s => s.trim()).filter(Boolean),
    };

    try {
      const res = await fetch('/api/admin/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao criar oportunidade');

      router.push('/admin/opportunities');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <AdminLayout>
      <div className="max-w-3xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Adicionar Oportunidade</h1>
          <p className="text-gray-600 mt-1">Crie uma nova oportunidade manualmente. Será publicada imediatamente.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className={labelClass}>Título *</label>
              <input name="title" required className={inputClass} placeholder="ex: Yale Young Global Scholars 2027" />
            </div>

            <div>
              <label className={labelClass}>Organização</label>
              <input name="organization_name" className={inputClass} placeholder="ex: Yale University" />
            </div>

            <div>
              <label className={labelClass}>País</label>
              <input name="country" className={inputClass} placeholder="ex: United States" />
            </div>

            <div>
              <label className={labelClass}>Cidade</label>
              <input name="city" className={inputClass} placeholder="ex: New Haven, CT" />
            </div>

            <div>
              <label className={labelClass}>Tipo</label>
              <select name="opportunity_type" className={inputClass}>
                {OPPORTUNITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className={labelClass}>Financiamento</label>
              <select name="funding_type" className={inputClass}>
                {FUNDING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className={labelClass}>Deadline</label>
              <input name="application_deadline" type="date" className={inputClass} />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>URL da Fonte *</label>
              <input name="source_url" required type="url" className={inputClass} placeholder="https://..." />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>URL de Aplicação</label>
              <input name="application_url" type="url" className={inputClass} placeholder="https://..." />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>Descrição Curta</label>
              <textarea name="description_short" rows={2} className={inputClass} placeholder="Resumo em 1-2 frases..." />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>Descrição Completa</label>
              <textarea name="description_long" rows={5} className={inputClass} placeholder="Descrição detalhada..." />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>Níveis Educacionais</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {EDUCATION_LEVELS.map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => toggleLevel(level)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      selectedLevels.includes(level)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Áreas de Interesse (vírgulas)</label>
              <input name="fields_of_interest" className={inputClass} placeholder="Technology, Leadership, Research" />
            </div>

            <div>
              <label className={labelClass}>Tags (vírgulas)</label>
              <input name="tags" className={inputClass} placeholder="Stem, Prestigious, Free" />
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input name="is_remote" type="checkbox" className="rounded" />
                Remoto
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input name="is_online" type="checkbox" className="rounded" />
                Online
              </label>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 text-sm font-medium"
            >
              {submitting ? 'Criando...' : 'Criar e Publicar'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
