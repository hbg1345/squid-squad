import { io } from 'socket.io-client';
// Vite 환경변수 타입 선언 (없으면 추가)
declare global {
  interface ImportMeta {
    readonly env: {
      VITE_SOCKET_URL: string;
      [key: string]: string;
    };
  }
}
export const socket = io(import.meta.env.VITE_SOCKET_URL);

socket.on('connect', () => {
  console.log('소켓 연결 성공:', socket.id);
});
socket.on('connect_error', (err) => {
  console.error('소켓 연결 실패:', err);
}); 