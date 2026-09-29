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

// Download the pediatrician handoff PDF (or receive JSON when pdfkit is absent).
export async function downloadPediatricianHandoffPdf(data) {
  const token = getToken();
  const response = await fetch(`${BASE_URL}/ai/pediatrician-handoff-pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  });

  if (response.status === 401) {
    removeToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed with status ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pediatrician_handoff_child_${data && data.child_id ? data.child_id : 'summary'}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
  return { downloaded: true, content_type: contentType, advisory: true, note: 'PDF downloaded.' };
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
  handoffSummary: (data) => apiCall('/ai/handoff-summary', { method: 'POST', body: JSON.stringify(data) }),
  milestoneGapAdvisor: (data) => apiCall('/ai/milestone-gap-advisor', { method: 'POST', body: JSON.stringify(data) }),
  sleepFeedingAnalyzer: (data) => apiCall('/ai/sleep-feeding-analyzer', { method: 'POST', body: JSON.stringify(data) }),
  behaviorCoach: (data) => apiCall('/ai/behavior-coach', { method: 'POST', body: JSON.stringify(data) }),
  growthChartAnalyzer: (data) => apiCall('/ai/growth-chart-analyzer', { method: 'POST', body: JSON.stringify(data) }),
  pediatricianHandoffPdf: (data) => downloadPediatricianHandoffPdf(data),
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

// ─── Deterministic reports (computed from real rows server-side) ─────────────

export function getGrowthReport(childId) {
  return apiCall(`/reports/growth/${childId}`);
}

export function getSleepReport(childId, days = 30) {
  return apiCall(`/reports/sleep/${childId}?days=${days}`);
}

export function getFeedingReport(childId, days = 30) {
  return apiCall(`/reports/feeding/${childId}?days=${days}`);
}

export function getExpenseSummary(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, value);
    }
  });
  const query = searchParams.toString();
  return apiCall(`/reports/expenses/summary${query ? `?${query}` : ''}`);
}

export function getReportsOverview() {
  return apiCall('/reports/overview');
}

// ─── Global search across the authenticated user's records ───────────────────

export function globalSearch(query) {
  return apiCall(`/search?q=${encodeURIComponent(query)}`);
}

/** Download the authenticated account's full data export (json|csv). */
export async function downloadAccountExport(format = 'json') {
  const token = getToken();
  const response = await fetch(`${BASE_URL}/account/export?format=${format}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!response.ok) throw new Error('Failed to export account data.');
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `childcare-export.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/** What an export or deletion would include. */
export async function getAccountSummary() {
  return apiCall('/account/summary');
}

/** Delete the account and every owned record (requires the exact email). */
export async function deleteAccount(confirmEmail) {
  return apiCall('/account', { method: 'DELETE', body: JSON.stringify({ confirm: confirmEmail }) });
}

// ─── Caregiver sharing & audit trail ─────────────────────────────────────────
export const sharing = {
  list: (childId) => apiCall(`/sharing/${childId}`),
  invite: (childId, data) => apiCall(`/sharing/${childId}/invite`, { method: 'POST', body: JSON.stringify(data) }),
  accept: (token) => apiCall('/sharing/accept', { method: 'POST', body: JSON.stringify({ token }) }),
  update: (childId, userId, data) => apiCall(`/sharing/${childId}/${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (childId, userId) => apiCall(`/sharing/${childId}/${userId}`, { method: 'DELETE' }),
  audit: (childId) => apiCall(`/sharing/${childId}/audit`),
};

// ─── Billing ─────────────────────────────────────────────────────────────────
export const billing = {
  status: () => apiCall('/billing/status'),
  plans: () => apiCall('/billing/plans'),
  checkout: (plan) => apiCall('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) }),
};
