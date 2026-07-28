import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { IconMail, IconDeviceMobile, IconArrowLeft, IconSend, IconCircleCheck, IconShieldCheck, IconAlertTriangle, IconLoader2 } from '@tabler/icons-react';
import { api } from '../api';
import { supabase } from '../supabaseClient';
import './LoginPage.css';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const isPhone = (v) => /^\d{10}$/.test(v) || /^\+\d{10,12}$/.test(v);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const id = identifier.trim();

    if (!id || (!isEmail(id) && !isPhone(id))) {
      setErrorMsg('Please enter a valid registered email address or 10-digit mobile number.');
      return;
    }

    setErrorMsg('');
    setIsLoading(true);

    try {
      // 1. Verify that this email or mobile number is registered in the SGU Smart-Bite database first!
      const verifyRes = await api.verifyRegistration(id);
      
      if (!verifyRes || !verifyRes.registered) {
        setErrorMsg('Account not registered. This email or mobile number was never registered with SGU Smart-Bite. Please check for typos or click Sign Up to create an account.');
        setIsLoading(false);
        return;
      }

      // 2. Account verified! Send password reset link to registered target via Vercel Serverless API
      if (isEmail(id)) {
        await fetch('/api/send-reset-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: id })
        }).catch(console.error);

        await supabase.auth.resetPasswordForEmail(id, {
          redirectTo: window.location.origin + '/reset-password',
        }).catch(console.error);
      } else if (isPhone(id)) {
        const formattedPhone = /^\d{10}$/.test(id) ? `+91${id}` : id;
        await supabase.auth.signInWithOtp({
          phone: formattedPhone,
        }).catch(console.error);
      }

      setIsLoading(false);
      setIsSubmitted(true);
    } catch (err) {
      if (err.message?.includes('Account not registered') || err.message?.includes('404') || err.message?.includes('not found')) {
        setErrorMsg('Account not registered. This email or mobile number was never registered with SGU Smart-Bite. Please check for typos or click Sign Up to create an account.');
      } else {
        setErrorMsg(err.message || 'Could not verify registered account. Please try again.');
      }
      setIsLoading(false);
    }
  };

  return (
    <main className="sb-root">
      {/* Background ambient canvas glow */}
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
            <IconShieldCheck size={36} strokeWidth={1.75} />
          </div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.75rem', fontWeight: 800, color: '#F8FAFC', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
            SGU Smart-Bite
          </h1>
          <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#E4002B', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>
            Account Security & Recovery
          </p>
        </div>

        {isSubmitted ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.15)',
              color: '#22C55E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}>
              <IconCircleCheck size={32} strokeWidth={2} />
            </div>

            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.3rem', fontWeight: 700, color: '#F8FAFC', margin: '0 0 10px 0' }}>
              Account Verified!
            </h2>

            <div style={{
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 16,
              padding: '16px',
              fontSize: '0.85rem',
              color: '#CBD5E1',
              lineHeight: 1.6,
              marginBottom: 20,
              textAlign: 'center'
            }}>
              A password reset link or 6-digit OTP verification code has been dispatched to your registered contact <strong style={{ color: '#FFFFFF' }}>{identifier}</strong>.
            </div>

            <p style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: 24 }}>
              Please check your email inbox, spam folder, or SMS messages for instructions.
            </p>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="sb-btn-primary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <span>Return to Sign In</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Registered Mobile Number or Email ID
              </label>
              
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                {isPhone(identifier.trim()) ? (
                  <IconDeviceMobile 
                    size={20} 
                    strokeWidth={1.75} 
                    style={{ position: 'absolute', left: 14, color: '#E4002B', pointerEvents: 'none' }} 
                  />
                ) : (
                  <IconMail 
                    size={20} 
                    strokeWidth={1.75} 
                    style={{ position: 'absolute', left: 14, color: '#64748B', pointerEvents: 'none' }} 
                  />
                )}
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="student@sgu.ac.in or 9876543210"
                  style={{
                    width: '100%',
                    padding: '14px 16px 14px 44px',
                    background: 'rgba(30, 41, 59, 0.65)',
                    border: errorMsg ? '1px solid #EF4444' : '1px solid rgba(255, 255, 255, 0.14)',
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
              </div>

              {errorMsg && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  marginTop: 12,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8
                }}>
                  <IconAlertTriangle size={18} strokeWidth={2} style={{ color: '#EF4444', shrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#FCA5A5', margin: 0, lineHeight: 1.4 }}>
                    {errorMsg}
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !identifier.trim()}
              className="sb-btn-primary"
              style={{ 
                width: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: 8,
                opacity: (!identifier.trim() || isLoading) ? 0.6 : 1,
                cursor: (!identifier.trim() || isLoading) ? 'not-allowed' : 'pointer'
              }}
            >
              {isLoading ? (
                <>
                  <IconLoader2 size={20} className="sb-spin" />
                  <span>Verifying Account Registration...</span>
                </>
              ) : (
                <>
                  <span>Verify & Send Reset Code</span>
                  <IconSend size={18} strokeWidth={2} />
                </>
              )}
            </button>

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Link
                to="/login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#94A3B8',
                  textDecoration: 'none',
                  transition: 'color 0.2s ease'
                }}
              >
                <IconArrowLeft size={16} strokeWidth={2} />
                <span>Back to Sign In</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
};

export default ForgotPassword;
