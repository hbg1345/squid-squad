import { io } from 'socket.io-client';
export const socket = io('http://localhost:3001'); // 서버 주소에 맞게 수정 

socket.on('connect', () => {
  console.log('소켓 연결 성공:', socket.id);
});
socket.on('connect_error', (err) => {
  console.error('소켓 연결 실패:', err);
}); 