import React, { useEffect, useState, useCallback, useRef } from "react";
import "./AlphabetModal.css";

interface AlphabetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ALPHABET_COUNT = 5;
const ALPHABETS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const INITIAL_TIME = 5.0; // 5초 (테스트용)
const TIMER_INTERVAL = 10; // ms, 0.01초 단위

function getRandomAlphabets(count: number) {
  const arr: string[] = [];
  while (arr.length < count) {
    const ch = ALPHABETS[Math.floor(Math.random() * ALPHABETS.length)];
    if (!arr.includes(ch)) arr.push(ch);
  }
  return arr;
}

const AlphabetModal: React.FC<AlphabetModalProps> = ({ isOpen, onClose }) => {
  const [alphabets, setAlphabets] = useState<string[]>([]);
  const [solved, setSolved] = useState<boolean[]>([]);
  const [wrongIdx, setWrongIdx] = useState<number | null>(null);
  const [time, setTime] = useState(INITIAL_TIME);
  const [failed, setFailed] = useState(false);
  const [shake, setShake] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(false);
  const timeRef = useRef(time);
  useEffect(() => { timeRef.current = time; }, [time]);

  // 모달 열릴 때마다 초기화
  useEffect(() => {
    if (isOpen) {
      const randomAlphabets = getRandomAlphabets(ALPHABET_COUNT);
      setAlphabets(randomAlphabets);
      setSolved(Array(ALPHABET_COUNT).fill(false));
      setWrongIdx(null);
      setTime(INITIAL_TIME);
      timeRef.current = INITIAL_TIME;
      setFailed(false);
    }
  }, [isOpen]);

  // 타이머: 실제 경과 시간만큼 정확히 감소
  useEffect(() => {
    if (!isOpen || failed) return;
    let running = true;
    let last = Date.now();
    timeRef.current = time;
    const timer = setInterval(() => {
      if (!running) return;
      const now = Date.now();
      const diff = (now - last) / 1000; // 초 단위
      last = now;
      if (timeRef.current > 0) {
        const next = +(timeRef.current - diff).toFixed(2);
        const clamped = Math.max(0, next);
        timeRef.current = clamped;
        setTime(clamped);
      }
    }, TIMER_INTERVAL);
    return () => {
      running = false;
      clearInterval(timer);
    };
  }, [isOpen, failed]);

  // 시간 초과 시 실패 처리
  useEffect(() => {
    if (isOpen && time <= 0 && !failed && solved.some((v) => !v)) {
      setFailed(true);
      setTimeout(() => {
        alert("실패! 다시 시도하세요.");
        onClose();
      }, 400);
    }
  }, [isOpen, time, failed, solved, onClose]);

  // 키보드 입력 처리
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      const key = e.key.toUpperCase();
      // 다음으로 맞춰야 할 인덱스
      const nextIdx = solved.findIndex((v) => !v);
      if (nextIdx === -1) return; // 이미 다 맞춤
      if (alphabets[nextIdx] === key) {
        // 순서대로 맞춘 경우
        setSolved((prev) => {
          const next = [...prev];
          next[nextIdx] = true;
          return next;
        });
        setWrongIdx(null);
      } else if (ALPHABETS.includes(key)) {
        // 틀린 경우
        setWrongIdx(nextIdx); // 틀린 박스만 빨갛게
        setTime((t) => Math.max(0, t - 1));
        setShake(true); // 흔들림 효과
        setWrongFlash(true); // 빨간 네온 효과
        setTimeout(() => setWrongIdx(null), 300);
        setTimeout(() => setShake(false), 400);
        setTimeout(() => setWrongFlash(false), 400);
      }
    },
    [alphabets, solved, isOpen]
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown, isOpen]);

  // 모두 맞추면 성공(임시: alert)
  useEffect(() => {
    if (isOpen && solved.length > 0 && solved.every(Boolean)) {
      setTimeout(() => {
        alert("성공!");
        onClose();
      }, 300);
    }
  }, [solved, isOpen, onClose]);

  // 흔들림 효과: 3초 이하일 때 true
  const isShaking = time <= 3.0 && time > 0;

  // 시간 표시 포맷 결정
  const timeDisplay = time <= 3.0 ? time.toFixed(2) : time.toFixed(1);
  // bar width 계산 (0 이하일 때 0%)
  const barWidth = time <= 0 ? 0 : (time / INITIAL_TIME) * 100;

  return isOpen ? (
    <div className="alphabet-modal-overlay">
      <div className="alphabet-modal">
        <button className="alphabet-modal-close" onClick={onClose}>
          &times;
        </button>
        <div className="alphabet-modal-content">
          <h2 className={`${shake ? "shake" : ""}${wrongFlash ? " wrong-flash" : ""}`.trim()}>{timeDisplay}초</h2>
          <div className="alphabet-timebar-wrap">
            <div
              className={`alphabet-timebar${shake ? " shake" : ""}${wrongFlash ? " wrong-flash" : ""}`.trim()}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <div className="alphabet-box-row">
            {alphabets.map((ch, i) => (
              <div
                key={ch}
                className={`alphabet-box${solved[i] ? " solved" : ""}${wrongIdx === i ? " wrong" : ""}`}
              >
                {ch}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  ) : null;
};

export default AlphabetModal; 