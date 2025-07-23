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
  // 1. 가운데 캐릭터(index 2)를 기본으로 선택하도록 변경
  const [selectedIndex, setSelectedIndex] = useState<number>(2);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // 2. 모달이 열릴 때마다 선택을 중앙으로 초기화하고 포커스
      setSelectedIndex(2);
      modalRef.current?.focus();
    }
  }, [isOpen]);

  const handleGameStart = () => {
    // selectedIndex는 항상 값이 있으므로 null 체크 없이 바로 실행
    onGameStart(characters[selectedIndex]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      setSelectedIndex((prev) => Math.min(prev + 1, characters.length - 1));
    } else if (e.key === 'ArrowLeft') {
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      // 3. 엔터 키를 누르면 바로 게임 시작
      handleGameStart();
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
              // 'confirmed' 클래스를 사용하지 않으므로 제거
              className={`character-item ${selectedIndex === index ? 'selected' : ''}`}
              onClick={() => setSelectedIndex(index)}
            >
              <img src={`/${char}`} alt={`character ${index + 1}`} />
            </div>
          ))}
        </div>
        <button
          className="game-start-button"
          onClick={handleGameStart}
          // disabled 속성을 제거하여 항상 활성화
        >
          게임 시작
        </button>
      </div>
    </div>
  );
};

export default CharacterSelectionModal; 