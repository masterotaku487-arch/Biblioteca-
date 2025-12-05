import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const auth = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  deleteAccount: (password) => {
    const formData = new FormData();
    formData.append('password', password);
    return api.delete('/auth/delete-account', { data: formData });
  },
  googleLogin: () => {
    window.location.href = `${API_URL}/api/auth/google/login`;
  },
};

export const files = {
  upload: (file, password) => {
    const formData = new FormData();
    formData.append('file', file);
    if (password) formData.append('password', password);
    return api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getAll: () => api.get('/files'),
  download: (id) => api.get(`/files/${id}/download`, { responseType: 'blob' }),
  delete: (id) => api.delete(`/files/${id}`),
  share: (id, username, permissions = 'download') => 
    api.post(`/files/${id}/share`, { username, permissions }),
  getShared: () => api.get('/files/shared-with-me'),
  revokeShare: (fileId, userId) => api.delete(`/files/${fileId}/share/${userId}`),
};

export const stats = {
  getUserStats: () => api.get('/user/stats'),
  getAdminStats: () => api.get('/admin/stats'),
};

export const teams = {
  create: (data) => api.post('/teams/create', data),
  getMyTeams: () => api.get('/teams/my-teams'),
  invite: (teamId, username) => api.post(`/teams/${teamId}/invite`, { username }),
  getInvites: () => api.get('/teams/invites'),
  acceptInvite: (inviteId) => api.post(`/teams/invites/${inviteId}/accept`),
  rejectInvite: (inviteId) => api.post(`/teams/invites/${inviteId}/reject`),
  addFile: (teamId, fileId) => api.post(`/teams/${teamId}/files/${fileId}/add`),
  getFiles: (teamId) => api.get(`/teams/${teamId}/files`),
  delete: (teamId) => api.delete(`/teams/${teamId}`),
  leave: (teamId) => api.delete(`/teams/${teamId}/leave`),
  removeMember: (teamId, userId) => api.delete(`/teams/${teamId}/members/${userId}`),
};

export const bugReport = {
  create: (data) => api.post('/bug-report', data),
  getAll: () => api.get('/admin/bug-reports'),
  updateStatus: (id, status) => api.patch(`/admin/bug-reports/${id}/status`, null, {
    params: { status }
  }),
};

export const payment = {
  createSubscription: (plan) => api.post('/payment/create-subscription', { plan }),
};

export default api;