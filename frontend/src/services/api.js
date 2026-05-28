import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Conversation APIs
export const chatAPI = {
  searchUsers: (query, currentUid) =>
    api.get('/api/users/search', { params: { q: query, uid: currentUid } }),
  getUserStatus: (uid) => api.get(`/api/users/${uid}/status`),
  getConversations: (uid) => api.get('/api/conversations', { params: { uid } }),
  createConversation: (creatorUid, participantUid) =>
    api.post('/api/conversations', { creatorUid, participantUid }),
  getConversation: (id, uid) => api.get(`/api/conversations/${id}`, { params: { uid } }),
  deleteConversation: (id, uid) => api.delete(`/api/conversations/${id}`, { params: { uid } }),
  markConversationSeen: (conversationId, uid) =>
    api.post(`/api/conversations/${conversationId}/seen`, { uid }),
  sendMessage: (conversationId, sender, text, senderUid) =>
    api.post(`/api/conversations/${conversationId}/messages`, { sender, text, senderUid }),
  getUserPublicKey: (uid) => api.get(`/api/users/${uid}/public-key`),
};

// Health check
export const healthCheck = () => api.get('/api/health');

export default api;
