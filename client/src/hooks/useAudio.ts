import { useState, useEffect, useRef } from 'react';

const useAudio = (url: string, loop: boolean = true) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    // URL이 변경될 때마다 새로운 Audio 객체 생성
    audioRef.current = new Audio(url);
    audioRef.current.loop = loop;

    // isPlaying 상태에 따라 재생/일시정지
    if (isPlaying) {
      audioRef.current.play().catch(e => console.error("음악 재생에 실패했습니다:", e));
    } else {
      audioRef.current.pause();
    }

    // 컴포넌트가 언마운트될 때 오디오 정지 및 리소스 정리
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [url, loop]); // url이나 loop가 바뀌면 effect를 다시 실행

  const toggle = () => {
    setIsPlaying(!isPlaying);
  };

  const play = () => {
    setIsPlaying(true);
  };

  const pause = () => {
    setIsPlaying(false);
  };
  
  // 재생 상태에 따라 실제 오디오 제어
  useEffect(() => {
    if (audioRef.current) {
        if (isPlaying) {
            audioRef.current.play().catch(e => console.error("음악 재생에 실패했습니다:", e));
        } else {
            audioRef.current.pause();
        }
    }
  }, [isPlaying]);

  return { isPlaying, play, pause, toggle };
};

export default useAudio; 