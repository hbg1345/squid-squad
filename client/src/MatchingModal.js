import React from 'react';
import './MatchingModal.css';

const MatchingModal = ({ open, onCancel, current = 2, total = 4, elapsed = 0 }) => {
  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content neon-modal">
        <div className="loader neon-loader"></div>
        <div className="modal-text">
          <span className="modal-pink">{current} / {total}명 매칭 중...</span>
        </div>
        <div className="elapsed-time">경과 시간: <span className="modal-pink">{elapsed}</span>초</div>
        <button className="cancel-btn neon-btn" onClick={onCancel}>취소</button>
      </div>
    </div>
  );
};

export default MatchingModal; 