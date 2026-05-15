'use client';

import AdminLayout from '@/components/admin/AdminLayout';

export default function SettingsPage() {
  const vars = [
    { name: 'DATABASE_URL', desc: 'PostgreSQL connection string', required: true },
    { name: 'OPENAI_API_KEY', desc: 'OpenAI API key for AI extraction', required: false },
    { name: 'ANTHROPIC_API_KEY', desc: 'Anthropic API key for AI extraction', required: false },
    { name: 'LLM_PROVIDER', desc: '"openai" or "anthropic"', required: true },
    { name: 'ADMIN_SECRET', desc: 'Token for admin access', required: true },
    { name: 'ADMIN_EMAIL', desc: 'Admin email address(es), comma-separated', required: true },
    { name: 'CRAWL_RATE_LIMIT_MS', desc: 'Delay between page requests (ms)', required: false },
    { name: 'NEXT_PUBLIC_APP_URL', desc: 'Base URL of the app', required: false },
  ];

  return (
    <AdminLayout>
      <div className="max-w-2xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-600 mt-1">Variáveis de ambiente e configurações do sistema.</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Variáveis de Ambiente</h2>
          <p className="text-sm text-gray-600 mb-4">
            Configure estas variáveis no arquivo <code className="bg-gray-100 px-1 rounded">.env.local</code> na raiz do projeto.
          </p>
          <div className="space-y-3">
            {vars.map(v => (
              <div key={v.name} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{v.name}</code>
                    {v.required && <span className="text-xs text-red-600 font-medium">Obrigatório</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Comandos Úteis</h2>
          <div className="space-y-3">
            {[
              { cmd: 'npm run dev', desc: 'Inicia o servidor de desenvolvimento' },
              { cmd: 'npm run build', desc: 'Build de produção' },
              { cmd: 'npx prisma db push', desc: 'Sincroniza o schema com o banco' },
              { cmd: 'npm run db:seed', desc: 'Popula as fontes de dados iniciais' },
              { cmd: 'npm run crawl', desc: 'Executa todos os crawlers manualmente' },
              { cmd: 'npx prisma studio', desc: 'Abre o Prisma Studio (UI do banco)' },
            ].map(item => (
              <div key={item.cmd} className="flex items-center gap-3">
                <code className="text-sm font-mono bg-gray-900 text-green-400 px-3 py-1 rounded min-w-fit">{item.cmd}</code>
                <span className="text-sm text-gray-600">{item.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
          <strong>Segurança:</strong> Nunca exponha <code>ADMIN_SECRET</code> ou chaves de API no código-fonte. Use sempre variáveis de ambiente.
        </div>
      </div>
    </AdminLayout>
  );
}
