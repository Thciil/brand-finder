import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import type { Company } from '../types';

function DashboardPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [minScoreFilter, setMinScoreFilter] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Discover modal
  const [showDiscoverModal, setShowDiscoverModal] = useState(false);
  const [discoverKeywords, setDiscoverKeywords] = useState('');
  const [discovering, setDiscovering] = useState(false);

  // Stats
  const [stats, setStats] = useState({ total: 0, qualified: 0, avgScore: 0 });

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (statusFilter) filters.status = statusFilter;
      if (minScoreFilter) filters.minScore = parseInt(minScoreFilter);
      if (searchFilter) filters.search = searchFilter;

      const data = await api.getCompanies(filters);
      setCompanies(data.companies);

      // Calculate stats
      const qualified = data.companies.filter((c: Company) => c.status === 'qualified').length;
      const avgScore = data.companies.length > 0
        ? Math.round(data.companies.reduce((sum: number, c: Company) => sum + c.qualification_score, 0) / data.companies.length)
        : 0;

      setStats({
        total: data.total,
        qualified,
        avgScore,
      });

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, [statusFilter, minScoreFilter, searchFilter]);

  const handleDiscover = async () => {
    if (!discoverKeywords.trim()) return;

    try {
      setDiscovering(true);
      await api.discoverCompanies(discoverKeywords);
      setShowDiscoverModal(false);
      setDiscoverKeywords('');
      loadCompanies();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to discover companies');
    } finally {
      setDiscovering(false);
    }
  };

  const handleQualify = async (id: number) => {
    try {
      await api.qualifyCompany(id);
      loadCompanies();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to qualify company');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Sponsor Pathfinder</h1>
            <button
              onClick={() => setShowDiscoverModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              + Discover Companies
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm font-medium text-gray-500">Total Companies</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm font-medium text-gray-500">Qualified</div>
            <div className="mt-2 text-3xl font-semibold text-green-600">{stats.qualified}</div>
            <div className="text-sm text-gray-500">{stats.total > 0 ? Math.round((stats.qualified / stats.total) * 100) : 0}%</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm font-medium text-gray-500">Avg Score</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900">{stats.avgScore}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search companies..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="unqualified">Unqualified</option>
              <option value="qualified">Qualified</option>
              <option value="rejected">Rejected</option>
            </select>
            <input
              type="number"
              placeholder="Min Score"
              value={minScoreFilter}
              onChange={(e) => setMinScoreFilter(e.target.value)}
              className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Companies Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading companies...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">{error}</div>
          ) : companies.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No companies found. Click "Discover Companies" to get started!
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {companies.map((company) => (
                  <tr key={company.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{company.name}</div>
                      {company.website_url && (
                        <div className="text-sm text-gray-500">{company.website_url}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          company.status === 'qualified'
                            ? 'bg-green-100 text-green-800'
                            : company.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {company.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {company.qualification_score}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {company.category || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      {company.status === 'unqualified' && (
                        <button
                          onClick={() => handleQualify(company.id)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Qualify
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/companies/${company.id}`)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Discover Modal */}
      {showDiscoverModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Discover Companies</h2>
            <p className="text-sm text-gray-600 mb-4">
              Enter keywords to discover companies from Wikipedia (e.g., "sportswear", "fashion", "tech")
            </p>
            <input
              type="text"
              value={discoverKeywords}
              onChange={(e) => setDiscoverKeywords(e.target.value)}
              placeholder="Enter keywords..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={discovering}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDiscoverModal(false)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
                disabled={discovering}
              >
                Cancel
              </button>
              <button
                onClick={handleDiscover}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                disabled={discovering || !discoverKeywords.trim()}
              >
                {discovering ? 'Discovering...' : 'Discover'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
