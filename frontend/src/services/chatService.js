import api from './api';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:8080';

// ── REST API ───────────────────────────────────────────────────────────────────
export const chatService = {
    // Chat status (has user paid?)
    getStatus: (creatorId) => api.get(`/chat/status/${creatorId}`),

    // Unlock chat
    createUnlockOrder: (creatorId) => api.post('/chat/unlock', { creatorId }),
    verifyUnlock: (data) => api.post('/chat/unlock/verify', data),

    // Rooms (inbox)
    getUserRooms: () => api.get('/chat/rooms'),
    getCreatorRooms: () => api.get('/chat/creator/rooms'),

    // Messages
    getMessages: (chatId, params) => api.get(`/chat/rooms/${chatId}/messages`, { params }),

    // Gifts
    createGiftOrder: (chatId, amount) => api.post('/chat/gift/order', { chatId, amount }),
    verifyGift: (data) => api.post('/chat/gift/verify', data),

    // Creator settings
    getChatSettings: () => api.get('/chat/creator/settings'),
    updateChatSettings: (data) => api.patch('/chat/creator/settings', data),
    getChatStats: () => api.get('/chat/creator/stats'),
};

// ── Socket.io singleton ───────────────────────────────────────────────────────
let socketInstance = null;

export const getSocket = () => socketInstance;

export const connectSocket = (token) => {
    if (socketInstance?.connected) return socketInstance;

    socketInstance = io(SOCKET_URL, {
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => console.log('⚡ Socket connected'));
    socketInstance.on('disconnect', () => console.log('🔌 Socket disconnected'));

    return socketInstance;
};

export const disconnectSocket = () => {
    if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
    }
};

export default chatService;
