const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.message || 'API request failed');
  }

  return response.json();
}

export const api = {
  // Companies
  getCompanies: async (filters?: {
    status?: string;
    minScore?: number;
    search?: string;
    limit?: number;
    offset?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.minScore !== undefined) params.append('minScore', filters.minScore.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());

    const query = params.toString();
    return fetchAPI(`/api/companies${query ? `?${query}` : ''}`);
  },

  getCompany: async (id: number) => {
    return fetchAPI(`/api/companies?id=${id}`);
  },

  // Discovery
  discoverCompanies: async (keywords: string, region?: string, limit?: number) => {
    return fetchAPI('/api/discover', {
      method: 'POST',
      body: JSON.stringify({ keywords, region, limit }),
    });
  },

  // Qualification
  qualifyCompany: async (id: number) => {
    return fetchAPI(`/api/qualify?id=${id}`, {
      method: 'POST',
    });
  },

  // Message Generation
  generateMessage: async (id: number) => {
    return fetchAPI(`/api/generate-message?id=${id}`, {
      method: 'POST',
    });
  },

  // Update Status
  updateStatus: async (id: number, status: string, qualification_score?: number) => {
    return fetchAPI(`/api/update-status?id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, qualification_score }),
    });
  },
};

export default api;
