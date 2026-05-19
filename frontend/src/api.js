const BASE_URL = '/api';

export function getToken() {
  return localStorage.getItem('token');
}

export function setToken(token) {
  localStorage.setItem('token', token);
}

export function removeToken() {
  localStorage.removeItem('token');
}

export async function apiCall(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    removeToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export async function login(email, password) {
  const data = await apiCall('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data.token) {
    setToken(data.token);
  }
  return data;
}

export async function getMe() {
  return apiCall('/auth/me');
}

export async function fetchItems(endpoint, params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, value);
    }
  });
  const query = searchParams.toString();
  return apiCall(`${endpoint}${query ? `?${query}` : ''}`);
}

export async function fetchItem(endpoint, id) {
  return apiCall(`${endpoint}/${id}`);
}

export async function createItem(endpoint, data) {
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateItem(endpoint, id, data) {
  return apiCall(`${endpoint}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteItem(endpoint, id) {
  return apiCall(`${endpoint}/${id}`, {
    method: 'DELETE',
  });
}

export async function getAIInsight(feature, context, question, conversation_id) {
  return apiCall('/ai/insight', {
    method: 'POST',
    body: JSON.stringify({ feature, context, question, conversation_id }),
  });
}

// New AI feature endpoints
export const aiFeatures = {
  milestoneComparison: (data) => apiCall('/ai/milestone-comparison', { method: 'POST', body: JSON.stringify(data) }),
  sleepOptimizer: (data) => apiCall('/ai/sleep-optimizer', { method: 'POST', body: JSON.stringify(data) }),
  nutritionAdvisor: (data) => apiCall('/ai/nutrition-advisor', { method: 'POST', body: JSON.stringify(data) }),
  behaviorAnalyzer: (data) => apiCall('/ai/behavior-analyzer', { method: 'POST', body: JSON.stringify(data) }),
  illnessTracker: (data) => apiCall('/ai/illness-tracker', { method: 'POST', body: JSON.stringify(data) }),
  stressMonitor: (data) => apiCall('/ai/stress-monitor', { method: 'POST', body: JSON.stringify(data) }),
  screenTimeManager: (data) => apiCall('/ai/screen-time-manager', { method: 'POST', body: JSON.stringify(data) }),
  siblingHarmony: (data) => apiCall('/ai/sibling-harmony', { method: 'POST', body: JSON.stringify(data) }),
  healthTrend: (data) => apiCall('/ai/health-trend', { method: 'POST', body: JSON.stringify(data) }),
};

// AI conversations
export const aiConversations = {
  list: (params = {}) => fetchItems('/ai/conversations', params),
  create: (data) => apiCall('/ai/conversations', { method: 'POST', body: JSON.stringify(data) }),
  message: (id, data) => apiCall(`/ai/conversations/${id}/message`, { method: 'POST', body: JSON.stringify(data) }),
};

// AI results history
export const aiResults = {
  list: (params = {}) => fetchItems('/ai-results', params),
  get: (id) => apiCall(`/ai-results/${id}`),
  remove: (id) => apiCall(`/ai-results/${id}`, { method: 'DELETE' }),
};

export async function exportCSV(tableName) {
  const token = getToken();
  const response = await fetch(`${BASE_URL}/export/${tableName}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error('Failed to export data.');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${tableName}_export.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
