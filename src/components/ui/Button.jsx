import React from 'react';
import './ui.css';

export const Button = ({ children, variant = 'primary', className = '', ...props }) => {
  return (
    <button 
      className={`btn btn-${variant} tap-effect transition-smooth ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
