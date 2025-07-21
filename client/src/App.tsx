import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import TitleScreen from './components/TitleScreen';
import RedLightGreenLightGame from './components/RedLightGreenLightGame';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TitleScreenWithNav />} />
        <Route path="/game" element={<RedLightGreenLightGame />} />
      </Routes>
    </BrowserRouter>
  );
};

// useNavigate를 TitleScreen에 연결
const TitleScreenWithNav: React.FC = () => {
  const navigate = useNavigate();
  return <TitleScreen onStartGame={() => navigate('/game')} />;
};

export default App;