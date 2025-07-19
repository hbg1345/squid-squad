import React, { useState, useEffect, useRef } from 'react';
import PhaserBackground from './PhaserBackground';
import MatchingModal from './MatchingModal';
import './App.css';

function App() {
  const [matching, setMatching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef();

  useEffect(() => {
    if (matching) {
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [matching]);

  return (
    <div className="App">
      <PhaserBackground />
      <div className="main-content">
        <h1 className="main-title">SQUID SQUAD</h1>
        <button className="join-btn" onClick={() => setMatching(true)} disabled={matching}>
          참가
        </button>
      </div>
      <MatchingModal open={matching} onCancel={() => setMatching(false)} elapsed={elapsed} />
    </div>
  );
}

export default App;
