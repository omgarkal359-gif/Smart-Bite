import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  IconLock, IconEye, IconEyeOff, IconCircleCheck, 
  IconCircleX, IconAlertTriangle, IconKey, IconLoader2 
} from '@tabler/icons-react';
import { supabase } from '../supabaseClient';
import './LoginPage.css';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasValidSession, setHasValidSession] = useState(null); // null = checking, true/false
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. URL & Recovery Session Validation
  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          if (isMounted) setHasValidSession(false);
        } else {
          if (isMounted) setHasValidSession(true);
        }
      } catch (err) {
        if (isMounted) setHasValidSession(false);
      }
    }

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        if (isMounted) setHasValidSession(true);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2. Real-time Password Strength Validation Criteria
  const hasMinLength = newPassword.length >= 8;
  const hasNumber = /\d/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword !== '';
  const isValidPassword = hasMinLength && hasNumber && passwordsMatch;

  // 3. Password Update Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValidPassword) return;

    setIsLoading(true);
    setErrorMsg('');

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setSuccessMsg('Password updated successfully! Redirecting to login...');
      await supabase.auth.signOut();

      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
    } catch (err) {
      setErrorMsg(err.message || 'Could not update password. Link may have expired.');
      setIsLoading(false);
    }
  };

  // Loading State while verifying recovery session
  if (hasValidSession === null) {
    return (
      <main className="sb-root">
        <div className="sb-bg-accent" aria-hidden="true" />
        <div style={{ color: '#F8FAFC', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconLoader2 size={24} className="sb-spin" style={{ color: '#E4002B' }} />
          <span>Verifying security link...</span>
        </div>
      </main>
    );
  }

  // Invalid or Expired Recovery Session View
  if (hasValidSession === false) {
    return (
      <main className="sb-root">
        <div className="sb-bg-accent" aria-hidden="true" />
        
        <div className="sb-card" style={{ maxWidth: 440, padding: '40px 32px', textAlign: 'center' }}>
          <div 
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#EF4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}
          >
            <IconAlertTriangle size={34} strokeWidth={1.75} />
          </div>

          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.4rem', fontWeight: 800, color: '#F8FAFC', margin: '0 0 10px 0' }}>
            Invalid or Expired Link
          </h2>

          <p style={{ fontSize: '0.85rem', color: '#94A3B8', lineHeight: 1.6, marginBottom: 24 }}>
            This password recovery link is either invalid or has expired. Please request a new link to reset your password.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="sb-btn-primary"
              style={{ width: '100%' }}
            >
              Request New Link
            </button>

            <Link
              to="/login"
              style={{ fontSize: '0.82rem', fontWeight: 700, color: '#94A3B8', textDecoration: 'none', padding: '8px 0' }}
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="sb-root">
      <div className="sb-bg-accent" aria-hidden="true" />

      <div className="sb-card" style={{ maxWidth: 440, padding: '40px 32px' }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div 
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              background: 'linear-gradient(135deg, #E4002B 0%, #B80023 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 10px 25px rgba(228, 0, 43, 0.4)'
            }}
          >
            <IconKey size={34} strokeWidth={1.75} />
          </div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.75rem', fontWeight: 800, color: '#F8FAFC', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
            Set New Password
          </h1>
          <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#E4002B', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>
            SGU Smart-Bite Security
          </p>
        </div>

        {successMsg ? (
          <div style={{
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: 18,
            padding: '24px 20px',
            textAlign: 'center'
          }}>
            <IconCircleCheck size={40} strokeWidth={2} style={{ color: '#22C55E', margin: '0 auto 12px' }} />
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.1rem', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>
              {successMsg}
            </h3>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            
            {/* New Password Input */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                New Password
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <IconLock size={20} strokeWidth={1.75} style={{ position: 'absolute', left: 14, color: '#64748B', pointerEvents: 'none' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  style={{
                    width: '100%',
                    padding: '14px 44px 14px 44px',
                    background: 'rgba(30, 41, 59, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    borderRadius: 14,
                    color: '#F8FAFC',
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box'
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: 14, background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <IconLock size={20} strokeWidth={1.75} style={{ position: 'absolute', left: 14, color: '#64748B', pointerEvents: 'none' }} />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  style={{
                    width: '100%',
                    padding: '14px 44px 14px 44px',
                    background: 'rgba(30, 41, 59, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    borderRadius: 14,
                    color: '#F8FAFC',
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  style={{ position: 'absolute', right: 14, background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  {showConfirm ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </button>
              </div>
            </div>

            {/* Real-time Password Strength Checklist */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 16,
              padding: '14px 16px',
              marginBottom: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Password Requirements:
              </span>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', fontWeight: 600, color: hasMinLength ? '#4ADE80' : '#64748B' }}>
                {hasMinLength ? <IconCircleCheck size={16} /> : <IconCircleX size={16} />}
                <span>At least 8 characters long</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', fontWeight: 600, color: hasNumber ? '#4ADE80' : '#64748B' }}>
                {hasNumber ? <IconCircleCheck size={16} /> : <IconCircleX size={16} />}
                <span>Includes at least 1 number</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', fontWeight: 600, color: passwordsMatch ? '#4ADE80' : '#64748B' }}>
                {passwordsMatch ? <IconCircleCheck size={16} /> : <IconCircleX size={16} />}
                <span>Passwords match</span>
              </div>
            </div>

            {errorMsg && (
              <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#EF4444', textAlign: 'center', marginBottom: 16 }}>
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading || !isValidPassword}
              className="sb-btn-primary"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: (!isValidPassword || isLoading) ? 0.5 : 1,
                cursor: (!isValidPassword || isLoading) ? 'not-allowed' : 'pointer'
              }}
            >
              {isLoading ? (
                <>
                  <IconLoader2 size={20} className="sb-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </button>
          </form>
        )}
      </div>
    </main>
  );
};

export default ResetPassword;
