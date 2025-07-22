import React, { useState, useEffect, useRef } from 'react';
import './CharacterSelectionModal.css';

interface CharacterSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGameStart: (selectedCharacter: string) => void;
}

const characters = [
  'player.png',
  'player2.png',
  'player3.png',
  'player4.png',
  'player5.png',
];

const CharacterSelectionModal: React.FC<CharacterSelectionModalProps> = ({
  isOpen,
  onClose,
  onGameStart,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      modalRef.current?.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (confirmed) return;

    if (e.key === 'ArrowRight') {
      setSelectedIndex((prev) => (prev === null ? 0 : Math.min(prev + 1, characters.length - 1)));
    } else if (e.key === 'ArrowLeft') {
      setSelectedIndex((prev) => (prev === null ? 0 : Math.max(prev - 1, 0)));
    } else if (e.key === 'Enter' && selectedIndex !== null) {
      setConfirmed(true);
    }
  };

  const handleGameStart = () => {
    if (selectedIndex !== null) {
      onGameStart(characters[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
    >
      <div 
        className="character-modal-content" 
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        ref={modalRef}
      >
        <h2>캐릭터 선택</h2>
        <div className="character-list">
          {characters.map((char, index) => (
            <div
              key={char}
              className={`character-item ${selectedIndex === index ? 'selected' : ''} ${confirmed && selectedIndex === index ? 'confirmed' : ''}`}
              onClick={() => {
                if (!confirmed) setSelectedIndex(index)
              }}
            >
              <img src={`/${char}`} alt={`character ${index + 1}`} />
            </div>
          ))}
        </div>
        <button
          className="game-start-button"
          onClick={handleGameStart}
          disabled={!confirmed}
        >
          게임 시작
        </button>
      </div>
    </div>
  );
};

export default CharacterSelectionModal;
