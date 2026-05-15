'use client';

import { useState } from 'react';

interface FormData {
  title: string;
  opportunity_type: string;
  organization_name: string;
  source_url: string;
  application_url: string;
  application_deadline: string;
  short_description: string;
  country: string;
  is_remote: boolean;
  is_online: boolean;
  funding_type: string;
  education_levels: string[];
  fields_of_interest: string[];
  long_description: string;
  benefits: string[];
  costs_covered: string[];
  eligible_countries: string[];
  eligible_regions: string[];
  city: string;
  region: string;
  start_date: string;
  end_date: string;
  duration: string;
  language_requirements: string[];
  age_min: string;
  age_max: string;
  documents_required: string[];
  selection_criteria: string[];
  tags: string[];
  notes_from_submitter: string;
}

const initialFormData: FormData = {
  title: '',
  opportunity_type: '',
  organization_name: '',
  source_url: '',
  application_url: '',
  application_deadline: '',
  short_description: '',
  country: '',
  is_remote: false,
  is_online: false,
  funding_type: '',
  education_levels: [],
  fields_of_interest: [],
  long_description: '',
  benefits: [],
  costs_covered: [],
  eligible_countries: [],
  eligible_regions: [],
  city: '',
  region: '',
  start_date: '',
  end_date: '',
  duration: '',
  language_requirements: [],
  age_min: '',
  age_max: '',
  documents_required: [],
  selection_criteria: [],
  tags: [],
  notes_from_submitter: '',
};

const opportunityTypes = [
  { value: 'scholarship', label: 'Bolsa de Estudos' },
  { value: 'fellowship', label: 'Fellowship' },
  { value: 'internship', label: 'Estágio' },
  { value: 'job', label: 'Emprego' },
  { value: 'volunteering', label: 'Voluntariado' },
  { value: 'grant', label: 'Grant' },
  { value: 'competition', label: 'Competição' },
  { value: 'conference', label: 'Conferência' },
  { value: 'exchange_program', label: 'Programa de Intercâmbio' },
  { value: 'summer_program', label: 'Programa de Verão' },
  { value: 'online_course', label: 'Curso Online' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'research', label: 'Pesquisa' },
  { value: 'leadership_program', label: 'Programa de Liderança' },
  { value: 'immigration', label: 'Imigração' },
  { value: 'other', label: 'Outro' },
];

const fundingTypes = [
  { value: 'fully_funded', label: 'Totalmente Financiado' },
  { value: 'partially_funded', label: 'Parcialmente Financiado' },
  { value: 'paid', label: 'Pago' },
  { value: 'unpaid', label: 'Não Pago' },
  { value: 'stipend', label: 'Bolsa' },
  { value: 'tuition_only', label: 'Apenas Mensalidade' },
  { value: 'travel_only', label: 'Apenas Viagem' },
  { value: 'self_funded', label: 'Auto Financiado' },
  { value: 'unknown', label: 'Desconhecido' },
];

const educationLevels = [
  { value: 'high_school', label: 'Ensino Médio' },
  { value: 'gap_year', label: 'Ano Sabático' },
  { value: 'undergraduate', label: 'Graduação' },
  { value: 'masters', label: 'Mestrado' },
  { value: 'phd', label: 'Doutorado' },
  { value: 'postdoc', label: 'Pós-Doutorado' },
  { value: 'early_career', label: 'Início de Carreira' },
  { value: 'professional', label: 'Profissional' },
  { value: 'any', label: 'Qualquer Nível' },
];

