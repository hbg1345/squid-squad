import { io, Socket } from 'socket.io-client';

declare global {
  interface ImportMeta {
    readonly env: {
      VITE_SOCKET_URL: string;
      [key: string]: string;
    };
  }
}

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL, { transports: ['websocket'] });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
} 