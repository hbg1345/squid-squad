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
    (socket as Socket).on('connect', () => {
      console.log('소켓 연결 성공:', (socket as Socket).id);
    });
    (socket as Socket).on('connect_error', (err) => {
      console.error('소켓 연결 실패:', err);
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('소켓 연결 해제됨');
  }
} 