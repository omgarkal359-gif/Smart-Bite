import React, { useEffect } from 'react';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Unauthorized = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0F172A',
      color: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      justify: 'center',
      padding: '24px',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        maxWidth: '440px',
        width: '100%',
        background: '#1E293B',
        borderRadius: '24px',
        border: '1px solid rgba(255,59,92,0.3)',
        padding: '40px 32px',
        textAlign: 'center',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'rgba(255,59,92,0.1)',
          border: '2px solid #FF3B5C',
          display: 'flex',
          alignItems: 'center',
          justify: 'center',
          margin: '0 auto 24px auto'
        }}>
          <Lock size={36} color="#FF3B5C" />
        </div>

        <h1 style={{
          fontFamily: "'Oswald', sans-serif",
          fontSize: '2rem',
          fontWeight: 800,
          margin: '0 0 12px 0',
          color: '#FFFFFF',
          letterSpacing: '0.02em'
        }}>
          403 - ACCESS DENIED
        </h1>

        <p style={{
          fontSize: '0.9rem',
          color: '#94A3B8',
          lineHeight: 1.6,
          margin: '0 0 28px 0'
        }}>
          You do not have administrative privileges required to access the Enterprise System Control Center. This access attempt has been logged for security auditing.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={() => navigate('/login', { replace: true })}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 800,
              fontSize: '0.9rem',
              background: '#FF3B5C',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            Return to Login
          </button>
          
          <button
            onClick={() => navigate('/student')}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              background: 'transparent',
              color: '#CBD5E1'
            }}
          >
            Go to Student Portal
          </button>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;
