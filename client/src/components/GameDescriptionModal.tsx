import React from 'react';

interface GameDescriptionModalProps {
  isOpen: boolean;
  title: string;
  description: string[];
}

const GameDescriptionModal: React.FC<GameDescriptionModalProps> = ({ isOpen, title, description }) => {
  if (!isOpen) return null;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3000,
    pointerEvents: 'none', // Allow clicks to pass through
  };

  const modalStyle: React.CSSProperties = {
    background: '#2c2c2c',
    padding: '30px 40px',
    borderRadius: '15px',
    width: '90%',
    maxWidth: '500px',
    textAlign: 'center',
    boxShadow: '0 5px 20px rgba(0,0,0,0.4)',
    border: '2px solid #444',
  };

  const titleStyle: React.CSSProperties = {
    color: '#fff',
    fontSize: '28px',
    marginBottom: '20px',
  };
  
  const descriptionStyle: React.CSSProperties = {
    color: '#ddd',
    fontSize: '18px',
    lineHeight: 1.6,
    marginBottom: '20px',
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={titleStyle}>{title}</h2>
        <div style={descriptionStyle}>
          {description.map((line, index) => (
            <p key={index} style={{ margin: '10px 0' }}>{line}</p>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GameDescriptionModal; 