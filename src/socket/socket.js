import { io } from 'socket.io-client';

let socket = null;

/**
 * Initialize Socket.io connection
 */
export const initSocket = () => {
  if (!socket) {
    socket = io('https://collaborative-drawing-canvas-server-production.up.railway.app', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });
  }
  return socket;
};

/**
 * Get the current socket instance
 */
export const getSocket = () => {
  if (!socket) {
    return initSocket();
  }
  return socket;
};

/**
 * Disconnect socket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
