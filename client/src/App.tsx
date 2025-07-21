import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import TitleScreen from './components/TitleScreen';
import RedLightGreenLightGame from './components/RedLightGreenLightGame';
import GameScreen from './components/GameScreen';

const RedLightGreenLightGameWrapper = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { roomId, playerNickname } = location.state || {};
  return (
    <RedLightGreenLightGame
      roomId={roomId}
      playerNickname={playerNickname}
      onGoBack={() => navigate('/')}
    />
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TitleScreenWithNav />} />
        <Route path="/game" element={<RedLightGreenLightGameWrapper />} />
        <Route path="/room" element={<GameScreen />} />
      </Routes>
    </BrowserRouter>
  );
};

// useNavigate를 TitleScreen에 연결
const TitleScreenWithNav: React.FC = () => {
  const navigate = useNavigate();
  return <TitleScreen onStartGame={(roomId: string, playerNickname: string) => navigate('/game', { state: { roomId, playerNickname } })} />;
};

export default App;