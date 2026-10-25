import React from 'react';

export default function Alert({ type = 'info', message, onClose }) {
  if (!message) return null;

  const icons = {
    success: '✓',
    error: '⚠',
    warning: '!',
    info: 'ℹ',
  };

  return (
    <div className={`alert alert-${type}`} role="alert">
      <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{icons[type] || 'ℹ'}</span>
      <div style={{ flex: 1, whiteSpace: 'pre-line' }}>{message}</div>
      {onClose && (
        <button 
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'inherit' }}
          aria-label="Close alert"
        >
          ✕
        </button>
      )}
    </div>
  );
}
