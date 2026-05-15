export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            MatchED Opportunity Intelligence Pipeline
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Discovering and managing educational opportunities with AI
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-2">AI-Powered Extraction</h3>
              <p className="text-gray-600">
                Automatically extract structured opportunity data from web pages using advanced AI.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-2">Multi-Source Crawling</h3>
              <p className="text-gray-600">
                Discover opportunities from multiple websites with intelligent link discovery.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-2">Quality Assurance</h3>
              <p className="text-gray-600">
                Human review system with confidence scoring and deduplication.
              </p>
            </div>
          </div>
          <div className="mt-8">
            <a
              href="/admin/login"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              Admin Login
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}