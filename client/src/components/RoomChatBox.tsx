import React, { useEffect, useRef, useState } from 'react';
import { getSocket } from '../socket';

interface RoomChatBoxProps {
  roomId: string;
  roomIndex: number;
  playerNickname: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

interface ChatMessage {
  nickname: string;
  message: string;
  time: number;
}

const RoomChatBox: React.FC<RoomChatBoxProps> = ({ roomId, roomIndex, playerNickname, onFocus, onBlur }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [visible, setVisible] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const socket = getSocket();

  useEffect(() => {
    const handleRoomChat = (data: { nickname: string; message: string; time: number }) => {
      setMessages((msgs) => [...msgs.slice(-49), { nickname: data.nickname, message: data.message, time: data.time }]);
    };
    socket.on('roomChat', handleRoomChat);
    return () => {
      socket.off('roomChat', handleRoomChat);
    };
  }, [roomId, roomIndex, socket]);

  const handleSend = () => {
    const msg = input.trim();
    if (!msg) return;
    socket.emit('roomChat', { roomId, roomIndex, nickname: playerNickname, message: msg, time: Date.now() });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    } else if (e.key === 'Escape') {
      inputRef.current?.blur();
      setVisible(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (document.activeElement === inputRef.current) {
          inputRef.current.blur();
        } else {
          setVisible(true);
          setTimeout(() => inputRef.current?.focus(), 10);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div style={{
      position: 'absolute',
      left: 24,
      bottom: 24,
      width: 320,
      background: 'rgba(30,30,30,0.85)',
      borderRadius: 12,
      boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
      zIndex: 2000,
      display: visible ? 'flex' : 'none',
      flexDirection: 'column',
      pointerEvents: 'auto',
    }}>
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 200, padding: 8 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ color: msg.nickname === playerNickname ? '#ff2a7f' : '#fff', marginBottom: 2, fontSize: 15 }}>
            <span style={{ fontWeight: 'bold', marginRight: 4 }}>{msg.nickname}:</span>
            <span>{msg.message}</span>
          </div>
        ))}
      </div>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder="방 내부 채팅 (Enter)"
        style={{
          width: '100%',
          border: 'none',
          borderRadius: '0 0 12px 12px',
          padding: '10px 12px',
          fontSize: 15,
          outline: 'none',
          background: '#222',
          color: '#fff',
        }}
        maxLength={100}
        autoComplete="off"
      />
    </div>
  );
};

export default RoomChatBox; 