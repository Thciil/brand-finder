import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import type { CompanyWithRelations } from '../types';

function CompanyPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<CompanyWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Message generation state
  const [generatingMessage, setGeneratingMessage] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState<{ subject: string; body: string } | null>(null);

  const loadCompany = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const result = await api.getCompany(parseInt(id));
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load company');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompany();
  }, [id]);

  const handleRequalify = async () => {
    if (!id || !confirm('Re-run qualification for this company?')) return;

    try {
      await api.qualifyCompany(parseInt(id));
      loadCompany();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to qualify company');
    }
  };

  const handleGenerateMessage = async () => {
    if (!id) return;

    try {
      setGeneratingMessage(true);
      const result = await api.generateMessage(parseInt(id));
      setGeneratedMessage({ subject: result.subject, body: result.body });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to generate message');
    } finally {
      setGeneratingMessage(false);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!id) return;

    try {
      await api.updateStatus(parseInt(id), status);
      loadCompany();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading company details...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">{error || 'Company not found'}</div>
      </div>
    );
  }

  const { company, signals, contacts, people, outreach } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:text-blue-800 mb-4 flex items-center"
          >
            ← Back to Dashboard
          </button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{company.name}</h1>
              {company.website_url && (
                <a
                  href={company.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {company.website_url}
                </a>
              )}
              <div className="mt-2 flex items-center gap-4">
                <span className="text-sm text-gray-500">
                  Score: <span className="font-semibold">{company.qualification_score}</span>
                </span>
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    company.status === 'qualified'
                      ? 'bg-green-100 text-green-800'
                      : company.status === 'rejected'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {company.status}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRequalify}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Re-qualify
              </button>
              <select
                value={company.status}
                onChange={(e) => handleUpdateStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="unqualified">Unqualified</option>
                <option value="qualified">Qualified</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Sponsorship Signals */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Sponsorship Signals</h2>
          {signals.length === 0 ? (
            <p className="text-gray-500">No signals found yet. Try qualifying this company.</p>
          ) : (
            <ul className="space-y-2">
              {signals.map((signal) => (
                <li key={signal.id} className="flex items-start">
                  <span className="inline-block w-3 h-3 bg-blue-500 rounded-full mt-1 mr-3"></span>
                  <div>
                    <span className="font-semibold text-gray-700">{signal.signal_type}</span>
                    <p className="text-gray-600">{signal.signal_text}</p>
                    {signal.source_url && (
                      <a
                        href={signal.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Source
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Contact Paths */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Contact Paths</h2>
          {contacts.length === 0 ? (
            <p className="text-gray-500">No contact paths found yet. Try qualifying this company.</p>
          ) : (
            <ul className="space-y-4">
              {contacts.map((contact) => (
                <li key={contact.id} className="border-l-4 border-blue-500 pl-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{contact.value}</span>
                        {contact.is_primary && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                            ⭐ Primary
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        Type: {contact.path_type}
                        {contact.email_type && ` (${contact.email_type})`}
                      </p>
                      <p className="text-sm text-gray-600">Confidence: {contact.confidence_score}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Decision Makers */}
        {people.length > 0 && (
          <section className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Decision Makers</h2>
            <ul className="space-y-2">
              {people.map((person) => (
                <li key={person.id} className="flex items-center gap-2">
                  <span className="text-gray-900">{person.name}</span>
                  {person.job_title && (
                    <span className="text-gray-600">- {person.job_title}</span>
                  )}
                  {person.department && (
                    <span className="text-sm text-gray-500">({person.department})</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Generate Outreach */}
        <section className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Generate Outreach</h2>
            <button
              onClick={handleGenerateMessage}
              disabled={generatingMessage}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {generatingMessage ? 'Generating...' : 'Generate Message'}
            </button>
          </div>

          {generatedMessage && (
            <div className="border border-gray-300 rounded-lg p-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={generatedMessage.subject}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  />
                  <button
                    onClick={() => copyToClipboard(generatedMessage.subject)}
                    className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Body:</label>
                <div className="flex flex-col gap-2">
                  <textarea
                    value={generatedMessage.body}
                    readOnly
                    rows={10}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(generatedMessage.body)}
                    className="self-end px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  >
                    Copy Body
                  </button>
                </div>
              </div>
            </div>
          )}

          {outreach.length > 0 && !generatedMessage && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Previous Outreach:</h3>
              <ul className="space-y-2">
                {outreach.map((msg) => (
                  <li key={msg.id} className="border-l-2 border-gray-300 pl-3">
                    <div className="text-sm font-medium text-gray-900">{msg.subject}</div>
                    <div className="text-xs text-gray-500">
                      Status: {msg.status} | {new Date(msg.created_at).toLocaleDateString()}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default CompanyPage;
