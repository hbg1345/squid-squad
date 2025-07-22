import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '../socket';
import { MATCH_SIZE } from '../constants/game';
import MatchingModal from '../MatchingModal';
import CharacterSelectionModal from './CharacterSelectionModal';
import './NicknameInput.css';

const NicknameInput: React.FC = () => {
    const [nickname, setNickname] = useState('');
    const [showMatchingModal, setShowMatchingModal] = useState(false);
    const [matchingCurrent, setMatchingCurrent] = useState(1);
    const [matchingTotal] = useState(MATCH_SIZE);
    const [elapsed, setElapsed] = useState(0);
    const [showCharacterModal, setShowCharacterModal] = useState(false);
    const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (showMatchingModal) {
            getSocket().emit('joinMatch');
        } else {
            getSocket().emit('leaveMatch');
        }
    }, [showMatchingModal]);

    useEffect(() => {
        const handleMatchingCount = (count: number) => setMatchingCurrent(count);
        const handleMatchFound = ({ roomId }: { roomId: string }) => {
            setShowMatchingModal(false);
            navigate('/game1', { state: { roomId, playerNickname: nickname, character: selectedCharacter } });
        };

        getSocket().on('matchingCount', handleMatchingCount);
        getSocket().on('matchFound', handleMatchFound);

        return () => {
            getSocket().off('matchingCount', handleMatchingCount);
            getSocket().off('matchFound', handleMatchFound);
        };
    }, [navigate, nickname, selectedCharacter]);

    const handleStartMatching = () => {
        setShowCharacterModal(true);
    };

    const handleCancelMatching = () => {
        setShowMatchingModal(false);
    };

    const handleCharacterSelect = (character: string) => {
        setSelectedCharacter(character);
        setShowCharacterModal(false);
        setShowMatchingModal(true); // 이제 매칭 시작
    };

    return (
        <div className="nickname-container">
            <div className="content-wrapper">
                <img src="/contract.png" alt="Game Contract" className="contract-image" />
                <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder=""
                    maxLength={10}
                    className={`nickname-input-field ${nickname ? 'has-text' : ''}`}
                    style={{
                        fontSize: nickname.length >= 5 ? '1rem' : '2rem',
                        top: nickname.length >= 5 ? '732px' : '725px' // 글자 수에 따라 top 위치 조정
                    }}
                    //5자 이상이면 1rem, 아니면 2rem으로 고정  
                />
                <button
                    onClick={handleStartMatching}
                    disabled={!nickname.trim()}
                    className="start-matching-button"
                >
                    게임 시작
                </button>
            </div>
            <CharacterSelectionModal
                isOpen={showCharacterModal}
                onClose={() => setShowCharacterModal(false)}
                onGameStart={handleCharacterSelect}
            />
            <MatchingModal
                open={showMatchingModal}
                onCancel={handleCancelMatching}
                current={matchingCurrent}
                total={matchingTotal}
                elapsed={elapsed}
            />
        </div>
    );
};

export default NicknameInput; 