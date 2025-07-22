import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import TitleScreen from './components/TitleScreen';
import NicknameInput from './components/NicknameInput';
import RedLightGreenLightGame from './components/RedLightGreenLightGame';
import GameScreen from './components/PairGameScreen';

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
        <Route path="/" element={<TitleScreen />} />
        <Route path="/nickname" element={<NicknameInput />} />
        <Route path="/game1" element={<RedLightGreenLightGameWrapper />} />
        <Route path="/game2" element={<GameScreen />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;