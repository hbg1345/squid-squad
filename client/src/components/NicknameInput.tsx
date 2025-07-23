import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '../socket';
import { MATCH_SIZE } from '../constants/game';
import MatchingModal from '../MatchingModal';
import CharacterSelectionModal from './CharacterSelectionModal';
import useAudio from '../hooks/useAudio'; // useAudio 훅 가져오기
import './NicknameInput.css';

const NicknameInput: React.FC = () => {
    const [nickname, setNickname] = useState('');
    const [showMatchingModal, setShowMatchingModal] = useState(false);
    const [matchingCurrent, setMatchingCurrent] = useState(1);
    const [matchingTotal] = useState(MATCH_SIZE);
    const [elapsed, setElapsed] = useState(0);
    const [showCharacterModal, setShowCharacterModal] = useState(false);
    const [isContractSubmitted, setIsContractSubmitted] = useState(false); // 애니메이션 상태 추가
    const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
    const navigate = useNavigate();
    const { play, pause } = useAudio('/Squid-Game-Pink-Soldiers.mp3');

    useEffect(() => {
        play(); // 페이지가 열릴 때 음악 재생
        return () => {
            pause(); // 페이지를 떠날 때 음악 정지
        };
    }, [play, pause]);

    useEffect(() => {
        if (showMatchingModal) {
            getSocket().emit('joinMatch');
        } else {
            getSocket().emit('leaveMatch');
        }
    }, [showMatchingModal]);

    useEffect(() => {
        let timer: number | null = null;
        if (showMatchingModal) {
            setElapsed(0); // 매칭 시작 시 0초로 초기화
            timer = window.setInterval(() => {
                setElapsed(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (timer !== null) window.clearInterval(timer);
        };
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
        if (!nickname.trim()) return;
        setIsContractSubmitted(true); // 1. 서약서 사라지는 애니메이션 시작

        // 2. 모달이 뜨는 시간을 조절하는 부분입니다. (1000 = 1초)
        // 여기서 숫자를 늘리면 모달이 더 늦게 나타납니다.
        setTimeout(() => {
            setShowCharacterModal(true);
        }, 800);
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
            <div className={`content-wrapper ${isContractSubmitted ? 'submitted' : ''}`}>
                <img src="/contract.png" alt="Game Contract" className="contract-image" />
                <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder=""
                    maxLength={10}
                    className={`nickname-input-field ${nickname ? 'has-text' : ''}`}
                />
                <button
                    onClick={handleStartMatching}
                    disabled={!nickname.trim()}
                    className="start-matching-button"
                >
                    서약서 제출
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