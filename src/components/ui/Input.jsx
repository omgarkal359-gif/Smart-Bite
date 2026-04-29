import React from 'react';
import './ui.css';

export const Input = ({ label, className = '', ...props }) => {
  return (
    <div className={`input-wrapper ${className}`}>
      {label && <label className="input-label">{label}</label>}
      <input className="input-field transition-smooth" {...props} />
    </div>
  );
};
