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
    const navigate = useNavigate();
    const [showCharacterModal, setShowCharacterModal] = useState(false);
    const [isContractSubmitted, setIsContractSubmitted] = useState(false); // 애니메이션 상태 추가

    useEffect(() => {
        const socket = getSocket();
        const handleMatchingCount = (count: number) => setMatchingCurrent(count);
        const handleMatchFound = ({ roomId, players }: { roomId: string, players: any[] }) => {
            setShowMatchingModal(false);
            const myInfo = players.find(p => p.id === socket.id);
            navigate('/game1', { state: { roomId, playerNickname: myInfo?.nickname, character: myInfo?.character, players } });
        };

        socket.on('matchingCount', handleMatchingCount);
        socket.on('matchFound', handleMatchFound);

        return () => {
            socket.off('matchingCount', handleMatchingCount);
            socket.off('matchFound', handleMatchFound);
        };
    }, [navigate]);

    const handleCharacterSelectSubmit = () => {
        if (!nickname.trim()) return;
        setIsContractSubmitted(true); // 1. 서약서 사라지는 애니메이션 시작
        setTimeout(() => {
            setShowCharacterModal(true); // 2. 0.5초 후 캐릭터 선택 모달 표시
        }, 500); // 애니메이션 시간과 일치
    };

    const handleCancelMatching = () => {
        setShowMatchingModal(false);
    };

    const handleGameStart = (selectedCharacter: string) => {
        setShowCharacterModal(false);
        setShowMatchingModal(true);
        getSocket().emit('playerReady', { nickname, character: selectedCharacter });
    };

    return (
        <div className="nickname-container">
            <div className={`content-wrapper ${isContractSubmitted ? 'submitted' : ''}`}>
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
                        top: nickname.length >= 5 ? '732px' : '725px'
                    }}
                />
                <button
                    onClick={handleCharacterSelectSubmit}
                    disabled={!nickname.trim()}
                    className="start-matching-button"
                >
                    서약서 제출
                </button>
            </div>
            <CharacterSelectionModal
                isOpen={showCharacterModal}
                onClose={() => setShowCharacterModal(false)}
                onGameStart={handleGameStart}
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