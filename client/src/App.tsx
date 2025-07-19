import TitleScreen from './components/TitleScreen'
import MatchingModal from './MatchingModal'
import { useState } from 'react'
import './App.css'

function App() {
  const [matching, setMatching] = useState(false)

  return (
    <div className="App">
      <TitleScreen onStartGame={() => setMatching(true)} />
      <MatchingModal open={matching} onCancel={() => setMatching(false)} />
    </div>
  )
}

export default App 