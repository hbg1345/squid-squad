import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import TitleScreen from './components/TitleScreen';
import RedLightGreenLightGame from './components/RedLightGreenLightGame';

const RedLightGreenLightGameWrapper = () => {
  const location = useLocation();
  const { roomId, playerNickname } = location.state || {};
  console.log('[LOG] RedLightGreenLightGameWrapper', roomId, playerNickname);
  return <RedLightGreenLightGame roomId={roomId} playerNickname={playerNickname} onGoBack={() => {}} />;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TitleScreenWithNav />} />
        <Route path="/game" element={<RedLightGreenLightGameWrapper />} />
      </Routes>
    </BrowserRouter>
  );
};

// useNavigate를 TitleScreen에 연결
const TitleScreenWithNav: React.FC = () => {
  const navigate = useNavigate();
  return <TitleScreen onStartGame={(roomId, playerNickname) => navigate('/game', { state: { roomId, playerNickname } })} />;
};

export default App;