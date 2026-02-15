import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (username, password) =>
    api.post('/auth/login', { username, password }),
  
  logout: () =>
    api.post('/auth/logout'),
  
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
  
  deleteAccount: (password) =>
    api.post('/auth/delete-account', { password }),
  
  heartbeat: () =>
    api.post('/heartbeat')
};

export const jobsAPI = {
  create: (jobData) =>
    api.post('/jobs', jobData),
  
  getMyJobs: (params) =>
    api.get('/jobs/my-jobs', { params }),
  
  getMyDailyTotal: (date) =>
    api.get('/jobs/my-daily-total', { params: { date } }),
  
  getJobTypes: () =>
    api.get('/jobs/job-types')
};

export const adminAPI = {
  getDailySummary: (date) =>
    api.get('/admin/daily-summary', { params: { date } }),
  
  getMachineSummary: (date) =>
    api.get('/admin/machine-summary', { params: { date } }),
  
  getWorkerSummary: (date) =>
    api.get('/admin/worker-summary', { params: { date } }),
  
  getJobTypeSummary: (date) =>
    api.get('/admin/job-type-summary', { params: { date } }),
  
  getDetailedJobs: (date) =>
    api.get('/admin/detailed-jobs', { params: { date } }),
  
  downloadPDFReport: (date) =>
    api.get('/admin/reports/pdf', {
      params: { date },
      responseType: 'blob'
    }),
  
  downloadExcelReport: (date) =>
    api.get('/admin/reports/excel', {
      params: { date },
      responseType: 'blob'
    }),
  
  getAllPricing: () =>
    api.get('/admin/pricing'),
  
  createPricing: (pricingData) =>
    api.post('/admin/pricing', pricingData),
  
  updatePricing: (id, pricingData) =>
    api.put(`/admin/pricing/${id}`, pricingData),
  
  getAllUsers: () =>
    api.get('/admin/users'),
  
  createUser: (userData) =>
    api.post('/admin/users', userData),
  
  deleteUser: (userId) =>
    api.delete(`/admin/users/${userId}`),
  
  getAllMachines: () =>
    api.get('/admin/machines'),
  
  createMachine: (machineData) =>
    api.post('/admin/machines', machineData),
  
  getAuditLogs: (params) =>
    api.get('/admin/audit-logs', { params })
};

export const messagesAPI = {
  getUsers: () =>
    api.get('/messages/users'),
  
  getMessages: (withUserId) =>
    api.get('/messages', { params: { with_user_id: withUserId } }),
  
  sendMessage: (formData) =>
    api.post('/messages/send', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }),
  
  markAsRead: (messageId) =>
    api.put(`/messages/${messageId}/read`),
  
  downloadFile: (messageId) =>
    api.get(`/messages/${messageId}/download`, {
      responseType: 'blob'
    })
};

export default api;