export default function SubmitOpportunity() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayChange = (field: keyof FormData, values: string[]) => {
    setFormData(prev => ({ ...prev, [field]: values }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors([]);
    setSubmitMessage(null);

    try {
      // For MVP, we'll use mock user data
      // In production, this should come from authentication
      const response = await fetch('/api/opportunities/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-user-token',
          'x-user-email': 'user@example.com',
          'x-user-id': 'mock-user-id',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        setSubmitMessage(result.message);
        setFormData(initialFormData);
      } else {
        setErrors(result.details || [result.error]);
      }
    } catch (error) {
      setErrors(['Erro ao enviar oportunidade. Tente novamente.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Enviar Nova Oportunidade
            </h1>
            <p className="text-gray-600">
              Compartilhe uma oportunidade educacional ou profissional que você encontrou.
              Nossa equipe irá revisar antes de publicar no MatchED.
            </p>
          </div>

          {submitMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800">{submitMessage}</p>
            </div>
          )}

          {errors.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <ul className="text-red-800">
                {errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Information */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">Informações Básicas</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Título da Oportunidade *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Bolsa de Estudos para Engenharia"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Oportunidade *
                  </label>
                  <select
                    required
                    value={formData.opportunity_type}
                    onChange={(e) => handleInputChange('opportunity_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Selecione...</option>
                    {opportunityTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Organização *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.organization_name}
                    onChange={(e) => handleInputChange('organization_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nome da organização responsável"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Financiamento *
                  </label>
                  <select
                    required
                    value={formData.funding_type}
                    onChange={(e) => handleInputChange('funding_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Selecione...</option>
                    {fundingTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Links */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">Links</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    URL da Fonte *
                  </label>
                  <input
                    type="url"
                    required
                    value={formData.source_url}
                    onChange={(e) => handleInputChange('source_url', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    URL de Candidatura
                  </label>
                  <input
                    type="url"
                    value={formData.application_url}
                    onChange={(e) => handleInputChange('application_url', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">Descrição</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descrição Curta *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={formData.short_description}
                    onChange={(e) => handleInputChange('short_description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Resumo da oportunidade em poucas palavras"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descrição Completa
                  </label>
                  <textarea
                    rows={5}
                    value={formData.long_description}
                    onChange={(e) => handleInputChange('long_description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Descrição detalhada da oportunidade"
                  />
                </div>
              </div>
            </div>

            {/* Eligibility */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">Elegibilidade</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Níveis Educacionais *
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3">
                    {educationLevels.map(level => (
                      <label key={level.value} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.education_levels.includes(level.value)}
                          onChange={(e) => {
                            const newLevels = e.target.checked
                              ? [...formData.education_levels, level.value]
                              : formData.education_levels.filter(l => l !== level.value);
                            handleArrayChange('education_levels', newLevels);
                          }}
                          className="mr-2"
                        />
                        {level.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Áreas de Interesse *
                  </label>
                  <textarea
                    rows={4}
                    value={formData.fields_of_interest.join('\n')}
                    onChange={(e) => handleArrayChange('fields_of_interest', e.target.value.split('\n').filter(v => v.trim()))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Uma área por linha:&#10;Engenharia&#10;Ciência da Computação&#10;Medicina"
                  />
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">Localização</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    País
                  </label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => handleInputChange('country', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Brasil, Estados Unidos"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_remote}
                      onChange={(e) => handleInputChange('is_remote', e.target.checked)}
                      className="mr-2"
                    />
                    Remoto
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_online}
                      onChange={(e) => handleInputChange('is_online', e.target.checked)}
                      className="mr-2"
                    />
                    Online
                  </label>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">Datas</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Deadline de Candidatura
                  </label>
                  <input
                    type="date"
                    value={formData.application_deadline}
                    onChange={(e) => handleInputChange('application_deadline', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data de Início
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => handleInputChange('start_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data de Fim
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => handleInputChange('end_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">Informações Adicionais</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Benefícios
                  </label>
                  <textarea
                    rows={3}
                    value={formData.benefits.join('\n')}
                    onChange={(e) => handleArrayChange('benefits', e.target.value.split('\n').filter(v => v.trim()))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Um benefício por linha"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custos Cobertos
                  </label>
                  <textarea
                    rows={3}
                    value={formData.costs_covered.join('\n')}
                    onChange={(e) => handleArrayChange('costs_covered', e.target.value.split('\n').filter(v => v.trim()))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Um custo por linha:&#10;Passagem aérea&#10;Hospedagem&#10;Mensalidade"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Documentos Necessários
                  </label>
                  <textarea
                    rows={3}
                    value={formData.documents_required.join('\n')}
                    onChange={(e) => handleArrayChange('documents_required', e.target.value.split('\n').filter(v => v.trim()))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Um documento por linha"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observações
                  </label>
                  <textarea
                    rows={3}
                    value={formData.notes_from_submitter}
                    onChange={(e) => handleInputChange('notes_from_submitter', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Informações adicionais que gostaria de compartilhar"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Enviando...' : 'Enviar Oportunidade'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}