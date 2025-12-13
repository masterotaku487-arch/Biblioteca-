import axios from 'axios';
import { toast } from 'sonner';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Criar instância do axios com configurações base
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================================
// INTERCEPTORS
// ============================================================================

// Request interceptor - adicionar token automaticamente
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - tratar erros globalmente
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Se token inválido, fazer logout
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    
    // Erros de rede
    if (!error.response) {
      toast.error('Erro de conexão com o servidor');
    }
    
    return Promise.reject(error);
  }
);

// ============================================================================
// AUTH MODULE
// ============================================================================

export const auth = {
  // Registrar novo usuário
  register: (data) => api.post('/api/auth/register', data),
  
  // Login
  login: (data) => api.post('/api/auth/login', data),
  
  // Obter dados do usuário atual
  getMe: () => api.get('/api/auth/me'),
  
  // Google OAuth - Obter URL de login
  getGoogleLoginUrl: () => api.get('/api/auth/google/login'),
  
  // Trocar senha
  changePassword: (currentPassword, newPassword) => 
    api.post('/api/auth/change-password', 
      new URLSearchParams({
        current_password: currentPassword,
        new_password: newPassword
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    ),
  
  // Deletar própria conta
  deleteAccount: (password, confirmation) => 
    api.delete('/api/auth/delete-account', {
      data: new URLSearchParams({
        password: password,
        confirmation: confirmation
      }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }),
};

// ============================================================================
// FILES MODULE
// ============================================================================

export const files = {
  // Upload de arquivo
  uploadFile: (file, password = null) => {
    const formData = new FormData();
    formData.append('file', file);
    if (password) {
      formData.append('password', password);
    }
    return api.post('/api/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  // Listar meus arquivos
  getMyFiles: () => api.get('/api/files'),
  
  // Listar arquivos compartilhados comigo
  getSharedFiles: () => api.get('/api/files/shared-with-me'),
  
  // Obter metadados de um arquivo
  getFileMetadata: (fileId) => api.get(`/api/files/${fileId}/metadata`),
  
  // Download de arquivo
  downloadFile: async (fileId, password = null) => {
    const params = password ? { password } : {};
    const response = await api.get(`/api/files/${fileId}/download`, {
      params,
      responseType: 'blob'
    });
    
    // Extrair filename do header Content-Disposition
    const contentDisposition = response.headers['content-disposition'];
    let filename = 'download';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }
    
    // Criar blob e fazer download
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    return response;
  },
  
  // Deletar arquivo (soft delete para premium, hard para free)
  deleteFile: (fileId) => api.delete(`/api/files/${fileId}`),
  
  // Compartilhar arquivo
  shareFile: (fileId, username, permissions = 'download') => 
    api.post(`/api/files/${fileId}/share`, { username, permissions }),
  
  // Listar compartilhamentos de um arquivo
  getFileShares: (fileId) => api.get(`/api/files/${fileId}/shares`),
  
  // Revogar compartilhamento
  revokeShare: (fileId, shareId) => api.delete(`/api/files/${fileId}/shares/${shareId}`),
  
  // Revogar compartilhamento por usuário
  revokeShareByUser: (fileId, userId) => api.delete(`/api/files/${fileId}/shares/user/${userId}`),
  
  // Listar compartilhamentos recebidos (com detalhes)
  getReceivedShares: () => api.get('/api/shares/received'),
  
  // Listar compartilhamentos enviados
  getSentShares: () => api.get('/api/shares/sent'),
  
  // Obter estatísticas do usuário
  getUserStats: () => api.get('/api/user/stats'),
  
  // Buscar usuários (para compartilhamento)
  searchUsers: (query) => api.get('/api/users/search', { params: { query } }),
};

// ============================================================================
// TRASH MODULE (PREMIUM)
// ============================================================================

export const trash = {
  // Listar arquivos na lixeira
  getTrash: () => api.get('/api/trash'),
  
  // Restaurar arquivo da lixeira
  restoreFile: (fileId) => api.post(`/api/trash/${fileId}/restore`),
  
  // Deletar permanentemente da lixeira
  permanentDelete: (fileId) => api.delete(`/api/trash/${fileId}/permanent`),
  
  // Esvaziar lixeira completamente
  emptyTrash: () => api.delete('/api/trash/empty'),
};

// ============================================================================
// SEARCH MODULE (PREMIUM)
// ============================================================================

export const search = {
  // Busca avançada de arquivos
  searchFiles: (query, fileType, dateFrom, dateTo) => 
    api.get('/api/files/search', {
      params: {
        query,
        file_type: fileType,
        date_from: dateFrom,
        date_to: dateTo
      }
    }),
};

// ============================================================================
// TEAMS MODULE (PREMIUM)
// ============================================================================

export const teams = {
  // Criar time
  createTeam: (name, description = null) => 
    api.post('/api/teams/create', { name, description }),
  
  // Listar meus times
  getMyTeams: () => api.get('/api/teams/my-teams'),
  
  // Obter detalhes de um time
  getTeam: (teamId) => api.get(`/api/teams/${teamId}`),
  
  // Convidar usuário para time
  inviteToTeam: (teamId, username) => 
    api.post(`/api/teams/${teamId}/invite`, { username }),
  
  // Listar meus convites pendentes
  getMyInvites: () => api.get('/api/teams/invites'),
  
  // Aceitar convite
  acceptInvite: (inviteId) => api.post(`/api/teams/invites/${inviteId}/accept`),
  
  // Rejeitar convite
  rejectInvite: (inviteId) => api.post(`/api/teams/invites/${inviteId}/reject`),
  
  // Adicionar arquivo ao time
  addFileToTeam: (teamId, fileId) => 
    api.post(`/api/teams/${teamId}/files/${fileId}/add`),
  
  // Remover arquivo do time
  removeFileFromTeam: (teamId, fileId) => 
    api.delete(`/api/teams/${teamId}/files/${fileId}`),
  
  // Listar arquivos do time
  getTeamFiles: (teamId) => api.get(`/api/teams/${teamId}/files`),
  
  // Listar membros do time
  getTeamMembers: (teamId) => api.get(`/api/teams/${teamId}/members`),
  
  // Remover membro do time (apenas dono)
  removeMember: (teamId, userId) => 
    api.delete(`/api/teams/${teamId}/members/${userId}`),
  
  // Sair do time
  leaveTeam: (teamId) => api.post(`/api/teams/${teamId}/leave`),
  
  // Deletar time (apenas dono)
  deleteTeam: (teamId) => api.delete(`/api/teams/${teamId}`),
};

// ============================================================================
// NOTIFICATIONS MODULE
// ============================================================================

export const notifications = {
  // Listar todas notificações
  getAll: () => api.get('/api/notifications'),
  
  // Contar não lidas
  getUnreadCount: () => api.get('/api/notifications/unread-count'),
  
  // Marcar como lida
  markAsRead: (notificationId) => 
    api.post(`/api/notifications/${notificationId}/read`),
  
  // Marcar todas como lidas
  markAllAsRead: () => api.post('/api/notifications/mark-all-read'),
  
  // Deletar notificação
  delete: (notificationId) => api.delete(`/api/notifications/${notificationId}`),
  
  // Limpar todas
  clearAll: () => api.delete('/api/notifications/clear-all'),
};

// ============================================================================
// CHAT MODULE
// ============================================================================

export const chat = {
  // Verificar se chat está habilitado
  getStatus: () => api.get('/api/chat/status'),
  
  // Ativar/desativar chat (admin)
  toggleChat: (enabled) => api.post('/api/chat/toggle', { enabled }),
  
  // Listar mensagens
  getMessages: () => api.get('/api/chat/messages'),
  
  // Enviar mensagem
  sendMessage: (message) => 
    api.post('/api/chat/send', 
      new URLSearchParams({ message }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    ),
  
  // Deletar mensagem (admin)
  deleteMessage: (messageId) => api.delete(`/api/chat/messages/${messageId}`),
  
  // Limpar todo o chat (admin)
  clearChat: () => api.delete('/api/chat/clear'),
};

// ============================================================================
// BUG REPORTS MODULE
// ============================================================================

export const bugs = {
  // Criar bug report
  create: (data) => api.post('/api/bugs/report', data),
  
  // Listar meus bug reports
  getMyReports: () => api.get('/api/bugs/my-reports'),
  
  // Listar todos (admin)
  getAll: (status = null, category = null) => 
    api.get('/api/bugs/list', { params: { status, category } }),
  
  // Obter detalhes de um bug (admin)
  getDetails: (bugId) => api.get(`/api/bugs/${bugId}`),
  
  // Resolver bug (admin)
  resolve: (bugId) => api.post(`/api/bugs/${bugId}/resolve`),
  
  // Atualizar status (admin)
  updateStatus: (bugId, status) => 
    api.post(`/api/bugs/${bugId}/status`, 
      new URLSearchParams({ status }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    ),
  
  // Deletar bug report (admin)
  delete: (bugId) => api.delete(`/api/bugs/${bugId}`),
  
  // Obter estatísticas (admin)
  getStats: () => api.get('/api/bugs/stats'),
};

// ============================================================================
// PAYMENTS MODULE (MERCADO PAGO)
// ============================================================================

export const payments = {
  // Criar preferência de pagamento
  createPreference: (planType = 'monthly') => 
    api.post('/api/payments/create-preference', 
      new URLSearchParams({ plan_type: planType }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    ),
  
  // Verificar status de pagamento
  checkStatus: (paymentId) => 
    api.get('/api/payments/check-status', { params: { payment_id: paymentId } }),
  
  // Obter minhas assinaturas
  getMySubscriptions: () => api.get('/api/payments/my-subscriptions'),
  
  // Obter chave pública do Mercado Pago
  getPublicKey: () => api.get('/api/public-key'),
};

// ============================================================================
// ADMIN MODULE
// ============================================================================

export const admin = {
  // Listar todos os usuários
  getAllUsers: (plan = null, role = null, limit = 100) => 
    api.get('/api/admin/users', { params: { plan, role, limit } }),
  
  // Obter estatísticas gerais
  getStats: () => api.get('/api/admin/stats'),
  
  // Obter detalhes de um usuário
  getUserDetails: (userId) => api.get(`/api/admin/user/${userId}/details`),
  
  // Fazer upgrade de usuário
  upgradeUser: (userId, days) => 
    api.post(`/api/admin/users/${userId}/upgrade`, 
      new URLSearchParams({ days: days.toString() }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    ),
  
  // Fazer downgrade de usuário
  downgradeUser: (userId) => api.post(`/api/admin/users/${userId}/downgrade`),
  
  // Deletar usuário
  deleteUser: (userId) => api.delete(`/api/admin/users/${userId}/delete`),
  
  // Download de todos os arquivos (backup)
  downloadAllFiles: () => 
    api.get('/api/admin/download-all', { responseType: 'blob' }),
  
  // Download do código-fonte
  downloadSourceCode: () => 
    api.get('/api/admin/download-source-code', { responseType: 'blob' }),
  
  // Bug reports (já coberto no módulo bugs, mas mantendo aqui também)
  getBugReports: () => api.get('/api/bugs/list'),
  resolveBug: (bugId) => api.post(`/api/bugs/${bugId}/resolve`),
  deleteBug: (bugId) => api.delete(`/api/bugs/${bugId}`),
};

// ============================================================================
// HEALTH CHECK
// ============================================================================

export const health = {
  check: () => api.get('/api/health'),
};

// ============================================================================
// EXPORTS
// ============================================================================

// Export individual modules
export { api };

// Export default com todos os módulos
export default {
  auth,
  files,
  trash,
  search,
  teams,
  notifications,
  chat,
  bugs,
  payments,
  admin,
  health,
};

// Export da URL base para uso em outros lugares
export { API_URL };